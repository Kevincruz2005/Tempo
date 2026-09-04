import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync("packages/web/public/index.html", "utf8");
const app = readFileSync("packages/web/public/app.js", "utf8");
const css = readFileSync("packages/web/public/styles.css", "utf8");
const wallet = readFileSync("packages/web/public/wallet.js", "utf8");

describe("multipage observatory UI contract", () => {
  it("keeps every planned destination in the persistent top navigation", () => {
    for (const route of ["/dashboard", "/markets", "/history", "/docs", "/pricing"]) {
      expect(html).toContain(`href="${route}"`);
    }
    expect(app).toContain('route.startsWith("/markets/")');
  });

  it("renders the required provenance and honest-state vocabulary", () => {
    for (const label of ["CHAIN FACT", "MODEL ESTIMATE", "POLICY", "DERIVED", "JOURNAL EVENT", "LLM COMMENTARY"]) {
      expect(app).toContain(label);
    }
    for (const state of ["NO DATA", "UNAVAILABLE", "PENDING", "NOT FOUND", "EMPTY BOOK — awaiting genesis"]) {
      expect(app).toContain(state);
    }
  });

  it("preserves explicit review-before-sign and receipt verification", () => {
    expect(wallet.indexOf('fetch(`/api/wallet/prepare?')).toBeGreaterThan(-1);
    expect(wallet.indexOf('method: "eth_sendTransaction"')).toBeGreaterThan(wallet.indexOf('fetch(`/api/wallet/prepare?'));
    expect(wallet).toContain('method: "eth_getTransactionReceipt"');
    expect(wallet).toContain("RiskEngine: ACCEPTED · chain status: 1 (Trading)");
    expect(wallet).toContain("PENDING RECEIPT");
    expect(wallet).toContain('status: "confirmed"');
    expect(wallet).toContain('status: "failed"');
  });

  it("includes keyboard, responsive, and reduced-motion behavior", () => {
    expect(app).toContain('event.key === "Escape"');
    expect(app).toContain('event.key === "Tab"');
    expect(app).toContain('event.key === "/"');
    expect(css).toContain("@media (max-width: 620px)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(html).toContain('class="skip-link"');
    expect(html).toContain("/assets/tempo-logo.png");
    expect(html).toContain('id="theme-toggle"');
    expect(app).toContain('dashboard: { venue: true, agents: true, evidence: true }');
    expect(app).toContain('data-toggle-panel');
    expect(app).toContain("GENESIS EXPANDED");
    expect(app).toContain('model.dashboard[key === "agents" ? "evidence" : "agents"] = true');
    expect(css).toContain("dashboard-grid.venue-minimized");
    expect(css).toContain("dashboard-grid.agents-minimized.evidence-minimized");
    expect(app).toContain("theme-light");
    expect(html).toContain("white / purple / blue");
    expect(css).toContain("@keyframes edge-flow");
    expect(css).toContain("var(--flow-a)");
    expect(app).toContain("scheduleLiveRender");
    expect(css).toContain(".page-host.live-refresh .page");
  });

  it("provides complete market and audit filtering without synthetic data", () => {
    for (const id of ["market-status", "market-asset", "market-interval", "market-sort", "history-window", "history-asset", "history-interval", "history-type", "history-source", "history-status"]) {
      expect(app).toContain(id);
    }
    expect(app).toContain('historyTab: "OPERATIONS"');
    expect(app).toContain('["ALL", "All events"]');
  });

  it("does not introduce random or placeholder economic data", () => {
    expect(app).not.toContain("Math.random");
    expect(app).not.toContain("lorem ipsum");
    expect(app).not.toContain("tempo@example.com");
  });
});
