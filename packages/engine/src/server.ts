/**
 * Read-only HTTP boundary for the TEMPO dashboard. The chain/indexer remains
 * the source of truth; this layer only exposes bounded, redacted telemetry.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import type { JournalRecord } from "@tempo/core";
import type { Firm } from "./firm.js";

const MIME: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const SENSITIVE_KEY = /(?:private.?keys?|secret|password|authorization|cookie|mnemonic|token|api.?key|session|__proto__|prototype|constructor)/i;

export const SECURITY_HEADERS = {
  "Content-Security-Policy":
    "default-src 'self'; base-uri 'none'; connect-src 'self'; font-src 'self'; form-action 'none'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
} as const;

export interface TempoServerOptions {
  host?: string;
  maxSseClients?: number;
  maxSseClientsPerIp?: number;
  apiRequestsPerMinute?: number;
}

export function isSameOriginRequest(origin?: string, host?: string, fetchSite?: string): boolean {
  if (fetchSite?.toLowerCase() === "cross-site") return false;
  if (!origin) return true;
  if (!host) return false;
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}

export function isAllowedHostHeader(hostHeader: string | undefined, bindHost: string): boolean {
  if (!hostHeader) return false;
  try {
    const parsed = new URL(`http://${hostHeader}`);
    if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) return false;
    const requested = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    const bound = bindHost.toLowerCase().replace(/^\[|\]$/g, "");
    if (bound === "0.0.0.0" || bound === "::") return true;
    if (bound === "127.0.0.1" || bound === "::1" || bound === "localhost") {
      return requested === "127.0.0.1" || requested === "::1" || requested === "localhost";
    }
    return requested === bound;
  } catch {
    return false;
  }
}

export function parseJournalLimit(raw: string | null): number | undefined {
  if (raw === null) return 60;
  if (!/^\d{1,3}$/.test(raw)) return undefined;
  const value = Number(raw);
  return value >= 1 && value <= 300 ? value : undefined;
}

export function resolveStaticFile(staticDir: string, pathname: string): string | undefined {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return undefined;
  }
  if (decoded.includes("\0") || decoded.includes("\\")) return undefined;
  const requested = decoded === "/" ? "/index.html" : decoded;
  const segments = requested.split("/").filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === ".." || segment.startsWith("."))) return undefined;

  const base = resolve(staticDir);
  const candidate = resolve(base, ...segments);
  return candidate.startsWith(base + sep) ? candidate : undefined;
}

export function sanitizeForTransport(
  value: unknown,
  depth = 0,
  seen: WeakSet<object> = new WeakSet<object>(),
): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value === null || typeof value !== "object") return value;
  if (depth > 12) return "[TRUNCATED]";
  if (seen.has(value)) return "[CIRCULAR]";
  if (value instanceof Date) return value.toISOString();

  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeForTransport(item, depth + 1, seen));

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    output[key] = SENSITIVE_KEY.test(key) ? "[REDACTED]" : sanitizeForTransport(item, depth + 1, seen);
  }
  return output;
}

export class FixedWindowRateLimiter {
  private readonly clients = new Map<string, { count: number; startedAt: number }>();

  constructor(
    private readonly limit = 240,
    private readonly windowMs = 60_000,
  ) {}

  allow(key: string, now = Date.now()): boolean {
    const current = this.clients.get(key);
    if (!current || now - current.startedAt >= this.windowMs) {
      this.clients.set(key, { count: 1, startedAt: now });
      if (this.clients.size > 1024) this.prune(now);
      return true;
    }
    if (current.count >= this.limit) return false;
    current.count += 1;
    return true;
  }

  clear(): void {
    this.clients.clear();
  }

  private prune(now: number): void {
    for (const [key, value] of this.clients) {
      if (now - value.startedAt >= this.windowMs) this.clients.delete(key);
    }
  }
}

export class TempoServer {
  private server: ReturnType<typeof createServer> | null = null;
  private readonly sseClients = new Map<ServerResponse, string>();
  private readonly host: string;
  private readonly maxSseClients: number;
  private readonly maxSseClientsPerIp: number;
  private readonly rateLimiter: FixedWindowRateLimiter;
  private heartbeat?: ReturnType<typeof setInterval>;
  private unsubscribe?: () => void;

  constructor(
    private readonly firm: Firm,
    private readonly port: number,
    private readonly staticDir: string,
    options: TempoServerOptions = {},
  ) {
    this.host = options.host ?? "127.0.0.1";
    this.maxSseClients = options.maxSseClients ?? 32;
    this.maxSseClientsPerIp = options.maxSseClientsPerIp ?? 4;
    this.rateLimiter = new FixedWindowRateLimiter(options.apiRequestsPerMinute ?? 240);
    if (!Number.isInteger(port) || port < 0 || port > 65_535) throw new Error("invalid HTTP port");
    if (!this.host.trim()) throw new Error("invalid HTTP host");
  }

  start(): Promise<void> {
    if (this.server) return Promise.reject(new Error("TEMPO server already started"));
    this.unsubscribe = this.firm.journal.subscribe((record: JournalRecord) => {
      const frame = `data: ${JSON.stringify(sanitizeForTransport(record))}\n\n`;
      for (const response of this.sseClients.keys()) {
        try {
          if (!response.write(frame)) this.dropSse(response);
        } catch {
          this.dropSse(response);
        }
      }
    });

    this.server = createServer({ maxHeaderSize: 8_192 }, (request, response) => {
      void this.handle(request, response);
    });
    this.server.requestTimeout = 10_000;
    this.server.headersTimeout = 5_000;
    this.server.keepAliveTimeout = 5_000;
    this.server.on("clientError", (_error, socket) => {
      if (socket.writable) socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
    });
    this.server.once("close", () => this.cleanup());

    this.heartbeat = setInterval(() => {
      for (const response of this.sseClients.keys()) {
        try {
          if (!response.write(": keepalive\n\n")) this.dropSse(response);
        } catch {
          this.dropSse(response);
        }
      }
    }, 15_000);
    this.heartbeat.unref();

    return new Promise((resolveStart, rejectStart) => {
      const server = this.server!;
      const onError = (error: Error): void => {
        server.off("listening", onListening);
        this.cleanup();
        this.server = null;
        rejectStart(error);
      };
      const onListening = (): void => {
        server.off("error", onError);
        resolveStart();
      };
      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(this.port, this.host);
    });
  }

  stop(): Promise<void> {
    const server = this.server;
    this.server = null;
    this.cleanup();
    if (!server) return Promise.resolve();
    return new Promise((resolveStop, rejectStop) => {
      server.close((error) => (error ? rejectStop(error) : resolveStop()));
    });
  }

  private cleanup(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = undefined;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    for (const response of this.sseClients.keys()) response.end();
    this.sseClients.clear();
    this.rateLimiter.clear();
  }

  private dropSse(response: ServerResponse): void {
    this.sseClients.delete(response);
    response.end();
  }

  private applySecurityHeaders(response: ServerResponse): void {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) response.setHeader(name, value);
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    this.applySecurityHeaders(response);
    const rawUrl = request.url ?? "/";
    if (rawUrl.length > 2_048) return this.text(response, 414, "URI too long");
    if (request.method !== "GET") {
      response.setHeader("Allow", "GET");
      return this.text(response, 405, "method not allowed");
    }

    let url: URL;
    try {
      url = new URL(rawUrl, "http://tempo.local");
    } catch {
      return this.text(response, 400, "bad request");
    }
    if (!isAllowedHostHeader(request.headers.host, this.host)) return this.text(response, 403, "forbidden");
    if (
      !isSameOriginRequest(
        request.headers.origin,
        request.headers.host,
        Array.isArray(request.headers["sec-fetch-site"])
          ? request.headers["sec-fetch-site"][0]
          : request.headers["sec-fetch-site"],
      )
    ) {
      return this.text(response, 403, "forbidden");
    }

    const ip = request.socket.remoteAddress ?? "unknown";
    if (url.pathname.startsWith("/api/") && !this.rateLimiter.allow(ip)) {
      response.setHeader("Retry-After", "60");
      return this.json(response, 429, { error: "rate limit exceeded" });
    }

    try {
      if (url.pathname === "/api/state") return this.json(response, 200, await this.firm.snapshot());
      if (url.pathname === "/api/journal") {
        const limit = parseJournalLimit(url.searchParams.get("n"));
        if (limit === undefined) return this.json(response, 400, { error: "n must be an integer from 1 to 300" });
        return this.json(response, 200, { records: this.firm.journal.tail(limit) });
      }
      if (url.pathname === "/api/provenance") return this.json(response, 200, { values: PROVENANCE });
      if (url.pathname === "/api/stream") return this.openStream(request, response, ip);
      if (url.pathname.startsWith("/api/")) return this.json(response, 404, { error: "not found" });

      const file = resolveStaticFile(this.staticDir, url.pathname);
      if (!file) return this.text(response, 403, "forbidden");
      try {
        const data = await readFile(file);
        response.setHeader("Cache-Control", "no-cache");
        response.writeHead(200, { "Content-Type": MIME[extname(file)] ?? "application/octet-stream" });
        response.end(data);
      } catch {
        this.text(response, 404, "not found");
      }
    } catch {
      this.firm.journal.append({ type: "error", data: { what: "dashboard request failed", path: url.pathname } });
      this.json(response, 500, { error: "internal server error" });
    }
  }

  private openStream(request: IncomingMessage, response: ServerResponse, ip: string): void {
    const perIp = [...this.sseClients.values()].filter((clientIp) => clientIp === ip).length;
    if (this.sseClients.size >= this.maxSseClients || perIp >= this.maxSseClientsPerIp) {
      return this.json(response, 429, { error: "stream capacity reached" });
    }
    response.writeHead(200, {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    });
    response.write("retry: 2000\n\n");
    this.sseClients.set(response, ip);
    request.once("close", () => this.sseClients.delete(response));
  }

  private json(response: ServerResponse, status: number, body: unknown): void {
    response.setHeader("Cache-Control", "no-store");
    response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(sanitizeForTransport(body)));
  }

  private text(response: ServerResponse, status: number, body: string): void {
    response.setHeader("Cache-Control", "no-store");
    response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(body);
  }
}

const PROVENANCE = [
  { key: "spot", source: "price-feed", via: "DreamDEX/Somnia EMA oracle feed (fetchPrice/watchPrice)" },
  { key: "strike", source: "on-chain", via: "BinaryMarketsModule opening price (getOpeningPrices)" },
  { key: "book", source: "on-chain events", via: "markets-sdk live tail (somnia_watch over pool logs)" },
  { key: "fairValue", source: "policy", via: "TEMPO appraiser - AI ESTIMATE from spot/strike/vol/time" },
  { key: "status", source: "on-chain", via: "getMarketOnchain(marketId).status" },
  { key: "balances", source: "on-chain", via: "collateral ERC-20 + ERC-6909 outcome balances" },
  { key: "fills", source: "on-chain events", via: "live fill tape (OrderFilled logs)" },
  { key: "settlement", source: "on-chain", via: "market resolution + oracle explorer link" },
  { key: "tx", source: "on-chain", via: "realtime_sendRawTransaction receipts" },
] as const;
