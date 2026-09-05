import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync("packages/web/public/index.html", "utf8");
const app = readFileSync("packages/web/public/app.js", "utf8");
const css = readFileSync("packages/web/public/styles.css", "utf8");
const editorialCss = readFileSync("packages/web/public/ui-v2.css", "utf8");
const wallet = readFileSync("packages/web/public/wallet.js", "utf8");

describe("multipage observatory UI contract", () => {
  it("keeps every planned destination in the persistent top navigation", () => {
    for (const route of ["/dashboard", "/markets", "/history", "/docs", "/protocol"]) {
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
    expect(html).toContain('rel="icon"');
    expect(html).toContain('id="theme-toggle"');
    expect(html).toContain('id="menu-open"');
    expect(html).toContain('id="command-open"');
    expect(editorialCss).toContain(".editorial-hero");
    expect(editorialCss).toContain(".mobile-menu");
    expect(editorialCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(app).toContain('dashboard: { venue: true, right: true, agents: true, evidence: true }');
    expect(app).toContain('data-toggle-panel');
    expect(app).toContain("GENESIS EXPANDED");
    expect(app).toContain('rightTab("agents", "Agents & risk")');
    expect(app).toContain('rightTab("evidence", "Evidence stream")');
    expect(app).toContain("model.dashboard.right = false");
    expect(app).toContain('key === "agents" && minimized ? "↓"');
    expect(app).toContain('key === "evidence" && minimized ? "↑"');
    expect(app).toContain('model.dashboard.agents = key !== "agents"');
    expect(app).toContain('model.dashboard.evidence = key !== "evidence"');
    expect(css).toContain("dashboard-grid.venue-minimized");
    expect(css).toContain("dashboard-grid.agents-minimized.evidence-minimized");
    expect(css).toContain("writing-mode: vertical-rl");
    expect(css).toContain("right-expanded.agents-minimized .agents-risk-panel");
    expect(css).toContain("right-expanded:not(.agents-minimized).evidence-minimized");
    expect(css).toContain("grid-template-columns: 48px minmax(0, 1fr) 48px");
    expect(app).toContain("theme-light");
    expect(html).toContain("warm neutral");
    expect(css).toContain("@keyframes edge-flow");
    expect(css).toContain("var(--flow-a)");
    expect(css).toContain("Judge-facing final polish");
    expect(css).toContain("grid-template-columns: repeat(8, minmax(112px, 1fr))");
    expect(css).toContain(".fair-value .section-kicker");
    expect(css).toContain("@keyframes judge-edge-flow");
    expect(app).toContain("scheduleLiveRender");
    expect(css).toContain(".page-host.live-refresh .page");
    expect(app).toContain("captureScrollPositions");
    expect(app).toContain('data-scroll-key="dashboard-venue"');
    expect(editorialCss).toContain(".venue-panel-body");
  });

  it("uses the centered wallet connection modal without a dry-run navbar chip", () => {
    expect(html).not.toContain('id="pill-mode"');
    expect(html).toContain('id="wallet-top-state">Connect Wallet');
    expect(html).toContain('class="drawer-backdrop wallet-modal-backdrop"');
    expect(html).toContain('class="side-drawer wallet-drawer wallet-modal"');
    expect(editorialCss).toContain(".wallet-modal-backdrop");
    expect(editorialCss).toContain("place-items: center");
    expect(app).toContain('openOverlay("wallet-overlay", "#wallet-connect")');
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
    expect(html).not.toContain('id="wallet-size" type="number" min="0" inputmode="decimal" value=');
    expect(html).not.toContain('id="wallet-price" type="number" min="0" max="1" inputmode="decimal" value=');
    expect(app).not.toContain("Free Explorer");
    expect(app).not.toContain("Pro Operator");
  });
});
