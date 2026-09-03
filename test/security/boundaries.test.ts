import { describe, expect, it } from "vitest";
import { TempoExchange, clampProbToTicks, loadConfig, probToTicks, sizeToLots } from "@tempo/core";
import {
  FixedWindowRateLimiter,
  SECURITY_HEADERS,
  isAllowedHostHeader,
  isSameOriginRequest,
  parseJournalLimit,
  resolveStaticFile,
  sanitizeForTransport,
} from "@tempo/engine";
import { escapeHtml, safeHttpsUrl } from "../../packages/web/public/security.js";

describe("security boundaries", () => {
  it("rejects malformed probability and size inputs", () => {
    expect(() => probToTicks(1.1, 1000n, 6)).toThrow(/outside/);
    expect(() => sizeToLots(-1, 1000n, 6)).toThrow(/invalid/);
  });

  it("keeps binary prices strictly inside the book", () => {
    expect(clampProbToTicks(0, 1000n, 6).ticks).toBe(1000n);
    expect(clampProbToTicks(1, 1000n, 6).ticks).toBe(999000n);
  });

  it("contains static paths and rejects traversal, dotfiles, and backslashes", () => {
    expect(resolveStaticFile("/srv/tempo", "/")).toBe("/srv/tempo/index.html");
    expect(resolveStaticFile("/srv/tempo", "/app.js")).toBe("/srv/tempo/app.js");
    expect(resolveStaticFile("/srv/tempo", "/docs.html")).toBe("/srv/tempo/docs.html");
    expect(resolveStaticFile("/srv/tempo", "/assets/dashboard.png")).toBe("/srv/tempo/assets/dashboard.png");
    expect(resolveStaticFile("/srv/tempo", "/%2e%2e/secret")).toBeUndefined();
    expect(resolveStaticFile("/srv/tempo", "/../secret")).toBeUndefined();
    expect(resolveStaticFile("/srv/tempo", "/.env")).toBeUndefined();
    expect(resolveStaticFile("/srv/tempo", "/folder\\secret")).toBeUndefined();
  });

  it("accepts same-origin browser reads and rejects cross-site requests", () => {
    expect(isSameOriginRequest(undefined, "localhost:7333", undefined)).toBe(true);
    expect(isSameOriginRequest("http://localhost:7333", "localhost:7333", "same-origin")).toBe(true);
    expect(isSameOriginRequest("https://attacker.invalid", "localhost:7333", "cross-site")).toBe(false);
    expect(isSameOriginRequest("javascript:alert(1)", "localhost:7333", "same-origin")).toBe(false);
  });

  it("rejects DNS-rebinding and malformed host headers on a loopback bind", () => {
    expect(isAllowedHostHeader("localhost:7333", "127.0.0.1")).toBe(true);
    expect(isAllowedHostHeader("127.0.0.1:7333", "127.0.0.1")).toBe(true);
    expect(isAllowedHostHeader("[::1]:7333", "127.0.0.1")).toBe(true);
    expect(isAllowedHostHeader("attacker.invalid:7333", "127.0.0.1")).toBe(false);
    expect(isAllowedHostHeader("attacker.invalid@127.0.0.1:7333", "127.0.0.1")).toBe(false);
  });

  it("requires a bounded canonical journal limit", () => {
    expect(parseJournalLimit(null)).toBe(60);
    expect(parseJournalLimit("1")).toBe(1);
    expect(parseJournalLimit("300")).toBe(300);
    expect(parseJournalLimit("0")).toBeUndefined();
    expect(parseJournalLimit("301")).toBeUndefined();
    expect(parseJournalLimit("2.5")).toBeUndefined();
    expect(parseJournalLimit("1e2")).toBeUndefined();
  });

  it("redacts nested credentials without hiding transaction evidence", () => {
    const tx = `0x${"a".repeat(64)}`;
    const result = sanitizeForTransport({
      privateKey: "do-not-expose",
      apiKey: "do-not-expose",
      accessToken: "do-not-expose",
      authorization: "Bearer do-not-expose",
      nested: { cookie: "do-not-expose", tx },
    });
    expect(result).toEqual({
      privateKey: "[REDACTED]",
      apiKey: "[REDACTED]",
      accessToken: "[REDACTED]",
      authorization: "[REDACTED]",
      nested: { cookie: "[REDACTED]", tx },
    });
  });

  it("terminates cyclic data during transport sanitization", () => {
    const value: { self?: unknown } = {};
    value.self = value;
    expect(sanitizeForTransport(value)).toEqual({ self: "[CIRCULAR]" });
  });

  it("enforces fixed-window API request limits", () => {
    const limiter = new FixedWindowRateLimiter(2, 1_000);
    expect(limiter.allow("127.0.0.1", 0)).toBe(true);
    expect(limiter.allow("127.0.0.1", 100)).toBe(true);
    expect(limiter.allow("127.0.0.1", 200)).toBe(false);
    expect(limiter.allow("127.0.0.1", 1_000)).toBe(true);
  });

  it("ships browser isolation and content-sniffing defenses", () => {
    expect(SECURITY_HEADERS["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(SECURITY_HEADERS["Content-Security-Policy"]).toContain("script-src 'self'");
    expect(SECURITY_HEADERS["X-Content-Type-Options"]).toBe("nosniff");
    expect(SECURITY_HEADERS["X-Frame-Options"]).toBe("DENY");
  });

  it("encodes untrusted dashboard markup using the production browser helper", () => {
    expect(escapeHtml(`<img src=x onerror="alert('xss')">`)).toBe(
      "&lt;img src=x onerror=&quot;alert(&#39;xss&#39;)&quot;&gt;",
    );
  });

  it("allows HTTPS audit links and rejects active or plaintext schemes", () => {
    expect(safeHttpsUrl("https://explorer.invalid/question/1")).toBe("https://explorer.invalid/question/1");
    expect(safeHttpsUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpsUrl("data:text/html,attack")).toBeNull();
    expect(safeHttpsUrl("http://explorer.invalid/question/1")).toBeNull();
  });

  it("enforces the emergency pause before any signed write boundary", async () => {
    const exchange = new TempoExchange({ config: { ...loadConfig("/tmp"), paused: true } });
    await expect(exchange.place("untrusted", "buy", 1, 0.5)).rejects.toThrow(/kill switch/);
    await expect(exchange.faucet()).rejects.toThrow(/kill switch/);
    await exchange.close();
  });
});
