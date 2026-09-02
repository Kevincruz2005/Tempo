/**
 * TempoServer — serves the web dashboard (static, single screen) plus:
 *   GET /api/state   — live snapshot (markets, agents, tail health, risk)
 *   GET /api/stream  — SSE of journal records as they land
 *   GET /api/journal — recent records for the activity tape
 *   GET /api/provenance — the provenance map for every displayed value class
 * All values originate from the firm's real reads/writes; nothing here is
 * synthesized.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import type { Firm } from "./firm.js";
import type { JournalRecord } from "@tempo/core";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
};

export class TempoServer {
  private server: ReturnType<typeof createServer> | null = null;
  private sseClients = new Set<ServerResponse>();

  constructor(
    private readonly firm: Firm,
    private readonly port: number,
    private readonly staticDir: string,
  ) {}

  start(): Promise<void> {
    const unsub = this.firm.journal.subscribe((rec: JournalRecord) => {
      const frame = `data: ${JSON.stringify(rec)}\n\n`;
      for (const res of this.sseClients) {
        try {
          res.write(frame);
        } catch {
          this.sseClients.delete(res);
        }
      }
    });
    this.server = createServer((req, res) => {
      void this.handle(req, res);
    });
    this.server.on("close", unsub);
    return new Promise((resolve) => this.server!.listen(this.port, () => resolve()));
  }

  stop(): Promise<void> {
    for (const res of this.sseClients) res.end();
    this.sseClients.clear();
    return new Promise((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()));
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", "http://localhost");
    try {
      if (url.pathname === "/api/state") {
        return this.json(res, await this.firm.snapshot());
      }
      if (url.pathname === "/api/stream") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        res.write(`retry: 2000\n\n`);
        this.sseClients.add(res);
        req.on("close", () => this.sseClients.delete(res));
        return;
      }
      if (url.pathname === "/api/journal") {
        const n = Number(url.searchParams.get("n") ?? 60);
        return this.json(res, { records: this.firm.journal.tail(Math.min(300, Math.max(1, n))) });
      }
      if (url.pathname === "/api/provenance") {
        return this.json(res, {
          values: [
            { key: "spot", source: "price-feed", via: "DreamDEX/Somnia EMA oracle feed (fetchPrice/watchPrice)" },
            { key: "strike", source: "on-chain", via: "BinaryMarketsModule opening price (getOpeningPrices)" },
            { key: "book", source: "on-chain events", via: "markets-sdk live tail (somnia_watch over pool logs)" },
            { key: "fairValue", source: "policy", via: "TEMPO appraiser — AI ESTIMATE from spot/strike/vol/time" },
            { key: "status", source: "on-chain", via: "getMarketOnchain(marketId).status" },
            { key: "balances", source: "on-chain", via: "collateral ERC-20 + ERC-6909 outcome balances" },
            { key: "fills", source: "on-chain events", via: "live fill tape (OrderFilled logs)" },
            { key: "settlement", source: "on-chain", via: "market resolution + oracle explorer link" },
            { key: "tx", source: "on-chain", via: "realtime_sendRawTransaction receipts" },
          ],
        });
      }
      // static
      let path = url.pathname === "/" ? "/index.html" : url.pathname;
      path = path.replace(/\.\./g, "");
      const file = join(this.staticDir, path);
      try {
        const data = await readFile(file);
        res.writeHead(200, { "Content-Type": MIME[extname(file)] ?? "application/octet-stream" });
        res.end(data);
      } catch {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("not found");
      }
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(e) }));
    }
  }

  private json(res: ServerResponse, body: unknown): void {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  }
}
