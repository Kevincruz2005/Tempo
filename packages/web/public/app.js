import { escapeHtml, safeHttpsUrl } from "/security.js";

const $ = (id) => document.getElementById(id);
const API_BASE = (() => {
  const configured = globalThis.TEMPO_RUNTIME_CONFIG?.apiBase;
  if (typeof configured !== "string" || !configured.trim()) return location.origin;
  try {
    const url = new URL(configured, location.origin);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) return location.origin;
    return url.origin;
  } catch {
    return location.origin;
  }
})();
function apiUrl(pathname) { return new URL(pathname, API_BASE).toString(); }
const LIFE = ["BIRTH", "ANCHOR", "GENESIS", "REPRICE", "ENDGAME", "SETTLE", "CLAIM", "ROLL"];
const HASH = /^0x[0-9a-f]{64}$/i;
const model = {
  state: null,
  stats: null,
  records: [],
  walletConfig: null,
  docs: null,
  selected: null,
  stream: "CONNECTING",
  refreshAt: null,
  refreshTimer: null,
  statsTimer: null,
  statsRefreshTimer: null,
  liveRenderTimer: null,
  eventSource: null,
  commandIndex: 0,
  rowIndex: -1,
  births: new Set(),
  walletProofs: new Map(),
  loaded: { state: false, stats: false, journal: false, wallet: false },
  dashboard: { intelligence: true, venue: true, right: true, agents: true, evidence: true },
  filters: {
    marketQuery: "", marketStatus: "ALL", asset: "ALL", interval: "ALL", sort: "EXPIRY",
    historyTab: "OPERATIONS", historyQuery: "", historyAgent: "ALL", historySource: "ALL", historyStatus: "ALL",
    historyWindow: "ALL", historyAsset: "ALL", historyInterval: "ALL", historyType: "ALL",
  },
  settings: { density: "comfortable", refresh: 2000, asset: "ALL", interval: "ALL", theme: "light", reducedMotion: false },
};
model.dashboard.lifecycle = true;

function join(parts) { return parts.join(""); }
function fmt(value, digits = 2) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString(undefined, { maximumFractionDigits: digits }) : "NO DATA";
}
function pct(value, digits = 1) { return Number.isFinite(Number(value)) ? fmt(Number(value) * 100, digits) + "%" : "NO DATA"; }
function short(value, start = 8, end = 6) {
  const text = typeof value === "string" ? value : "";
  return text.length > start + end ? text.slice(0, start) + "…" + text.slice(-end) : text || "UNAVAILABLE";
}
function utc(value, seconds = false) {
  const date = new Date(seconds ? Number(value) * 1000 : value);
  return Number.isFinite(date.valueOf()) ? date.toISOString().replace("T", " ").slice(0, 19) + "Z" : "NO DATA";
}
function time(value, seconds = false) {
  const full = utc(value, seconds);
  return full === "NO DATA" ? full : full.slice(11);
}
function secondsLeft(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return "NO DATA";
  if (seconds <= 0) return "0s";
  if (seconds < 60) return Math.round(seconds) + "s";
  if (seconds < 3600) return Math.floor(seconds / 60) + "m " + Math.round(seconds % 60) + "s";
  return Math.floor(seconds / 3600) + "h " + Math.floor((seconds % 3600) / 60) + "m";
}
function badge(kind, title) {
  const names = { chain: "CHAIN FACT", model: "MODEL ESTIMATE", policy: "POLICY", derived: "DERIVED", journal: "JOURNAL EVENT", llm: "LLM COMMENTARY" };
  return '<span class="prov ' + kind + '" title="' + escapeHtml(title || names[kind]) + '">' + names[kind] + "</span>";
}
function empty(title, detail, action) {
  return '<div class="state-block" role="status"><b>' + escapeHtml(title) + "</b>" +
    (detail ? "<p>" + escapeHtml(detail) + "</p>" : "") + (action || "") + "</div>";
}
function btn(label, attrs, type) {
  return '<button class="button ' + (type || "button-ghost") + '" type="button" ' + (attrs || "") + ">" + label + "</button>";
}
function fact(label, value, source, title) {
  return '<div class="fact"><span>' + escapeHtml(label) + " " + badge(source, title) + "</span><b>" + escapeHtml(value) + "</b></div>";
}
function marketPath(id) { return "/markets/" + encodeURIComponent(String(id)); }
function path() {
  const value = location.pathname.replace(/\/+$/, "") || "/";
  return value === "/docs.html" ? "/docs" : value;
}
function routeBase() { return path().startsWith("/markets/") ? "/markets" : path(); }
function market(id) {
  return model.state?.markets?.find((row) => row.marketId.toLowerCase() === String(id).toLowerCase());
}
function marketRecords(id) {
  return model.records.filter((row) => row.marketId?.toLowerCase() === String(id).toLowerCase());
}
function recordDetail(record) {
  const data = record?.data || {};
  if (record?.type === "fill" && data.counterparty) {
    return [data.kind, data.counterpartyType, short(data.counterparty, 7, 5)].filter(Boolean).join(" · ");
  }
  return data.reason || data.what || data.outcome || data.kind || data.lifecycle || data.status || "";
}
function recordSource(record) {
  if (["order-receipt", "fill", "settlement", "claim"].includes(record.type)) return "chain";
  if (record.agent === "APPRAISER" || record.model?.name === "diffusion-fair-value") return "model";
  if (record.type === "risk-reject" || String(record.source || "").includes("policy")) return "policy";
  return "journal";
}
function recordStatus(record) {
  if (record.type === "risk-reject") return "rejected";
  if (record.type === "error") return "failed";
  if (record.type === "order-sent" && !record.tx) return record.data?.dryRun ? "journal" : "pending";
  if (record.tx || ["fill", "settlement", "claim", "order-receipt"].includes(record.type)) return "confirmed";
  return "journal";
}
function explorerUrl(kind, value) {
  const root = safeHttpsUrl(model.walletConfig?.explorerUrl);
  if (!root) return null;
  try { return new URL(kind + "/" + value, root.endsWith("/") ? root : root + "/").href; } catch { return null; }
}
function heading(kicker, title, copy, actions) {
  return '<header class="page-header"><div><span class="eyebrow">' + escapeHtml(kicker) + "</span><h1>" + escapeHtml(title) +
    "</h1><p>" + escapeHtml(copy) + '</p></div><div class="page-actions">' + (actions || "") + "</div></header>";
}
function lifecycleCopy(stage) {
  return ({ BIRTH: "Window appears", ANCHOR: "Opening read", GENESIS: "Two-sided quote", REPRICE: "Book breathes", ENDGAME: "Expiry control", SETTLE: "Oracle resolves", CLAIM: "Winner redeemed", ROLL: "Next window" })[stage] || "";
}
function lifecycle(current, compact) {
  const currentIndex = LIFE.indexOf(current);
  if (compact) return '<div class="lifecycle-detail" aria-label="Market lifecycle">' + join(LIFE.map((stage, index) => {
    const cls = index < currentIndex ? "done" : index === currentIndex ? "current" : "";
    return '<a class="' + cls + '" href="/history?market=' + encodeURIComponent(model.selected || "") + '" data-route><span>' +
      String(index + 1).padStart(2, "0") + "</span><b>" + stage + "</b></a>";
  })) + "</div>";
  return '<div class="lifecycle" aria-label="Market lifecycle">' + join(LIFE.map((stage, index) =>
    '<div class="lifecycle-step ' + (stage === current ? "active" : "") + '"><b>' + String(index + 1).padStart(2, "0") +
    " · " + stage + "</b><small>" + lifecycleCopy(stage) + "</small></div>")) + "</div>";
}

function renderLanding() {
  const markets = model.state?.markets || [];
  const selected = markets.find((row) => row.secondsLeft > 0 && row.view) || markets.find((row) => row.secondsLeft > 0);
  if (selected) model.selected = selected.marketId;
  const receipts = model.records.filter((row) => row.type === "order-receipt" && HASH.test(row.tx || "")).length;
  const settlementsCount = model.state?.settlements?.length;
  const mode = model.state ? (model.state.live.dryRun ? "DRY RUN" : "LIVE WRITES") : "UNAVAILABLE";
  const network = model.walletConfig?.chainName || model.state?.live?.network || "UNAVAILABLE";
  const chainId = model.walletConfig?.chainId;
  const trading = markets.filter((row) => row.status === 1 && row.secondsLeft > 0).length;
  const selectedLink = selected
    ? '<a class="button button-ghost" href="' + marketPath(selected.marketId) + '" data-route>Inspect active window ↗</a>'
    : '<span class="button button-ghost" aria-disabled="true">NO ACTIVE WINDOW</span>';
  const activeWindow = selected ? '<div class="auction-window-head"><div><span>ACTIVE WINDOW ' + badge("chain") + '</span><b>' +
    escapeHtml(selected.asset) + " / " + fmt(selected.intervalSec / 60, 0) + ' MIN</b></div><span class="countdown ' +
    (selected.secondsLeft <= 20 ? "urgent" : "") + '">' + secondsLeft(selected.secondsLeft) + '</span></div>' +
    '<div class="auction-window-main"><div><span>Lifecycle</span><strong>' + escapeHtml(selected.lifecycle) +
    '</strong></div><div><span>Opening</span><strong>' + (selected.view ? fmt(selected.view.opening.value, 2) : "NO DATA") +
    '</strong></div><div><span>Spot</span><strong>' + (selected.view ? fmt(selected.view.spot.value, 2) : "NO DATA") +
    '</strong></div><div><span>Fair value ' + badge("model") + '</span><strong>' +
    (selected.view?.fairValue ? pct(selected.view.fairValue.value) : "NO DATA") + '</strong></div></div>' +
    '<div class="auction-window-id">' + escapeHtml(short(selected.marketId, 14, 10)) + '</div>' :
    empty("NO ACTIVE WINDOW", "The live registry has not returned a current market window.");
  const metric = (value, label, source) => '<div><strong>' + escapeHtml(value) + '</strong><span>' +
    escapeHtml(label) + ' ' + badge(source) + '</span></div>';
  return '<section class="page landing"><div class="landing-inner">' +
    '<section class="editorial-hero"><div class="hero-copy"><span class="eyebrow">AUTONOMOUS OPENING AUCTION / SOMNIA</span>' +
    '<h1>Liquidity that arrives <em>before the crowd.</em></h1>' +
    '<p class="hero-lede">TEMPO discovers rolling DreamDEX Event Contract windows, anchors an empty book, manages inventory through expiry, and publishes the evidence trail.</p>' +
    '<div class="hero-actions"><a class="button button-primary" href="/dashboard" data-route>Enter live observatory <span>↗</span></a>' +
    selectedLink + '</div><div class="hero-network"><span class="live-beacon ' + (model.state ? "online" : "offline") +
    '"></span><span>' + escapeHtml(network) + ' · CHAIN ' + escapeHtml(chainId ?? "UNAVAILABLE") + ' · ' + escapeHtml(mode) +
    '</span></div></div><div class="auction-visual" aria-label="Live market snapshot"><div class="auction-grid" aria-hidden="true"></div>' +
    '<div class="auction-orbit" aria-hidden="true"><span></span><span></span><i></i></div><article class="auction-window">' + activeWindow +
    '</article><div class="auction-caption"><span>DISCOVER</span><span>PRICE</span><span>GATE</span><span>EXECUTE</span></div></div></section>' +
    '<section class="live-ledger" aria-label="Live evidence summary">' +
    metric(model.loaded.state ? fmt(markets.length, 0) : "NO DATA", "MARKETS IN SNAPSHOT", "chain") +
    metric(model.loaded.state ? fmt(trading, 0) : "NO DATA", "TRADING WINDOWS", "derived") +
    metric(model.loaded.journal ? fmt(model.records.length, 0) : "NO DATA", "JOURNAL EVENTS LOADED", "journal") +
    metric(model.loaded.state && model.loaded.journal ? fmt(receipts + Number(settlementsCount || 0), 0) : "NO DATA", "RECEIPTS + SETTLEMENTS", "derived") +
    '</section><section class="operating-model"><div class="section-intro"><span class="eyebrow">THE OPERATING LOOP</span>' +
    '<h2>One bounded firm.<br><em>Every window accountable.</em></h2><p>The interface separates chain facts, deterministic policy, model estimates, and journal evidence so operators can see exactly what the system knows.</p></div>' +
    '<div class="operating-grid"><article><span>01 / DISCOVERY</span><h3>Born from the venue</h3><p>Markets come from the official registry and retain their canonical market ID, cadence, status, and expiry.</p></article>' +
    '<article><span>02 / GENESIS</span><h3>An empty book gets a pulse</h3><p>GENESIS submits post-only, two-sided liquidity from live venue parameters and a journaled fair-value estimate.</p></article>' +
    '<article><span>03 / CONTROL</span><h3>Risk owns the boundary</h3><p>Every maker and taker plan passes the shared deterministic RiskEngine before any wallet request or agent write.</p></article>' +
    '<article><span>04 / PROOF</span><h3>Receipts close the loop</h3><p>Transaction receipts, settlement facts, oracle links, and claims remain inspectable from the history surface.</p></article></div></section>' +
    '<section class="lifecycle-section"><div class="section-intro compact-intro"><span class="eyebrow">CURRENT MARKET STATE</span><h2>From birth to roll.</h2></div>' +
    lifecycle(selected?.lifecycle, false) + '</section>' +
    '<section class="landing-cta"><div><span class="eyebrow">LIVE SYSTEM / NO DEMO DATA</span><h2>Observe the firm.<br>Verify the evidence.</h2></div>' +
    '<div><p>Every displayed market value is loaded from the running engine, the official Somnia surface, or the append-only journal. Missing evidence stays visibly unavailable.</p>' +
    '<div class="hero-actions"><a class="button button-primary" href="/dashboard" data-route>Open observatory ↗</a><a class="button button-ghost" href="/protocol" data-route>Read the protocol</a></div></div></section>' +
    '</div></section>';
}

function marketItems(markets) {
  if (!markets.length) return model.loaded.state ?
    empty("NO ACTIVE WINDOW", "The official registry returned no current windows.") :
    empty("UNAVAILABLE", "The live market snapshot could not be loaded.");
  return join(markets.map((row) =>
    '<button class="market-item ' + (row.marketId === model.selected ? "active " : "") + (model.births.has(row.marketId) ? "birth" : "") +
    '" type="button" data-select-market="' + escapeHtml(row.marketId) + '"><span class="market-item-main"><span class="asset-mark">' +
    escapeHtml(row.asset.slice(0, 3)) + "</span><b>" + escapeHtml(row.asset) + " " + fmt(row.intervalSec / 60, 0) +
    'm</b></span><span class="countdown ' + (row.secondsLeft <= 20 ? "urgent" : "") + '">' + secondsLeft(row.secondsLeft) +
    "</span><small>" + escapeHtml(row.lifecycle) + " · " + escapeHtml(short(row.marketId)) + "</small></button>"));
}

function mode(agent) { return agent.readOnly ? "READ ONLY" : agent.dryRun ? "DRY RUN" : "LIVE"; }
function inventory(agent) {
  if (!agent?.inventory) return null;
  return Object.values(agent.inventory).reduce((sum, row) => sum + Number(row.qtyUp || 0) + Number(row.qtyDown || 0), 0);
}
function peakWindowInventory(agent) {
  if (!agent?.inventory) return null;
  const values = Object.values(agent.inventory).map((row) => Math.abs(Number(row.qtyUp || 0)) + Math.abs(Number(row.qtyDown || 0)));
  return values.length ? Math.max(...values) : 0;
}
function lastRecord(agent, types) {
  return [...model.records].reverse().find((row) => row.agent === agent && (types || ["decision"]).includes(row.type));
}
function agentCard(agent) {
  const recent = lastRecord(agent.name);
  return '<button class="agent-card" type="button" data-agent="' + escapeHtml(agent.name) + '"><div class="agent-title"><b>' +
    escapeHtml(agent.name) + '</b><span class="prov ' + (agent.readOnly ? "derived" : "chain") + '">' + mode(agent) +
    '</span></div><div class="agent-meta"><div><span>Collateral ' + badge("chain") + "</span><b>" +
    (agent.collateral ? fmt(agent.collateral.human) : "UNAVAILABLE") + "</b></div><div><span>Inventory " + badge("derived") +
    "</span><b>" + (agent.inventory ? fmt(inventory(agent), 3) : "UNAVAILABLE") + "</b></div><div><span>Open orders " +
    badge("chain") + "</span><b>" + (agent.readOnly ? "UNAVAILABLE" : fmt(agent.openOrders, 0)) +
    "</b></div><div><span>Last decision " + badge("journal") + "</span><b>" +
    escapeHtml(short(recordDetail(recent) || agent.lastDecision, 14, 0)) + "</b></div></div></button>";
}
function riskBar(label, value, cap) {
  const ratio = Number.isFinite(value) && Number.isFinite(cap) && cap > 0 ? Math.min(100, Math.max(0, value / cap * 100)) : 0;
  return '<button class="risk-row" type="button" data-risk="' + escapeHtml(label) + '"><span class="risk-row-head"><span>' +
    escapeHtml(label) + "</span><b>" + (Number.isFinite(value) ? fmt(value) : "UNAVAILABLE") + " / " +
    (Number.isFinite(cap) ? fmt(cap) : "UNAVAILABLE") + " " + badge("policy") +
    '</b></span><span class="risk-track"><i style="--value:' + ratio + '%"></i></span></button>';
}

function marketFacts(row) {
  const view = row?.view;
  return '<div class="market-facts">' +
    fact("Expiry", Number.isFinite(row?.expiry) ? time(row.expiry, true) : "NO DATA", "chain", "DreamDEX indexed expiry") +
    fact("Time left", Number.isFinite(row?.secondsLeft) ? secondsLeft(row.secondsLeft) : "NO DATA", "derived", "Indexed expiry minus local UTC clock") +
    fact("Status", row?.status === 1 ? "1 · TRADING" : Number.isFinite(row?.status) && row.status >= 0 ? String(row.status) : "NO DATA", "chain", "Only on-chain status 1 permits writes") +
    fact("Opening / strike", view ? fmt(view.opening.value, 2) : "NO DATA", "chain", view?.opening?.source) +
    fact("Spot", view ? fmt(view.spot.value, 2) : "NO DATA", "chain", view ? view.spot.source + " · " + view.spot.at : "UNAVAILABLE") +
    fact("Venue", row?.venueId ? short(row.venueId) : "UNAVAILABLE", "chain", "DreamDEX venue registry") + "</div>";
}

function renderEmptyBook(view) {
  const at = view?.bookAt ? utc(view.bookAt) : "LIVE DISCOVERY";
  return '<div class="empty-book-box fair-value" role="status" aria-label="Empty order book awaiting genesis">' +
    '<div class="section-kicker"><span>EMPTY BOOK — awaiting genesis</span>' +
    badge("chain", "DreamDEX verified event book · " + escapeHtml(at)) + '</div>' +
    '<div class="fair-value-number empty-book-hero" title="Zero materialized orders in book">' +
    '<span>0.000</span><small class="empty-book-unit">UP / DOWN</small>' +
    '</div>' +
    '<div class="band-track empty-book-track" style="--left:0%;--width:100%;--marker:50%">' +
    '<span class="band empty-band"></span><span class="marker empty-marker"></span>' +
    '</div>' +
    '<p class="empty-book-primary"><strong>No materialized levels were returned by the live store.</strong></p>' +
    '<p class="empty-book-note">GENESIS maker deploys the initial two-sided quote anchor once discovery window finalizes. Note: Observatory panels on both sides may be toggled freely without clipping order-book depth.</p>' +
    '</div>';
}

function renderBook(view, depth = 7) {
  if (!view?.book) return empty("PENDING", "Awaiting a chain-derived market view.");
  const asks = [...(view.book.yesAsks || [])].slice(0, depth).reverse();
  const bids = [...(view.book.yesBids || [])].slice(0, depth);
  if (!asks.length && !bids.length) return renderEmptyBook(view);
  const maxSize = Math.max(1, ...asks.map((row) => Number(row.size)), ...bids.map((row) => Number(row.size)));
  const level = (row, side) => '<div class="book-level ' + side + '" style="--depth:' +
    Math.max(3, Number(row.size) / maxSize * 100) + '%" title="Chain event book · ' + escapeHtml(view.bookAt) +
    '"><span>' + fmt(row.price, 3) + "</span><span>" + fmt(row.size, 3) + "</span></div>";
  const bestAsk = view.book.yesAsks?.[0]?.price;
  const bestBid = view.book.yesBids?.[0]?.price;
  return '<div class="book"><div class="book-labels"><span>UP PRICE</span><span>SIZE</span></div>' +
    join(asks.map((row) => level(row, "ask"))) + '<div class="book-touch"><span>TOUCH ' + badge("chain") +
    "</span><strong>" + (Number.isFinite(bestBid) ? fmt(bestBid, 3) : "—") + " / " +
    (Number.isFinite(bestAsk) ? fmt(bestAsk, 3) : "—") + "</strong></div>" +
    join(bids.map((row) => level(row, "bid"))) + "</div>";
}

function renderFairValue(view) {
  const fv = view?.fairValue;
  if (!fv || !Number.isFinite(fv.value)) return empty("NO DATA", "Awaiting sufficient official price-feed history for a journaled estimate.");
  const low = Math.max(0, Number(fv.band?.[0] ?? fv.value));
  const high = Math.min(1, Number(fv.band?.[1] ?? fv.value));
  return '<div class="fair-value"><div class="section-kicker"><span>REAL-TIME FAIR VALUE</span>' +
    badge("model", fv.source + " · " + fv.at) + '</div><div class="fair-value-number">' + pct(fv.value) +
    '</div><div class="band-track" style="--left:' + low * 100 + "%;--width:" + Math.max(1, (high - low) * 100) +
    "%;--marker:" + fv.value * 100 + '%"><span class="band"></span><span class="marker"></span></div><p>Band ' +
    fmt(low, 3) + "–" + fmt(high, 3) + " · σ " + Number(fv.sigma).toExponential(2) + " · " + fmt(fv.samples, 0) +
    " official feed samples</p><p>P(close ≥ strike) under TEMPO’s driftless diffusion over live spot, on-chain opening, realized volatility, and time left. Estimate—not oracle fact.</p></div>";
}

function activityRows(records, limit = 30) {
  if (!records.length) return empty("NO EVENTS YET", "The current journal window has no matching events.");
  return join(records.slice(-limit).reverse().map((record, index) => {
    const detail = recordDetail(record);
    const hash = HASH.test(record.tx || "") ? record.tx : "";
    const evidence = hash
      ? '<button class="text-link mono" type="button" data-tx="' + escapeHtml(hash) + '">' + escapeHtml(short(hash)) + "</button>"
      : badge(recordSource(record));
    return '<div class="activity-row ' + (record.type === "fill" ? "fill" : "") + '" tabindex="0" data-row-index="' + index +
      '" data-event-id="' + escapeHtml(record.eventId || "") + '"><time>' + escapeHtml(time(record.ts)) + '</time><span class="actor">' +
      escapeHtml(record.agent || "FIRM") + "</span><span>" + escapeHtml(record.type) + '</span><span class="detail" title="' +
      escapeHtml(detail) + '">' + escapeHtml(short(detail || record.marketId, 16, 5)) + "</span>" + evidence + "</div>";
  }));
}

function settlements(rows, limit = 8) {
  if (!rows?.length) return empty("NO DATA", "No finalized markets are present in the current settlement snapshot.");
  return join(rows.slice(0, limit).map((row) => {
    const url = safeHttpsUrl(row.oracleUrl);
    const result = row.voided ? "VOID" : row.winningOutcome === 0 ? "UP" : row.winningOutcome === 1 ? "DOWN" : "PENDING";
    return '<article class="settlement-row"><div><b>' + escapeHtml(row.asset) + " " + fmt(row.intervalSec / 60, 0) +
      "m</b><span>" + result + " " + badge("chain") + "</span></div><small>" + time(row.expiry, true) + " · " +
      escapeHtml(row.tradeCount ?? "NO DATA") + " trades · last " + (row.lastPrice === undefined ? "NO DATA" : fmt(row.lastPrice, 3)) +
      "</small>" + (url ? '<a class="text-link" href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">Oracle audit ↗</a>' :
        '<span class="text-link">Oracle link unavailable</span>') + "</article>";
  }));
}

function briefing() {
  return '<article class="briefing" aria-live="polite"><div class="briefing-head"><span class="section-kicker" style="margin:0">OPERATOR BRIEFING ' +
    badge("llm") + '</span><button class="button button-small button-ghost" id="ai-summary" type="button">Generate</button></div>' +
    '<blockquote id="ai-narrative-text">Optional narration is generated only when requested. Journal facts remain authoritative.</blockquote>' +
    '<small id="ai-narrative-meta">Nothing is sent until Generate · LLM does not control pricing, risk, or execution.</small></article>';
}

function panelToggle(key, minimized) {
  const left = key === "venue";
  const arrow = key === "intelligence" ? (minimized ? "↓" : "↑") : key === "lifecycle" ? (minimized ? "↑" : "↓") : key === "agents" && minimized ? "↓" : key === "evidence" && minimized ? "↑" : minimized ? (left ? "→" : "←") : (left ? "←" : "→");
  return '<button class="panel-toggle" type="button" data-toggle-panel="' + key + '" aria-expanded="' + (!minimized) + '" aria-label="' + (minimized ? "Expand " : "Minimize ") + key + ' panel"><span class="toggle-arrow" aria-hidden="true">' + arrow + '</span><span class="toggle-text">' + (minimized ? "Expand" : "Minimize") + '</span></button>';
}

function rightTab(key, label) {
  return '<button class="right-tab" type="button" data-toggle-panel="' + key + '" aria-expanded="false" aria-label="Open ' + label + '"><span class="toggle-arrow" aria-hidden="true">←</span><span class="toggle-text">' + label + '</span></button>';
}

function panelSwitch(key, label, arrow) {
  return '<button class="panel-toggle panel-switch" type="button" data-toggle-panel="' + key + '" aria-expanded="false" aria-label="Open ' + label + '"><span class="toggle-arrow" aria-hidden="true">' + arrow + '</span><span class="toggle-text">' + label + '</span></button>';
}

function firmIntelligence(minimized = false) {
  const stats = model.stats;
  const quality = stats?.estimateQuality;
  const fills = stats?.execution?.fills;
  const active = (model.state?.markets || []).filter((row) => row.status === 1 && row.secondsLeft > 0);
  const covered = active.filter((row) => row.managed && row.view?.book?.yesBids?.length && row.view?.book?.yesAsks?.length).length;
  const item = (value, label, source, title) => '<div class="intelligence-stat"><span>' + escapeHtml(label) + " " + badge(source, title) +
    '</span><b>' + escapeHtml(value) + "</b></div>";
  const scoredMarkets = Number.isFinite(Number(quality?.scoredMarkets)) ? Number(quality.scoredMarkets) : null;
  const qualityUpdatedAt = stats?.window?.until ? time(stats.window.until) : null;
  const qualitySource = scoredMarkets === null
    ? "Live journal aggregate unavailable"
    : "Live derived metric over " + scoredMarkets + " settled market" + (scoredMarkets === 1 ? "" : "s") + ": the last pre-expiry journaled fair-value estimate is scored against the chain-observed settlement outcome" + (qualityUpdatedAt ? ". Updated " + qualityUpdatedAt : "");
  const period = stats?.window?.since
    ? "LIVE · " + (scoredMarkets === null ? "NO DATA" : fmt(scoredMarkets, 0)) + " SCORED · UPDATED " + (qualityUpdatedAt || "NO DATA")
    : "AWAITING LIVE JOURNAL AGGREGATE";
  return '<section class="firm-intelligence ' + (minimized ? "intelligence-minimized" : "intelligence-expanded") + '" aria-label="Firm intelligence and ecosystem impact"><div class="intelligence-head"><div><span class="eyebrow">VERIFIABLE TRADING INTELLIGENCE</span><h2>Measured against settlement truth</h2></div><span class="intelligence-actions"><small>' +
    escapeHtml(period) + '</small>' + panelToggle("intelligence", minimized) + '</span></div><div class="intelligence-grid-shell"><div class="intelligence-grid">' +
    item(quality?.brier === null || quality?.brier === undefined ? "NO DATA" : fmt(quality.brier, 4), "BRIER · " + (scoredMarkets === null ? "NO DATA" : fmt(scoredMarkets, 0) + " SETTLED"), "derived", qualitySource) +
    item(quality?.directionalAccuracy === null || quality?.directionalAccuracy === undefined ? "NO DATA" : pct(quality.directionalAccuracy), "DIR. ACC. · " + (scoredMarkets === null ? "NO DATA" : fmt(scoredMarkets, 0) + " SETTLED"), "derived", qualitySource) +
    item(stats ? fmt(stats.markets?.births, 0) : "NO DATA", "WINDOW BIRTHS", "journal") +
    item(stats ? fmt(fills?.count, 0) : "NO DATA", "FILLS", "journal") +
    item(stats ? fmt(fills?.quoteVolume, 3) : "NO DATA", "MATCHED NOTIONAL", "derived", "Sum of fill price × size in journal collateral units") +
    item(model.loaded.state ? (active.length ? covered + "/" + active.length : "NO DATA") : "NO DATA", "LIVE COVERAGE", "derived", "Managed trading windows with materialized UP bid and ask") +
    item(stats ? fmt(stats.execution?.uniqueTxCount, 0) : "NO DATA", "TX HASHES", "journal", "Journaled hashes; verify independently with tempo verify") +
    item("0%", "VENUE FEES", "chain", "DreamDEX maker, taker, and settlement fees are currently zero") +
    item("0", "MOCKED VALUES", "policy") +
    "</div></div></section>";
}

function dashboardLifecycle(selected, minimized = false) {
  const current = selected?.lifecycle || "UNAVAILABLE";
  const currentIndex = LIFE.indexOf(current);
  const assetName = selected ? escapeHtml(selected.asset) + " " + fmt(selected.intervalSec / 60, 0) + "m" : "AWAITING SELECTION";
  const marketIdParam = selected?.marketId ? encodeURIComponent(selected.marketId) : "";
  const auditLink = selected
    ? '<a class="text-link mono" href="/history?market=' + marketIdParam + '" data-route>Audit window ↗</a>'
    : '<span class="mono" style="color:var(--muted)">Awaiting selection</span>';

  const steps = LIFE.map((stage, index) => {
    const isDone = currentIndex >= 0 && index < currentIndex;
    const isActive = stage === current;
    const stateClass = isActive ? "active" : isDone ? "done" : "upcoming";
    const num = String(index + 1).padStart(2, "0");
    const href = selected ? '/history?market=' + marketIdParam : '/history';

    return '<a class="dash-life-step ' + stateClass + '" href="' + href + '" data-route ' +
      'title="Stage ' + num + ': ' + stage + ' (' + escapeHtml(lifecycleCopy(stage)) + ') · Click to inspect history">' +
      '<div class="dash-life-head">' +
        '<span class="dash-life-num">' + num + '</span>' +
        '<span class="dash-life-status">' + (isActive ? 'CURRENT' : isDone ? 'DONE' : 'NEXT') + '</span>' +
      '</div>' +
      '<div class="dash-life-body">' +
        '<b class="dash-life-name">' + stage + '</b>' +
        '<small class="dash-life-copy">' + escapeHtml(lifecycleCopy(stage)) + '</small>' +
      '</div>' +
      '<div class="dash-life-bar"><span class="dash-life-progress"></span></div>' +
    '</a>';
  });

  const panelClass = "panel dashboard-lifecycle-panel" + (minimized ? " panel-minimized" : "");
  const subtitle = minimized
    ? '01 BIRTH → 08 ROLL · ' + assetName + ' · OPTIONAL LIFECYCLE DOCK'
    : '01 BIRTH → 08 ROLL · ' + assetName + ' · CONTINUOUS CYCLE';

  return '<section class="' + panelClass + '" aria-label="Market lifecycle progress">' +
    '<div class="panel-head dashboard-lifecycle-head">' +
      '<div class="panel-head-title">' +
        '<h2>Market lifecycle progress</h2>' +
        '<small>' + subtitle + '</small>' +
      '</div>' +
      '<div class="dashboard-lifecycle-actions">' +
        '<span class="status-pill ' + (selected ? 'pill-active' : '') + '"><span>ACTIVE: ' + escapeHtml(current) + '</span></span>' +
        auditLink +
        panelToggle("lifecycle", minimized) +
      '</div>' +
    '</div>' +
    '<div class="dashboard-lifecycle-track" data-scroll-key="dashboard-lifecycle">' + join(steps) + '</div>' +
  '</section>';
}

function renderDashboard() {
  if (!model.loaded.state) return '<section class="page page-scroll">' + heading("LIVE COMMAND CENTER", "Observatory unavailable",
    "TEMPO could not load a verified engine snapshot. No market or agent values are being inferred.", btn("Retry", "data-refresh")) +
    '<section class="panel">' + empty("UNAVAILABLE", "Check the engine connection and retry the live state read.") + "</section></section>";
  const markets = model.state?.markets || [];
  if (!model.selected || !market(model.selected)) model.selected = (markets.find((row) => row.secondsLeft > 20 && row.view) || markets[0])?.marketId || null;
  const selected = market(model.selected);
  const agents = model.state?.agents || [];
  const risk = model.state?.risk;
  const genesis = agents.find((row) => row.name === "GENESIS") || agents[0];
  const nearest = markets.filter((row) => row.secondsLeft > 0).sort((a, b) => a.secondsLeft - b.secondsLeft)[0];
  const events = model.records.filter((row) => !["price", "market-state"].includes(row.type));
  const births = model.records.filter((row) => row.type === "market-birth").length;
  const actions = '<a class="button button-ghost" href="/markets" data-route>View all markets</a>' + btn("Settings", "data-open-settings");
  const dash = model.dashboard;
  const gridClass = "dashboard-grid" + (dash.venue ? " venue-minimized" : "") + (dash.right ? " right-minimized" : " right-expanded") + (dash.agents ? " agents-minimized" : "") + (dash.evidence ? " evidence-minimized" : "") + (dash.lifecycle ? " lifecycle-minimized" : " lifecycle-expanded");
  const selectedContent = selected ? marketFacts(selected) + '<div class="market-core">' + renderBook(selected.view, 5) +
    renderFairValue(selected.view) + '</div>' :
    empty("NO ACTIVE WINDOW", "No market is available for inspection.");
  const agentsPanel = '<section class="panel agents-risk-panel ' + (dash.agents ? "panel-minimized" : "") + '"><div class="panel-head"><div class="panel-head-title"><h2>Agents & risk</h2><small>GENESIS EXPANDED · ONE BOUNDARY · TWO POLICIES</small></div><div class="panel-head-actions">' + (!dash.agents ? panelSwitch("evidence", "Evidence stream", "↓") : "") + panelToggle("agents", dash.agents) + '</div></div><div class="agents-risk-body panel-body scroll-region" data-scroll-key="dashboard-agents"><div class="agent-stack">' +
    (agents.length ? join(agents.map(agentCard)) : empty("NO DATA", "Agent state unavailable.")) + '</div><div class="drawer-divider"></div><div class="risk-bars">' +
    riskBar("Peak window gross inventory", peakWindowInventory(genesis), risk?.maxGrossInventory) +
    riskBar("Per-window open orders", null, risk?.maxOpenOrdersPerWindow) +
    riskBar("Capital committed", null, risk?.firmCapitalCap) +
    '</div></div></section>';
  const evidencePanel = '<section class="panel evidence-panel ' + (dash.evidence ? "panel-minimized" : "") + '"><div class="panel-head"><div class="panel-head-title"><h2>Evidence stream</h2><a class="text-link" href="/history" data-route>Full history ↗</a></div><div class="panel-head-actions">' + (!dash.evidence ? panelSwitch("agents", "Agents & risk", "↑") : "") + panelToggle("evidence", dash.evidence) + '</div></div>' +
    '<div class="evidence-body"><div class="scroll-region" data-scroll-key="dashboard-evidence"><div class="evidence-events">' +
    (model.loaded.journal ? activityRows(events, 12) : empty("UNAVAILABLE", "The operational journal could not be loaded.")) +
    '</div><div class="panel-body" style="padding-top:8px"><div class="section-kicker"><span>LATEST SETTLEMENTS</span>' +
    badge("chain") + "</div>" + settlements(model.state?.settlements || [], 2) + briefing() + "</div></div></div></section>";
  const rightPanels = dash.right ? '<section class="panel right-rail"><div class="right-rail-tabs">' + rightTab("agents", "Agents & risk") + rightTab("evidence", "Evidence stream") + '</div></section>' : dash.agents ? evidencePanel : agentsPanel;
  return '<section class="page dashboard ' + (dash.lifecycle ? "lifecycle-minimized" : "lifecycle-expanded") + '" data-scroll-key="dashboard-page"><div class="dashboard-intro">' + heading("LIVE COMMAND CENTER", "The autonomous firm, in evidence",
    "Market state first. Agent action second. Risk and on-chain proof always visible.", actions) + firmIntelligence(dash.intelligence) + "</div>" +
    '<div class="' + gridClass + '"><section class="panel venue-panel ' + (dash.venue ? "panel-minimized" : "") + '"><div class="panel-head"><div class="panel-head-title"><h2>Venue pulse</h2><small>' +
    fmt(markets.length, 0) + " WINDOWS · " + (model.loaded.journal ? fmt(births, 0) : "NO DATA") + ' BIRTHS LOADED</small></div>' + panelToggle("venue", dash.venue) + '</div><div class="venue-panel-body"><div class="pulse-grid">' +
    '<div class="pulse-stat"><span>TRADING WINDOWS ' + badge("chain") + "</span><b>" + fmt(markets.filter((row) => row.secondsLeft > 0 && row.status === 1).length, 0) +
    '</b></div><div class="pulse-stat"><span>NEAREST EXPIRY ' + badge("derived") + "</span><b>" +
    (nearest ? secondsLeft(nearest.secondsLeft) : "NO DATA") + '</b></div><div class="pulse-stat"><span>MANAGED CADENCES ' + badge("derived") + "</span><b>" +
    fmt(new Set(markets.filter((row) => row.managed).map((row) => row.intervalSec)).size, 0) +
    '</b></div></div><div class="market-list scroll-region" data-scroll-key="dashboard-venue">' + marketItems(markets) + "</div></div></section>" +
    '<section class="panel market-preview"><div class="panel-head"><h2>' +
    (selected ? escapeHtml(selected.asset) + " " + fmt(selected.intervalSec / 60, 0) + "m · " + escapeHtml(selected.lifecycle) : "Selected market") +
    "</h2>" + (selected ? '<a class="text-link" href="' + marketPath(selected.marketId) + '" data-route>Inspect market ↗</a>' : "") +
    '</div><div class="panel-body scroll-region" data-scroll-key="dashboard-market">' + selectedContent + "</div></section>" +
    rightPanels + '</div>' +
    dashboardLifecycle(selected, dash.lifecycle) +
    '</section>';
}

function touch(row) {
  const book = row.view?.book;
  return { bid: book?.yesBids?.[0]?.price, ask: book?.yesAsks?.[0]?.price, empty: !book || (!book.yesBids?.length && !book.yesAsks?.length) };
}

function filteredMarkets() {
  const f = model.filters;
  let rows = [...(model.state?.markets || [])];
  const query = f.marketQuery.trim().toLowerCase();
  if (query) rows = rows.filter((row) => [row.asset, row.marketId, row.venueId, row.symbol, String(row.intervalSec / 60)].some((value) => String(value || "").toLowerCase().includes(query)));
  if (f.asset !== "ALL") rows = rows.filter((row) => row.asset === f.asset);
  if (f.interval !== "ALL") rows = rows.filter((row) => String(row.intervalSec) === f.interval);
  if (f.marketStatus !== "ALL") rows = rows.filter((row) => {
    const settlement = model.state?.settlements?.find((item) => item.marketId?.toLowerCase() === row.marketId.toLowerCase());
    if (f.marketStatus === "LIVE") return row.status === 1 && row.secondsLeft > 0;
    if (f.marketStatus === "NO_BOOK") return touch(row).empty;
    if (f.marketStatus === "FINALIZED") return row.lifecycle === "SETTLE" || Boolean(settlement);
    if (f.marketStatus === "VOID") return Boolean(settlement?.voided);
    return row.lifecycle === f.marketStatus;
  });
  if (f.sort === "BIRTH") rows.sort((a, b) => b.expiry - a.expiry);
  else if (f.sort === "ACTIVITY") rows.sort((a, b) => marketRecords(b.marketId).length - marketRecords(a.marketId).length);
  else if (f.sort === "TOUCH") rows.sort((a, b) => Number(touch(b).bid ?? -1) - Number(touch(a).bid ?? -1));
  else if (f.sort === "LIFECYCLE") rows.sort((a, b) => LIFE.indexOf(a.lifecycle) - LIFE.indexOf(b.lifecycle));
  else rows.sort((a, b) => a.expiry - b.expiry);
  return rows;
}

function selectOptions(values, formatter) {
  return join(values.map((value) => '<option value="' + escapeHtml(value) + '">' + escapeHtml(formatter(value)) + "</option>"));
}

function renderMarkets() {
  if (!model.loaded.state) return '<section class="page page-scroll">' + heading("DREAMDEX EVENT CONTRACTS", "Markets unavailable",
    "The official registry snapshot could not be loaded. No market rows are being synthesized.", btn("Retry", "data-refresh")) +
    '<section class="panel">' + empty("UNAVAILABLE", "Check the engine and testnet RPC connection, then retry.") + "</section></section>";
  const rows = filteredMarkets();
  const assets = [...new Set((model.state?.markets || []).map((row) => row.asset))];
  const intervals = [...new Set((model.state?.markets || []).map((row) => row.intervalSec))].sort((a, b) => a - b);
  const body = join(rows.map((row, index) => {
    const book = touch(row);
    const bookCell = book.empty ? "NO BOOK" : '<span class="touch-pair"><b class="up">' +
      (Number.isFinite(book.bid) ? fmt(book.bid, 3) : "—") + '</b><b class="down">' +
      (Number.isFinite(book.ask) ? fmt(book.ask, 3) : "—") + "</b></span>";
    const fills = marketRecords(row.marketId).filter((record) => record.type === "fill").length;
    return '<tr tabindex="0" data-row-index="' + index + '" data-market-row="' + escapeHtml(row.marketId) + '" data-inspect>' +
      '<td><div class="cell-main"><span class="asset-mark">' + escapeHtml(row.asset.slice(0, 3)) +
      '</span><span class="cell-stack"><b>' + escapeHtml(row.asset) + " " + fmt(row.intervalSec / 60, 0) +
      'm</b><small>' + escapeHtml(short(row.marketId)) + "</small></span></div></td>" +
      '<td><div class="cell-stack"><b>' + escapeHtml(row.lifecycle) + "</b><small>" + secondsLeft(row.secondsLeft) + " left</small></div></td>" +
      "<td>" + bookCell + " " + badge("chain") + "</td>" +
      '<td><div class="cell-stack"><b>' + (row.view ? fmt(row.view.opening.value, 2) : "NO DATA") + " " + badge("chain") +
      "</b><small>spot " + (row.view ? fmt(row.view.spot.value, 2) : "NO DATA") + "</small></div></td>" +
      '<td><div class="cell-stack"><b>' + (row.view ? pct(row.view.fairValue.value) : "NO DATA") + " " + badge("model") +
      "</b><small>" + (row.view ? fmt(row.view.fairValue.band[0], 3) + "–" + fmt(row.view.fairValue.band[1], 3) : "UNAVAILABLE") + "</small></div></td>" +
      '<td><div class="cell-stack"><b>' + (model.loaded.journal ? fmt(fills, 0) : "NO DATA") + " " + badge("journal") + "</b><small>fills in loaded journal</small></div></td>" +
      '<td><a class="button button-small button-ghost" href="' + marketPath(row.marketId) + '" data-route>Inspect</a></td></tr>';
  }));
  const table = body
    ? '<table class="data-table"><thead><tr><th style="width:18%">Market</th><th style="width:13%">Lifecycle</th><th style="width:15%">UP touch</th><th style="width:16%">Anchor / spot</th><th style="width:16%">Fair value</th><th style="width:13%">Activity</th><th style="width:9%"></th></tr></thead><tbody>' + body + "</tbody></table>"
    : empty("NO DATA", "No markets match the active filters.", btn("Clear filters", "data-clear-market-filters"));
  const filters = '<div class="filter-bar"><label class="grow">Search<input id="market-search" type="search" value="' +
    escapeHtml(model.filters.marketQuery) + '" placeholder="Asset, market ID, venue, interval…" /></label>' +
    '<label>State<select id="market-status"><option value="ALL">All states</option><option value="LIVE">Live</option><option value="BIRTH">Birth</option><option value="GENESIS">Genesis</option><option value="REPRICE">Reprice</option><option value="ENDGAME">Endgame</option><option value="FINALIZED">Finalized</option><option value="VOID">Void</option><option value="NO_BOOK">No book</option></select></label>' +
    '<label>Asset<select id="market-asset"><option value="ALL">All assets</option>' + selectOptions(assets, (value) => value) + "</select></label>" +
    '<label>Interval<select id="market-interval"><option value="ALL">All intervals</option>' + selectOptions(intervals, (value) => fmt(value / 60, 0) + "m") + "</select></label>" +
    '<label>Sort<select id="market-sort"><option value="EXPIRY">Nearest expiry</option><option value="BIRTH">Newest birth</option><option value="LIFECYCLE">Lifecycle</option><option value="TOUCH">UP touch</option><option value="ACTIVITY">Activity</option></select></label></div>';
  return '<section class="page markets-page" data-scroll-key="markets-page">' + heading("DREAMDEX EVENT CONTRACTS", "Markets",
    "Live windows from the official registry, with chain-derived books and TEMPO estimates.",
    btn("Refresh", "data-refresh") + '<span class="status-pill">UPDATED ' + (model.refreshAt ? time(model.refreshAt) : "UNAVAILABLE") + "</span>") +
    filters + '<section class="panel"><div class="data-table-wrap" data-scroll-key="markets-table">' + table + '</div></section>' +
    '<section class="panel recent-finalized"><div class="panel-head"><h2>Recently finalized</h2><small>CHAIN-DERIVED SETTLEMENT SNAPSHOT</small></div><div class="panel-body scroll-region" data-scroll-key="markets-finalized">' +
    settlements(model.state?.settlements || [], 8) + "</div></section></section>";
}

function sparkline(asset) {
  const values = model.records.filter((row) => row.type === "price" && row.data?.asset === asset && Number.isFinite(Number(row.data?.price))).slice(-80).map((row) => Number(row.data.price));
  if (values.length < 2) return empty("NO DATA", "Not enough official feed samples in the loaded journal window.");
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((value, index) => [index / (values.length - 1) * 100, 79 - (value - min) / span * 70]);
  const line = join(points.map(([x, y], index) => (index ? "L" : "M") + x.toFixed(2) + "," + y.toFixed(2)));
  return '<svg class="sparkline" viewBox="0 0 100 86" preserveAspectRatio="none" role="img" aria-label="' +
    escapeHtml(asset) + ' official feed samples"><path class="area" d="' + line +
    ' L100,86 L0,86 Z"></path><path class="line" d="' + line + '"></path></svg><small>' + values.length +
    " official price-feed samples · range " + fmt(min, 2) + "–" + fmt(max, 2) + " " + badge("chain") + "</small>";
}

function proofTimeline(records, settlement) {
  const types = ["market-birth", "decision", "risk-reject", "order-sent", "order-receipt", "fill", "settlement", "claim"];
  const rows = records.filter((row) => types.includes(row.type)).slice(-12).reverse();
  if (!rows.length && !settlement) return model.loaded.journal ?
    empty("NO EVENTS YET", "No lifecycle evidence is loaded for this market.") :
    empty("UNAVAILABLE", "The operational journal could not be loaded.");
  return '<div class="proof-timeline">' + join(rows.map((row) =>
    '<button class="proof-event" type="button" data-event-id="' + escapeHtml(row.eventId || "") + '"><b>' +
    escapeHtml(row.type.toUpperCase()) + " " + badge(recordSource(row)) + "</b><small>" + escapeHtml(time(row.ts)) + " · " +
    escapeHtml(row.agent || "FIRM") + "<br>" + escapeHtml(recordDetail(row) || short(row.tx || row.marketId)) + "</small></button>")) +
    (settlement ? '<div class="proof-event"><b>SETTLEMENT ' + badge("chain") + "</b><small>" +
      escapeHtml(settlement.voided ? "VOID" : settlement.winningOutcome === 0 ? "UP WON" : settlement.winningOutcome === 1 ? "DOWN WON" : "PENDING") +
      "</small></div>" : "") + "</div>";
}

function renderMarketDetail(id) {
  if (!model.loaded.state) return '<section class="page page-scroll">' + heading("MARKET INSPECTION", "Market state unavailable",
    "TEMPO could not verify the current registry snapshot.") + '<section class="panel">' +
    empty("UNAVAILABLE", "This market cannot be inspected until the engine returns live state.", btn("Retry", "data-refresh")) + "</section></section>";
  const row = market(id);
  if (!row) return '<section class="page page-scroll">' + heading("MARKET INSPECTION", "Market unavailable",
    "This market is not present in the current live snapshot.") + '<section class="panel">' +
    empty("NOT FOUND", "Settled markets leave the live list. Use History or refresh the registry.",
      '<a class="button button-ghost" href="/markets" data-route>Return to markets</a>') + "</section></section>";
  model.selected = row.marketId;
  const records = marketRecords(row.marketId);
  const settlement = model.state?.settlements?.find((item) => item.marketId?.toLowerCase() === row.marketId.toLowerCase());
  const agents = model.state?.agents || [];
  const rejects = records.filter((record) => record.type === "risk-reject");
  const marketContract = records.find((record) => /^0x[0-9a-f]{40}$/i.test(record.contractAddress || ""))?.contractAddress;
  const explorer = marketContract ? explorerUrl("address", marketContract) : null;
  const idLine = '<div class="detail-id"><span>' + escapeHtml(row.marketId) + '</span><button class="copy-button" data-copy="' +
    escapeHtml(row.marketId) + '">Copy</button>' + (explorer ? '<a class="text-link" href="' + escapeHtml(explorer) +
    '" target="_blank" rel="noopener noreferrer">Explorer ↗</a>' : "") + "</div>";
  const header = '<header class="page-header"><div><div class="breadcrumb"><a href="/markets" data-route>Markets</a><span>/</span><span>' +
    escapeHtml(row.asset) + " " + fmt(row.intervalSec / 60, 0) + "m</span>" + badge("chain") + "</div><h1>" +
    escapeHtml(row.asset) + " " + fmt(row.intervalSec / 60, 0) + "m · " + escapeHtml(row.lifecycle) + "</h1>" + idLine +
    '</div><div class="page-actions"><div class="detail-clock">' + secondsLeft(row.secondsLeft) +
    '</div><button class="button button-primary" data-open-wallet>Trade IOC</button><a class="button button-ghost" href="/history?market=' +
    encodeURIComponent(row.marketId) + '" data-route>Audit trail</a></div></header>';
  return '<section class="page market-detail-page">' + header + '<div class="detail-grid">' +
    '<section class="panel detail-book"><div class="panel-head"><h2>UP order book</h2><small>' +
    (row.view?.bookAt ? utc(row.view.bookAt) : "PENDING") + " · " + badge("chain") +
    '</small></div><div class="panel-body scroll-region" data-scroll-key="detail-book">' + renderBook(row.view, 12) + '<div class="drawer-divider"></div>' +
    marketFacts(row) + '<div class="drawer-divider"></div><div class="section-kicker"><span>OFFICIAL PRICE FEED</span><span>' +
    escapeHtml(row.asset) + "</span></div>" + sparkline(row.asset) + "</div></section>" +
    '<section class="panel detail-fair"><div class="panel-head"><h2>Fair-value engine</h2><small>ESTIMATE, NEVER ORACLE</small></div><div class="panel-body scroll-region" data-scroll-key="detail-fair">' +
    renderFairValue(row.view) + lifecycle(row.lifecycle, true) + "</div></section>" +
    '<section class="panel detail-agents"><div class="panel-head"><h2>Agents & risk decisions</h2><small>' + (model.loaded.journal ? fmt(rejects.length, 0) : "NO DATA") +
    ' REJECTS LOADED</small></div><div class="panel-body scroll-region" data-scroll-key="detail-agents"><div class="agent-stack">' +
    join(agents.map(agentCard)) + '</div><div class="drawer-divider"></div>' +
    (rejects.length ? activityRows(rejects, 6) : model.loaded.journal ? empty("NO DATA", "No risk rejection is loaded for this market. Policy limits remain active.") :
      empty("UNAVAILABLE", "The operational journal could not be loaded. Policy limits remain active.")) +
    "</div></section>" +
    '<section class="panel detail-proof"><div class="panel-head"><h2>Lifecycle proof</h2><small>JOURNAL → CHAIN</small></div><div class="panel-body scroll-region" data-scroll-key="detail-proof">' +
    proofTimeline(records, settlement) + '<div class="drawer-divider"></div><div class="section-kicker"><span>SETTLEMENT</span>' +
    badge("chain") + "</div>" + (settlement ? settlements([settlement], 1) : empty("PENDING", "The market has not appeared in the finalized settlement snapshot.")) +
    briefing() + "</div></section></div></section>";
}

function filteredHistory() {
  const f = model.filters;
  const marketParam = new URLSearchParams(location.search).get("market");
  let rows = [...model.records];
  if (marketParam) rows = rows.filter((row) => row.marketId?.toLowerCase() === marketParam.toLowerCase());
  if (f.historyTab === "OPERATIONS") rows = rows.filter((row) => !["price", "market-state"].includes(row.type));
  if (f.historyTab === "ORDERS") rows = rows.filter((row) => row.type.startsWith("order-"));
  if (f.historyTab === "FILLS") rows = rows.filter((row) => row.type === "fill");
  if (f.historyTab === "SETTLEMENTS") rows = rows.filter((row) => ["settlement", "claim"].includes(row.type));
  if (f.historyTab === "RISK") rows = rows.filter((row) => row.type === "risk-reject");
  if (f.historyTab === "JOURNAL") rows = rows.filter((row) => !row.tx);
  if (f.historyWindow !== "ALL") {
    const cutoff = Date.now() - Number(f.historyWindow) * 60 * 60 * 1000;
    rows = rows.filter((row) => new Date(row.ts).valueOf() >= cutoff);
  }
  if (f.historyType !== "ALL") rows = rows.filter((row) => row.type === f.historyType);
  if (f.historyAsset !== "ALL") rows = rows.filter((row) => (market(row.marketId)?.asset || row.data?.asset || row.symbol || "").includes(f.historyAsset));
  if (f.historyInterval !== "ALL") rows = rows.filter((row) => String(market(row.marketId)?.intervalSec || row.data?.intervalSec || "") === f.historyInterval);
  if (f.historyAgent !== "ALL") rows = rows.filter((row) => (row.agent || "FIRM") === f.historyAgent);
  if (f.historySource !== "ALL") rows = rows.filter((row) => recordSource(row) === f.historySource);
  if (f.historyStatus !== "ALL") rows = rows.filter((row) => recordStatus(row) === f.historyStatus);
  const query = f.historyQuery.trim().toLowerCase();
  if (query) rows = rows.filter((row) => JSON.stringify(row).toLowerCase().includes(query));
  return rows;
}

function renderHistory() {
  if (!model.loaded.journal) return '<section class="page page-scroll">' + heading("AUDITABLE BY DESIGN", "History unavailable",
    "The operational journal could not be loaded. An empty activity stream is not being implied.", btn("Retry", "data-refresh")) +
    '<section class="panel">' + empty("UNAVAILABLE", "Check the engine connection and retry the journal read.") + "</section></section>";
  const records = filteredHistory();
  const tabs = [["OPERATIONS", "Operations"], ["ALL", "All events"], ["ORDERS", "Orders"], ["FILLS", "Fills"], ["SETTLEMENTS", "Settlements"], ["RISK", "Risk decisions"], ["JOURNAL", "Journal only"]];
  const agents = [...new Set(model.records.map((row) => row.agent || "FIRM"))].sort();
  const eventTypes = [...new Set(model.records.map((row) => row.type).filter(Boolean))].sort();
  const assets = [...new Set((model.state?.markets || []).map((row) => row.asset))].sort();
  const intervals = [...new Set((model.state?.markets || []).map((row) => row.intervalSec))].sort((a, b) => a - b);
  const rows = join(records.slice().reverse().map((record, index) => {
    const status = recordStatus(record);
    const source = recordSource(record);
    const evidence = record.tx
      ? '<button class="text-link mono" type="button" data-tx="' + escapeHtml(record.tx) + '">' + escapeHtml(short(record.tx)) + "</button>"
      : '<button class="text-link" type="button" data-event-id="' + escapeHtml(record.eventId || "") + '">Inspect</button>';
    return '<tr tabindex="0" data-row-index="' + index + '" data-event-id="' + escapeHtml(record.eventId || "") + '" data-inspect>' +
      '<td><div class="cell-stack"><b>' + escapeHtml(time(record.ts)) + "</b><small>" + escapeHtml(utc(record.ts).slice(0, 10)) + "</small></div></td>" +
      "<td>" + escapeHtml(record.agent || "FIRM") + '</td><td><div class="cell-stack"><b>' + escapeHtml(record.type) +
      "</b><small>" + escapeHtml(short(record.decisionId, 8, 5)) + "</small></div></td>" +
      '<td><div class="cell-stack"><b>' + escapeHtml(record.symbol || short(record.marketId)) + "</b><small>" +
      escapeHtml(short(record.marketId)) + "</small></div></td><td>" +
      escapeHtml(short(recordDetail(record), 22, 6)) + "</td><td>" + badge(source) + '</td><td><span class="event-status ' +
      status + '"><i></i>' + escapeHtml(status.toUpperCase()) + "</span></td><td>" + evidence + "</td></tr>";
  }));
  const table = rows
    ? '<table class="data-table"><thead><tr><th style="width:10%">UTC time</th><th style="width:9%">Actor</th><th style="width:12%">Event</th><th style="width:18%">Market</th><th style="width:19%">Decision / result</th><th style="width:12%">Source</th><th style="width:10%">Status</th><th style="width:10%">Evidence</th></tr></thead><tbody>' + rows + "</tbody></table>"
    : empty("NO EVENTS YET", "No journal records match these filters.");
  const tabBar = '<div class="segment-control history-tabs">' + join(tabs.map(([value, label]) =>
    '<button class="' + (model.filters.historyTab === value ? "active" : "") + '" type="button" data-history-tab="' + value + '">' + label + "</button>")) + "</div>";
  const filters = '<div class="filter-bar"><label class="grow">Search<input id="history-search" type="search" value="' +
    escapeHtml(model.filters.historyQuery) + '" placeholder="Market, hash, reason, event…" /></label>' +
    '<label>Agent<select id="history-agent"><option value="ALL">All actors</option>' + selectOptions(agents, (value) => value) + "</select></label>" +
    '<label>Window<select id="history-window"><option value="ALL">Loaded window</option><option value="1">Last hour</option><option value="24">Last 24 hours</option><option value="168">Last 7 days</option></select></label>' +
    '<label>Asset<select id="history-asset"><option value="ALL">All assets</option>' + selectOptions(assets, (value) => value) + "</select></label>" +
    '<label>Interval<select id="history-interval"><option value="ALL">All intervals</option>' + selectOptions(intervals, (value) => fmt(value / 60, 0) + "m") + "</select></label>" +
    '<label>Event type<select id="history-type"><option value="ALL">All event types</option>' + selectOptions(eventTypes, (value) => value) + "</select></label>" +
    '<label>Provenance<select id="history-source"><option value="ALL">All sources</option><option value="chain">Chain facts</option><option value="model">Model estimates</option><option value="policy">Policy</option><option value="journal">Journal only</option></select></label>' +
    '<label>Status<select id="history-status"><option value="ALL">All states</option><option value="confirmed">Confirmed</option><option value="pending">Pending</option><option value="rejected">Rejected</option><option value="failed">Failed</option><option value="journal">Journal</option></select></label></div>';
  return '<section class="page history-page">' + heading("AUDITABLE BY DESIGN", "History",
    "Every journal decision, risk gate, order, fill, and settlement in the loaded operational window.", btn("Refresh", "data-refresh")) +
    "<div>" + tabBar + filters + '</div><section class="panel"><div class="data-table-wrap" data-scroll-key="history-table">' + table + "</div></section></section>";
}

async function ensureDocs() {
  if (model.docs !== null) return;
  try {
    const response = await fetch(apiUrl("/docs.html"));
    if (!response.ok) throw new Error("docs " + response.status);
    const source = await response.text();
    const parsed = new DOMParser().parseFromString(source, "text/html");
    const article = parsed.querySelector(".doc-inner");
    if (!article) throw new Error("documentation content missing");
    article.querySelectorAll("script").forEach((node) => node.remove());
    article.querySelectorAll('a[href="/"]').forEach((link) => link.setAttribute("href", "/dashboard"));
    article.querySelectorAll("a[href]").forEach((link) => {
      const href = link.getAttribute("href");
      if (href?.startsWith("#")) link.setAttribute("href", "/docs" + href);
    });
    model.docs = article.innerHTML;
  } catch {
    model.docs = "";
  }
}

function docsToc() {
  const host = document.createElement("div");
  host.innerHTML = model.docs || "";
  return [...host.querySelectorAll(".doc-section")].map((section) => ({
    id: section.id,
    title: section.dataset.title || section.querySelector("h2,h1")?.textContent || section.id,
  }));
}

function renderDocs() {
  if (model.docs === null) return '<section class="page">' + empty("Loading…", "Preparing the operator and developer reference.") + "</section>";
  if (!model.docs) return '<section class="page">' + empty("UNAVAILABLE", "The bundled documentation could not be loaded.", btn("Retry", "data-retry-docs")) + "</section>";
  const toc = docsToc();
  return '<section class="page docs-page"><aside class="docs-sidebar-spa" data-scroll-key="docs-navigation"><input class="docs-search" id="docs-search-spa" type="search" placeholder="Search docs…" />' +
    '<nav class="docs-toc" aria-label="Documentation sections">' + join(toc.map((item) =>
      '<a href="/docs#' + escapeHtml(item.id) + '" data-route>' + escapeHtml(item.title) + "</a>")) +
    '</nav></aside><main class="docs-content-spa" id="docs-scroll" data-scroll-key="docs-content"><div class="docs-article">' +
    '<div class="boundary-banner"><span>◇</span><span>Technical claims below are scoped by cited repository evidence and report dates. Live observatory values come from the current engine snapshot.</span></div>' +
    model.docs + "</div></main></section>";
}

function renderProtocol() {
  const state = model.state;
  const live = state?.live;
  const risk = state?.risk;
  const agents = state?.agents || [];
  const facts = [
    ["Network", live?.network || "UNAVAILABLE", "chain"],
    ["Runtime mode", state ? (live.dryRun ? "DRY RUN" : "LIVE WRITES") : "UNAVAILABLE", "derived"],
    ["Live event tail", state ? (live.tailing ? "CONNECTED" : "DISCONNECTED") : "UNAVAILABLE", "derived"],
    ["Watched feeds", state ? (live.priceWatches?.length ? live.priceWatches.join(" · ") : "NO DATA") : "UNAVAILABLE", "chain"],
    ["Active agents", model.loaded.state ? fmt(agents.length, 0) : "NO DATA", "derived"],
    ["Auction Vault", "0x75ff53...5c3", "chain"],
    ["Snapshot time", state?.at ? utc(state.at) : "UNAVAILABLE", "derived"],
  ];
  const riskRows = risk ? join(Object.entries(risk).map(([key, value]) =>
    '<div class="protocol-row"><span>' + escapeHtml(key.replace(/([A-Z])/g, " $1")) + '</span><b>' + escapeHtml(value) + '</b>' + badge("policy") + '</div>')) :
    empty("UNAVAILABLE", "The current engine snapshot did not include RiskEngine policy.");
  const agentRows = agents.length ? join(agents.map((agent) =>
    '<article class="protocol-agent"><div><span class="eyebrow">AUTONOMOUS POLICY</span><h3>' + escapeHtml(agent.name) + '</h3></div>' +
    '<span class="prov ' + (agent.readOnly ? "derived" : "chain") + '">' + mode(agent) + '</span><p>' +
    escapeHtml(agent.name === "GENESIS" ? "Post-only liquidity, inventory-aware repricing, and mandatory order expiry." :
      "Independent opportunity detection, IOC-only execution, and bounded collateral exposure.") + '</p><button class="text-link" type="button" data-agent="' +
    escapeHtml(agent.name) + '">Inspect live agent ↗</button></article>')) : empty("NO DATA", "Agent state is unavailable.");
  const vaultPanel = '<section class="panel"><div class="panel-head"><h2>Verified On-Chain Contracts</h2><small>SOMNIA SHANNON 50312</small></div><div class="panel-body protocol-rows">' +
    '<div class="protocol-row"><span>TempoAuctionVault.sol</span><b><a href="https://shannon-explorer.somnia.network/address/0x75ff5310d736fa06e8813d8665d729df55e3c5c3#code" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">0x75ff53...5c3 ↗</a></b><span class="prov chain">CHAIN FACT</span></div>' +
    '<div class="protocol-row"><span>Contract Standard</span><b>ERC-4626 Tokenized Vault</b><span class="prov policy">POLICY</span></div>' +
    '<div class="protocol-row"><span>Operator Authority</span><b>GENESIS (0xE7a8...8c7a)</b><span class="prov chain">CHAIN FACT</span></div>' +
    '<div class="protocol-row"><span>Underlying Asset</span><b>tUSDC (6 decimals)</b><span class="prov chain">CHAIN FACT</span></div>' +
    '</div></section>';
  return '<section class="page protocol-page"><div class="protocol-inner">' +
    heading("SYSTEM ARCHITECTURE", "A firm designed to be inspected",
      "TEMPO keeps discovery, estimation, policy, execution, and proof distinct—then exposes the live boundary of each layer.",
      '<a class="button button-primary" href="/docs" data-route>Open technical docs ↗</a>') +
    '<section class="protocol-facts">' + join(facts.map(([label, value, source]) => fact(label, value, source))) + '</section>' +
    '<section class="protocol-flow" aria-label="TEMPO execution flow"><article><span>01</span><h2>Discover</h2><p>Read canonical DreamDEX windows and keep market identity keyed by the on-chain market ID.</p></article>' +
    '<article><span>02</span><h2>Estimate</h2><p>Combine official spot history, the on-chain opening boundary, realized volatility, and time remaining.</p></article>' +
    '<article><span>03</span><h2>Gate</h2><p>Validate status, tick and lot grids, expiry, inventory, collateral, order count, and firm-wide limits.</p></article>' +
    '<article><span>04</span><h2>Prove</h2><p>Wait for successful receipts and retain decisions, fills, settlements, oracle evidence, and claims in the journal.</p></article></section>' +
    '<div class="protocol-columns"><section class="panel"><div class="panel-head"><h2>Live RiskEngine boundary</h2><small>CURRENT SNAPSHOT</small></div><div class="panel-body protocol-rows">' + riskRows + '</div></section>' +
    vaultPanel +
    '<section class="protocol-agents">' + agentRows + '</section></div>' +
    '<section class="protocol-truth"><span class="eyebrow">PROVENANCE IS PART OF THE UI</span><h2>Facts stay facts.<br><em>Estimates stay estimates.</em></h2><p>Chain data, derived values, policy limits, journal events, and optional commentary carry visible source labels. When a required source is missing, TEMPO renders NO DATA or UNAVAILABLE instead of inventing continuity.</p></section>' +
    '</div></section>';
}

const SCROLL_SELECTOR = "[data-scroll-key], .scroll-region, .data-table-wrap, .docs-content-spa, .docs-sidebar-spa, .page-scroll, .pricing-page, .protocol-page, .landing";

function captureScrollPositions(host) {
  const positions = new Map();
  const occurrences = new Map();
  host.querySelectorAll(SCROLL_SELECTOR).forEach((node) => {
    const base = node.dataset.scrollKey || [...node.classList].sort().join(".") || node.tagName.toLowerCase();
    const occurrence = occurrences.get(base) || 0;
    occurrences.set(base, occurrence + 1);
    positions.set(base + ":" + occurrence, { top: node.scrollTop, left: node.scrollLeft });
  });
  return positions;
}

function restoreScrollPositions(host, positions) {
  const occurrences = new Map();
  host.querySelectorAll(SCROLL_SELECTOR).forEach((node) => {
    const base = node.dataset.scrollKey || [...node.classList].sort().join(".") || node.tagName.toLowerCase();
    const occurrence = occurrences.get(base) || 0;
    occurrences.set(base, occurrence + 1);
    const position = positions.get(base + ":" + occurrence);
    if (!position) return;
    node.scrollTop = position.top;
    node.scrollLeft = position.left;
  });
}

function renderRoute(options = {}) {
  const host = $("main-content");
  if (!host) return;
  host.classList.toggle("live-refresh", !options.animate);
  const scrollPositions = options.preserve ? captureScrollPositions(host) : null;
  const route = path();
  let html;
  if (route === "/") html = renderLanding();
  else if (route === "/dashboard") html = renderDashboard();
  else if (route === "/markets") html = renderMarkets();
  else if (route.startsWith("/markets/")) html = renderMarketDetail(decodeURIComponent(route.slice(9)));
  else if (route === "/history") html = renderHistory();
  else if (route === "/docs") html = renderDocs();
  else if (route === "/protocol" || route === "/pricing") html = renderProtocol();
  else html = '<section class="page page-scroll">' + heading("404", "Route not found", "The requested TEMPO surface does not exist.") +
    '<a class="button button-primary" href="/dashboard" data-route>Open dashboard</a></section>';
  host.innerHTML = html;
  updateNavigation();
  restoreSelects();
  bindPage();
  if (scrollPositions) restoreScrollPositions(host, scrollPositions);
  if (route === "/docs" && location.hash) requestAnimationFrame(() => {
    const id = location.hash.slice(1);
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  });
}

function updateNavigation() {
  const base = routeBase() === "/pricing" ? "/protocol" : routeBase();
  document.querySelectorAll(".primary-nav a, .mobile-menu nav a").forEach((link) => link.classList.toggle("active", link.getAttribute("href") === base));
  const title = base === "/" ? "Autonomous Opening Auction" : base.slice(1).replace(/^\w/, (letter) => letter.toUpperCase());
  document.title = "TEMPO — " + title;
}

function restoreSelects() {
  const values = {
    "market-status": model.filters.marketStatus, "market-asset": model.filters.asset,
    "market-interval": model.filters.interval, "market-sort": model.filters.sort,
    "history-agent": model.filters.historyAgent, "history-source": model.filters.historySource,
    "history-status": model.filters.historyStatus, "history-window": model.filters.historyWindow,
    "history-asset": model.filters.historyAsset, "history-interval": model.filters.historyInterval,
    "history-type": model.filters.historyType,
  };
  Object.entries(values).forEach(([id, value]) => { if ($(id)) $(id).value = value; });
}

function inputFilter(id, key) {
  $(id)?.addEventListener("input", (event) => {
    model.filters[key] = event.target.value;
    renderRoute();
    const field = $(id);
    field?.focus();
    field?.setSelectionRange?.(field.value.length, field.value.length);
  });
}
function changeFilter(id, key) {
  $(id)?.addEventListener("change", (event) => { model.filters[key] = event.target.value; renderRoute(); });
}
function bindPage() {
  $("ai-summary")?.addEventListener("click", refreshNarrative);
  inputFilter("market-search", "marketQuery");
  inputFilter("history-search", "historyQuery");
  changeFilter("market-status", "marketStatus");
  changeFilter("market-asset", "asset");
  changeFilter("market-interval", "interval");
  changeFilter("market-sort", "sort");
  changeFilter("history-agent", "historyAgent");
  changeFilter("history-window", "historyWindow");
  changeFilter("history-asset", "historyAsset");
  changeFilter("history-interval", "historyInterval");
  changeFilter("history-type", "historyType");
  changeFilter("history-source", "historySource");
  changeFilter("history-status", "historyStatus");
  $("docs-search-spa")?.addEventListener("input", searchDocs);
}

function uiIsBusy() {
  if (document.querySelector(".overlay:not([hidden]), .drawer-backdrop:not([hidden]), .mobile-menu:not([hidden])")) return true;
  const active = document.activeElement;
  return Boolean(active && active !== document.body && active !== $("main-content") &&
    active.matches("input, select, textarea, button, a, [data-inspect]"));
}

function scheduleLiveRender(delay = 80) {
  if (model.liveRenderTimer !== null) return;
  model.liveRenderTimer = window.setTimeout(() => {
    model.liveRenderTimer = null;
    if (!uiIsBusy() && ["/dashboard", "/history", "/markets"].includes(routeBase())) renderRoute({ preserve: true });
  }, delay);
}

function navigate(href, replace = false) {
  const url = new URL(href, location.origin);
  if (url.origin !== location.origin) return;
  history[replace ? "replaceState" : "pushState"](null, "", url.pathname + url.search + url.hash);
  closeOverlays();
  if (url.pathname === "/docs" && model.docs === null) void loadDocs();
  else renderRoute({ animate: true });
  $("main-content")?.focus({ preventScroll: true });
}

async function loadDocs() {
  renderRoute();
  await ensureDocs();
  if (path() === "/docs") renderRoute();
}

function updateChrome() {
  const state = model.state;
  const net = $("pill-net");
  if (net) {
    net.classList.toggle("online", Boolean(state));
    net.classList.toggle("offline", !state);
    net.innerHTML = '<i></i><span>' + escapeHtml(state?.live?.network?.toUpperCase() || "UNAVAILABLE") + "</span>";
  }
  if ($("footer-status")) $("footer-status").textContent = state ? "Engine snapshot " + time(state.at) : "TEMPO engine unavailable";
  if ($("mobile-menu-network")) $("mobile-menu-network").textContent = state ?
    "NETWORK · " + String(state.live.network || "UNAVAILABLE").toUpperCase() + " · " + (state.live.dryRun ? "DRY RUN" : "LIVE") :
    "NETWORK · UNAVAILABLE";
  const beacon = document.querySelector(".status-rail .live-beacon");
  beacon?.classList.toggle("online", Boolean(state));
  beacon?.classList.toggle("offline", !state);
  const explorer = safeHttpsUrl(model.walletConfig?.explorerUrl);
  if ($("footer-explorer")) {
    $("footer-explorer").hidden = !explorer;
    if (explorer) $("footer-explorer").href = explorer;
  }
}

async function getJson(url) {
  const response = await fetch(apiUrl(url), { headers: { Accept: "application/json" } });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error || url + " " + response.status);
  return body;
}

async function refreshState(force = false) {
  try {
    const state = await getJson("/api/state");
    if (!state?.live || !Array.isArray(state.markets) || !Array.isArray(state.agents) || !Array.isArray(state.settlements)) throw new Error("invalid state payload");
    model.state = state;
    model.loaded.state = true;
    model.refreshAt = state.at;
    window.dispatchEvent(new CustomEvent("tempo:state", { detail: state }));
    updateChrome();
    if (force) renderRoute({ preserve: true });
    else scheduleLiveRender();
  } catch (error) {
    model.state = null;
    model.loaded.state = false;
    model.stream = "UNAVAILABLE";
    updateChrome();
    if (force) renderRoute();
    toast("State unavailable · " + (error instanceof Error ? error.message : "request failed"));
  }
}

async function refreshJournal() {
  try {
    const body = await getJson("/api/journal?n=300");
    model.records = Array.isArray(body.records) ? body.records : [];
    model.loaded.journal = true;
  } catch {
    model.records = [];
    model.loaded.journal = false;
  }
}

async function refreshStats(force = false) {
  try {
    model.stats = await getJson("/api/stats");
    model.loaded.stats = true;
    if (force && path() === "/dashboard") renderRoute({ preserve: true });
  } catch {
    model.stats = null;
    model.loaded.stats = false;
  }
}

function scheduleStatsRefresh(delay = 350) {
  clearTimeout(model.statsRefreshTimer);
  model.statsRefreshTimer = setTimeout(() => {
    model.statsRefreshTimer = null;
    void refreshStats(true);
  }, delay);
}

async function refreshNarrative() {
  const button = $("ai-summary");
  const text = $("ai-narrative-text");
  const meta = $("ai-narrative-meta");
  if (!button || !text || !meta) return;
  button.disabled = true;
  button.textContent = "Generating…";
  text.textContent = "Sending current journal metrics for optional narration…";
  try {
    const body = await getJson("/api/narrative");
    if (body.status !== "READY" || typeof body.text !== "string") {
      text.textContent = body.reason || "LLM narration not configured — deterministic mode";
      meta.textContent = "LLM COMMENTARY unavailable · journal metrics remain authoritative";
    } else {
      text.textContent = body.text;
      meta.textContent = "LLM COMMENTARY · " + (body.model || "model") + " · " + (body.generatedAt || "generation time unavailable") + " · never controls execution";
    }
  } catch {
    text.textContent = "LLM narration unavailable — deterministic mode";
    meta.textContent = "Journal metrics remain authoritative.";
  } finally {
    button.disabled = false;
    button.textContent = "Generate";
  }
}

function startStream() {
  model.eventSource?.close();
  const stream = new EventSource(apiUrl("/api/stream"));
  model.eventSource = stream;
  stream.onopen = () => { model.stream = "TAIL LIVE"; updateChrome(); };
  stream.onmessage = (event) => {
    let record;
    try { record = JSON.parse(event.data); } catch { return; }
    if (!record || typeof record !== "object") return;
    if (record.type === "market-birth" && record.marketId) {
      model.births.add(record.marketId);
      setTimeout(() => model.births.delete(record.marketId), 1900);
    }
    model.records.push(record);
    if (model.records.length > 600) model.records.splice(0, model.records.length - 400);
    if (["market-birth", "decision", "order-sent", "order-receipt", "order-cancelled", "fill", "risk-reject", "settlement", "claim", "error"].includes(record.type)) {
      scheduleLiveRender(120);
      scheduleStatsRefresh();
    }
  };
  stream.onerror = () => { model.stream = "POLL FALLBACK"; updateChrome(); };
}

let overlayReturnFocus = null;
function openOverlay(id, selector) {
  const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  closeOverlays(false);
  const overlay = $(id);
  if (!overlay) return;
  overlayReturnFocus = trigger;
  overlay.hidden = false;
  document.body.style.overflow = "hidden";
  requestAnimationFrame(() => overlay.querySelector(selector || "button, input, select, [tabindex]")?.focus());
}
function closeOverlay(id) {
  if ($(id)) $(id).hidden = true;
  if (!document.querySelector(".overlay:not([hidden]), .drawer-backdrop:not([hidden])")) {
    document.body.style.overflow = "";
    overlayReturnFocus?.focus();
    overlayReturnFocus = null;
  }
}
function closeOverlays(restore = true) {
  document.querySelectorAll(".overlay, .drawer-backdrop").forEach((node) => { node.hidden = true; });
  if ($("mobile-menu")) $("mobile-menu").hidden = true;
  $("menu-open")?.setAttribute("aria-expanded", "false");
  document.body.style.overflow = "";
  if (restore) overlayReturnFocus?.focus();
  overlayReturnFocus = null;
}
function openWallet() { openOverlay("wallet-overlay", "#wallet-connect"); }
function dismissOnboarding(destination) {
  try { localStorage.setItem("tempo_onboarded", "1"); } catch { /* Storage may be unavailable in hardened browsing modes. */ }
  closeOverlay("onboarding-overlay");
  if (destination === "dashboard") navigate("/dashboard");
  if (destination === "wallet") openWallet();
}
function showFirstVisitOnboarding() {
  let onboarded = false;
  try { onboarded = localStorage.getItem("tempo_onboarded") === "1"; } catch { /* Show the guide when storage is unavailable. */ }
  if (!onboarded) openOverlay("onboarding-overlay", "[data-onboarding=dashboard]");
}
function findRecord(id) { return model.records.find((row) => row.eventId === id); }

function openProof(hash) {
  if (!HASH.test(hash)) return;
  const related = model.records.filter((row) => row.tx?.toLowerCase() === hash.toLowerCase());
  const receipt = related.find((row) => row.type === "order-receipt") || related.at(-1);
  const walletProof = model.walletProofs.get(hash.toLowerCase());
  const status = walletProof?.status || (receipt ? recordStatus(receipt) : "not found");
  const explorer = explorerUrl("tx", hash);
  const actions = '<button class="copy-button" data-copy="' + escapeHtml(hash) + '">Copy hash</button>' +
    (explorer ? '<a class="button button-small button-primary" href="' + escapeHtml(explorer) + '" target="_blank" rel="noopener noreferrer">Open explorer ↗</a>' : "");
  $("proof-content").innerHTML = '<div class="drawer-section"><div class="section-kicker"><span>TRANSACTION</span>' + badge("chain") +
    '</div><code class="full-hash">' + escapeHtml(hash) + '</code><div class="page-actions" style="margin-top:10px">' + actions +
    '</div></div><div class="drawer-section"><h3>Verification state</h3><div class="drawer-grid"><div><span>Status</span><b>' +
    escapeHtml(status.toUpperCase()) + '</b></div><div><span>Block</span><b>' + escapeHtml(receipt?.block || receipt?.data?.block || walletProof?.block || "UNAVAILABLE") +
    '</b></div><div><span>Actor</span><b>' + escapeHtml(receipt?.agent || short(walletProof?.account) || "UNAVAILABLE") + '</b></div><div><span>Market</span><b>' +
    escapeHtml(short(receipt?.marketId || walletProof?.marketId)) + '</b></div><div><span>Event time</span><b>' + escapeHtml(receipt ? utc(receipt.ts) : walletProof?.at ? utc(walletProof.at) : "UNAVAILABLE") +
    '</b></div><div><span>Receipt result</span><b>' + escapeHtml(receipt?.data?.status || (walletProof ? status.toUpperCase() : receipt ? "CONFIRMED" : "NOT FOUND")) +
    "</b></div></div>" + (!receipt && !walletProof ? empty("NOT FOUND", "This hash is outside the loaded journal window. Use the explorer for direct chain lookup.") : "") +
    '</div><div class="drawer-section"><h3>Related evidence</h3>' + (related.length ? activityRows(related, 20) : empty("NO DATA")) + "</div>";
  openOverlay("proof-overlay", ".close-button");
}

function openAudit(record) {
  if (!record) return;
  const related = record.decisionId ? model.records.filter((row) => row.decisionId === record.decisionId) : [];
  const explorer = record.tx ? explorerUrl("tx", record.tx) : null;
  const txActions = record.tx ? '<div class="page-actions" style="margin-top:12px"><button class="button button-small button-ghost" data-tx="' +
    escapeHtml(record.tx) + '">Transaction proof</button>' + (explorer ? '<a class="button button-small button-primary" href="' +
      escapeHtml(explorer) + '" target="_blank" rel="noopener noreferrer">Explorer ↗</a>' : "") + "</div>" : "";
  $("audit-title").textContent = "Event inspection";
  $("audit-content").innerHTML = '<div class="drawer-section"><div class="section-kicker"><span>' + escapeHtml(record.type.toUpperCase()) +
    "</span>" + badge(recordSource(record)) + '</div><div class="drawer-grid"><div><span>Timestamp</span><b>' + escapeHtml(utc(record.ts)) +
    '</b></div><div><span>Actor</span><b>' + escapeHtml(record.agent || "FIRM") + '</b></div><div><span>Market</span><b>' +
    escapeHtml(short(record.marketId)) + '</b></div><div><span>Status</span><b>' + escapeHtml(recordStatus(record).toUpperCase()) +
    '</b></div><div><span>Source</span><b>' + escapeHtml(record.source || "journal") + '</b></div><div><span>Decision ID</span><b>' +
    escapeHtml(short(record.decisionId)) + "</b></div></div>" + txActions + '</div><div class="drawer-section"><h3>Sanitized event payload</h3><pre class="json-view">' +
    escapeHtml(JSON.stringify(record, null, 2)) + '</pre></div><div class="drawer-section"><h3>Correlated decision sequence</h3>' +
    (related.length ? activityRows(related, 30) : empty("NO DATA", "No correlated events are loaded for this decision ID.")) + "</div>";
  openOverlay("audit-overlay", ".close-button");
}

function openAgent(name) {
  const agent = model.state?.agents?.find((row) => row.name === name);
  if (!agent) return;
  const records = model.records.filter((row) => row.agent === name);
  $("audit-title").textContent = name + " agent";
  $("audit-content").innerHTML = '<div class="drawer-section"><div class="section-kicker"><span>AUTONOMOUS AGENT</span><span class="prov ' +
    (agent.readOnly ? "derived" : "chain") + '">' + mode(agent) + '</span></div><div class="drawer-grid"><div><span>Address</span><b>' +
    escapeHtml(agent.address || "No signer configured") + '</b></div><div><span>Collateral ' + badge("chain") + "</span><b>" +
    (agent.collateral ? fmt(agent.collateral.human) : "UNAVAILABLE") + '</b></div><div><span>Realized P&amp;L ' + badge("derived") +
    "</span><b>" + (agent.readOnly ? "UNAVAILABLE" : fmt(agent.realizedPnl)) + '</b></div><div><span>Inventory ' + badge("derived") +
    "</span><b>" + (agent.inventory ? fmt(inventory(agent), 3) : "UNAVAILABLE") + '</b></div><div><span>Working orders ' + badge("chain") +
    "</span><b>" + (agent.readOnly ? "UNAVAILABLE" : fmt(agent.openOrders, 0)) + '</b></div><div><span>Last action</span><b>' +
    (agent.lastActionAt ? utc(agent.lastActionAt) : "NO DATA") + "</b></div></div></div>" +
    '<div class="drawer-section"><h3>Policy boundary</h3><p class="settings-note">' +
    (name === "GENESIS" ? "Liquidity-genesis maker: post-only two-sided quotes, inventory skew, adaptive spread, mandatory expiry." :
      "Adversarial taker: independent estimate, edge threshold, IOC-only execution, bounded collateral.") +
    ' Every plan passes the shared deterministic RiskEngine.</p></div><div class="drawer-section"><h3>Latest loaded activity</h3>' +
    activityRows(records, 25) + "</div>";
  openOverlay("audit-overlay", ".close-button");
}

function openRisk(label) {
  const risk = model.state?.risk;
  const rejects = model.records.filter((row) => row.type === "risk-reject");
  $("audit-title").textContent = label + " policy";
  $("audit-content").innerHTML = '<div class="drawer-section"><div class="section-kicker"><span>RISKENGINE CONTROLS</span>' + badge("policy") +
    "</div>" + (risk ? '<div class="drawer-grid">' + join(Object.entries(risk).map(([key, value]) =>
      "<div><span>" + escapeHtml(key) + "</span><b>" + escapeHtml(value) + "</b></div>")) + "</div>" :
      empty("UNAVAILABLE", "Risk policy was not present in the snapshot.")) + '</div><div class="drawer-section"><h3>Recent rejection evidence</h3>' +
    (rejects.length ? activityRows(rejects, 30) : empty("NO DATA", "No risk-reject event is loaded. This does not mean controls are disabled.")) + "</div>";
  openOverlay("audit-overlay", ".close-button");
}

function toast(message) {
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  $("toast-region")?.append(node);
  setTimeout(() => node.remove(), 3000);
}
async function copyText(value) {
  try { await navigator.clipboard.writeText(value); toast("Copied to clipboard"); }
  catch { toast("Clipboard unavailable"); }
}

function commandItems() {
  const base = [
    { label: "Open dashboard", detail: "1 · Live command center", href: "/dashboard" },
    { label: "Browse markets", detail: "2 · Current DreamDEX windows", href: "/markets" },
    { label: "Open history", detail: "3 · Journal and chain evidence", href: "/history" },
    { label: "Search documentation", detail: "4 · SDK, security, operations", href: "/docs" },
    { label: "Inspect protocol", detail: "5 · Live architecture and risk boundary", href: "/protocol" },
    { label: "Open wallet", detail: "Client-signed human IOC", action: "wallet" },
    { label: "Display settings", detail: "Density, refresh, motion", action: "settings" },
    { label: "Keyboard shortcuts", detail: "Navigation and inspection", action: "shortcuts" },
  ];
  return base.concat((model.state?.markets || []).slice(0, 20).map((row) => ({
    label: row.asset + " " + fmt(row.intervalSec / 60, 0) + "m · " + row.lifecycle,
    detail: secondsLeft(row.secondsLeft) + " · " + short(row.marketId),
    href: marketPath(row.marketId),
  })));
}

function renderCommands() {
  const query = $("command-search")?.value.trim().toLowerCase() || "";
  const items = commandItems().filter((item) => !query || (item.label + " " + item.detail).toLowerCase().includes(query));
  model.commandIndex = Math.max(0, Math.min(model.commandIndex, items.length - 1));
  $("command-results").innerHTML = items.length ? join(items.map((item, index) =>
    '<button class="command-result ' + (index === model.commandIndex ? "active" : "") +
    '" type="button" data-command-index="' + index + '" data-command-href="' + escapeHtml(item.href || "") +
    '" data-command-action="' + escapeHtml(item.action || "") + '"><span>' + escapeHtml(item.label) +
    "</span><small>" + escapeHtml(item.detail) + "</small></button>")) : empty("NO DATA", "No command or market matches.");
}

function runCommand(node) {
  const href = node?.dataset.commandHref;
  const action = node?.dataset.commandAction;
  if (href) navigate(href);
  else if (action === "wallet") openWallet();
  else if (action === "settings") openSettings();
  else if (action === "shortcuts") openOverlay("shortcuts-overlay");
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem("tempo-display-v1") || "{}");
    if (["comfortable", "compact"].includes(saved.density)) model.settings.density = saved.density;
    if ([2000, 5000, 10000].includes(Number(saved.refresh))) model.settings.refresh = Number(saved.refresh);
    if (typeof saved.asset === "string" && saved.asset.length > 0 && saved.asset.length <= 32) model.settings.asset = saved.asset;
    if (saved.interval === "ALL" || (Number.isSafeInteger(Number(saved.interval)) && Number(saved.interval) > 0)) model.settings.interval = String(saved.interval);
    if (["dark", "light"].includes(saved.theme)) model.settings.theme = saved.theme;
    model.settings.reducedMotion = Boolean(saved.reducedMotion);
  } catch { /* Ignore corrupt display-only preferences. */ }
  applySettings();
}

function applySettings() {
  document.body.classList.toggle("compact", model.settings.density === "compact");
  document.body.classList.toggle("reduced-motion", model.settings.reducedMotion);
  document.body.classList.toggle("theme-light", model.settings.theme === "light");
  document.body.classList.toggle("theme-dark", model.settings.theme !== "light");
  if ($("theme-label")) $("theme-label").textContent = model.settings.theme === "light" ? "Dark" : "Light";
  if ($("theme-icon")) $("theme-icon").textContent = model.settings.theme === "light" ? "☾" : "☀";
  if ($("theme-toggle")) $("theme-toggle").setAttribute("aria-label", "Switch to " + (model.settings.theme === "light" ? "dark" : "light") + " theme");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", model.settings.theme === "light" ? "#f2f1ec" : "#10100f");
  model.filters.asset = model.settings.asset;
  model.filters.interval = model.settings.interval;
  clearInterval(model.refreshTimer);
  model.refreshTimer = setInterval(() => void refreshState(), model.settings.refresh);
}

function openSettings() {
  const assets = [...new Set((model.state?.markets || []).map((row) => row.asset).filter(Boolean))].sort();
  const intervals = [...new Set((model.state?.markets || []).map((row) => row.intervalSec))].sort((a, b) => a - b);
  $("setting-asset").innerHTML = '<option value="ALL">All assets</option>' + selectOptions(assets, (value) => value);
  $("setting-interval").innerHTML = '<option value="ALL">All intervals</option>' + selectOptions(intervals, (value) => fmt(value / 60, 0) + "m");
  if (model.settings.asset !== "ALL" && !assets.includes(model.settings.asset)) model.settings.asset = "ALL";
  if (model.settings.interval !== "ALL" && !intervals.map(String).includes(model.settings.interval)) model.settings.interval = "ALL";
  $("setting-density").value = model.settings.density;
  $("setting-refresh").value = String(model.settings.refresh);
  $("setting-asset").value = model.settings.asset;
  $("setting-interval").value = model.settings.interval;
  $("setting-theme").value = model.settings.theme;
  $("setting-motion").checked = model.settings.reducedMotion;
  $("settings-runtime").textContent = model.state ? (model.state.live.dryRun ? "DRY RUN" : "LIVE") + " · " + model.state.live.network : "UNAVAILABLE";
  $("settings-wallet").textContent = $("wallet-state")?.textContent || "DISCONNECTED";
  openOverlay("settings-overlay", "#setting-density");
}

function saveSettings() {
  model.settings = {
    density: $("setting-density").value,
    refresh: Number($("setting-refresh").value),
    asset: $("setting-asset").value,
    interval: $("setting-interval").value,
    theme: $("setting-theme").value,
    reducedMotion: $("setting-motion").checked,
  };
  localStorage.setItem("tempo-display-v1", JSON.stringify(model.settings));
  applySettings();
  closeOverlay("settings-overlay");
  renderRoute();
  toast("Display settings saved");
}

function searchDocs(event) {
  const query = event.target.value.trim().toLowerCase();
  document.querySelectorAll(".docs-article .doc-section").forEach((section) => {
    section.hidden = Boolean(query && !section.textContent.toLowerCase().includes(query));
  });
}

function moveRows(direction) {
  const rows = [...document.querySelectorAll("[data-row-index]")];
  if (!rows.length) return;
  model.rowIndex = Math.max(0, Math.min(rows.length - 1, model.rowIndex + direction));
  rows.forEach((row, index) => row.classList.toggle("keyboard-active", index === model.rowIndex));
  rows[model.rowIndex].focus({ preventScroll: true });
  rows[model.rowIndex].scrollIntoView({ block: "nearest" });
}

function inspectRow() {
  const row = document.querySelector(".keyboard-active");
  if (!row) return;
  if (row.dataset.marketRow) navigate(marketPath(row.dataset.marketRow));
  else if (row.dataset.eventId) openAudit(findRecord(row.dataset.eventId));
}

function bindGlobal() {
  document.addEventListener("click", (event) => {
    const target = event.target.closest("a,button");
    if (!target) {
      const row = event.target.closest("[data-inspect]");
      if (row?.dataset.marketRow) navigate(marketPath(row.dataset.marketRow));
      else if (row?.dataset.eventId) openAudit(findRecord(row.dataset.eventId));
      return;
    }
    const route = target.closest("[data-route]");
    if (route) {
      const href = route.getAttribute("href");
      if (href?.startsWith("/")) { event.preventDefault(); navigate(href); }
      return;
    }
    if (target.matches("[data-onboarding]")) dismissOnboarding(target.dataset.onboarding);
    else if (target.matches("[data-close]")) closeOverlay(target.dataset.close);
    else if (target.matches("[data-open-wallet]") || target.id === "wallet-open") openWallet();
    else if (target.id === "command-open") {
      model.commandIndex = 0;
      openOverlay("command-overlay", "#command-search");
      $("command-search").value = "";
      renderCommands();
    } else if (target.id === "menu-open") {
      closeOverlays(false);
      overlayReturnFocus = target;
      $("mobile-menu").hidden = false;
      target.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
      $("menu-close")?.focus();
    } else if (target.id === "menu-close") {
      closeOverlays();
    } else if (target.id === "theme-toggle") {
      model.settings.theme = model.settings.theme === "light" ? "dark" : "light";
      localStorage.setItem("tempo-display-v1", JSON.stringify(model.settings));
      applySettings();
    } else if (target.matches("[data-toggle-panel]")) {
      const key = target.dataset.togglePanel;
      if (Object.prototype.hasOwnProperty.call(model.dashboard, key)) {
        const opening = model.dashboard[key];
        if (key === "intelligence") {
          const minimized = !opening;
          model.dashboard.intelligence = minimized;
          const panel = target.closest(".firm-intelligence");
          panel?.classList.toggle("intelligence-minimized", minimized);
          panel?.classList.toggle("intelligence-expanded", !minimized);
          target.setAttribute("aria-expanded", String(!minimized));
          target.setAttribute("aria-label", (minimized ? "Expand" : "Minimize") + " intelligence panel");
          const arrow = target.querySelector(".toggle-arrow");
          const text = target.querySelector(".toggle-text");
          if (arrow) arrow.textContent = minimized ? "↓" : "↑";
          if (text) text.textContent = minimized ? "Expand" : "Minimize";
        } else if (key === "agents" || key === "evidence") {
          if (model.dashboard.right || opening) {
            model.dashboard.right = false;
            model.dashboard.agents = key !== "agents";
            model.dashboard.evidence = key !== "evidence";
          } else {
            model.dashboard.right = true;
            model.dashboard.agents = true;
            model.dashboard.evidence = true;
          }
        } else {
          model.dashboard[key] = !opening;
        }
        if (key !== "intelligence") renderRoute({ preserve: true });
      }
    } else if (target.matches("[data-open-settings]")) openSettings();
    else if (target.matches("[data-refresh]")) void Promise.all([refreshJournal(), refreshState(true)]);
    else if (target.matches("[data-select-market]")) { model.selected = target.dataset.selectMarket; renderRoute(); }
    else if (target.matches("[data-market-row]")) navigate(marketPath(target.dataset.marketRow));
    else if (target.matches("[data-history-tab]")) { model.filters.historyTab = target.dataset.historyTab; renderRoute(); }
    else if (target.matches("[data-clear-market-filters]")) {
      model.filters.marketQuery = ""; model.filters.marketStatus = "ALL"; model.filters.asset = "ALL"; model.filters.interval = "ALL"; renderRoute();
    } else if (target.matches("[data-copy]")) void copyText(target.dataset.copy);
    else if (target.matches("[data-tx]")) openProof(target.dataset.tx);
    else if (target.matches("[data-event-id]")) openAudit(findRecord(target.dataset.eventId));
    else if (target.matches("[data-agent]")) openAgent(target.dataset.agent);
    else if (target.matches("[data-risk]")) openRisk(target.dataset.risk);
    else if (target.matches("[data-command-index]")) runCommand(target);
    else if (target.matches("[data-retry-docs]")) { model.docs = null; void loadDocs(); }
  });
  window.addEventListener("popstate", () => path() === "/docs" && model.docs === null ? void loadDocs() : renderRoute({ animate: true }));
  document.addEventListener("keydown", (event) => {
    const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
    if (event.key === "Escape") closeOverlays();
    if (event.key === "Tab") {
      const overlay = document.querySelector(".overlay:not([hidden]), .drawer-backdrop:not([hidden]), .mobile-menu:not([hidden])");
      const focusable = overlay ? [...overlay.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((node) => !node.hidden) : [];
      if (focusable.length) {
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }
    if (event.key === "?" && !typing) { event.preventDefault(); openOverlay("shortcuts-overlay"); }
    if (event.key === "/" && !typing) {
      event.preventDefault();
      if (path() === "/markets") $("market-search")?.focus();
      else if (path() === "/history") $("history-search")?.focus();
      else if (path() === "/docs") $("docs-search-spa")?.focus();
      else { openOverlay("command-overlay", "#command-search"); renderCommands(); }
    }
    if (!typing && /^[1-7]$/.test(event.key)) {
      const routes = ["/", "/dashboard", "/markets", "/history", "/docs", "/protocol", "/dashboard"];
      navigate(routes[Number(event.key) - 1]);
    }
    if (!typing && event.key.toLowerCase() === "j") moveRows(1);
    if (!typing && event.key.toLowerCase() === "k") moveRows(-1);
    if (!typing && event.key === "Enter") inspectRow();
    if (!$("command-overlay")?.hidden) {
      const items = [...document.querySelectorAll(".command-result")];
      if (event.key === "ArrowDown") { event.preventDefault(); model.commandIndex = Math.min(items.length - 1, model.commandIndex + 1); renderCommands(); }
      if (event.key === "ArrowUp") { event.preventDefault(); model.commandIndex = Math.max(0, model.commandIndex - 1); renderCommands(); }
      if (event.key === "Enter" && document.activeElement?.id === "command-search") {
        event.preventDefault();
        runCommand(document.querySelector('.command-result[data-command-index="' + model.commandIndex + '"]'));
      }
    }
  });
  $("command-search")?.addEventListener("input", () => { model.commandIndex = 0; renderCommands(); });
  $("settings-save")?.addEventListener("click", saveSettings);
  document.querySelectorAll(".overlay, .drawer-backdrop").forEach((overlay) => overlay.addEventListener("mousedown", (event) => {
    if (event.target === overlay) closeOverlay(overlay.id);
  }));
  const walletState = $("wallet-state");
  if (walletState) new MutationObserver(() => {
    const state = walletState.textContent || "DISCONNECTED";
    $("wallet-top-state").textContent = state === "CONNECTED" ? "Connected" : "Connect Wallet";
    $("wallet-open").classList.toggle("connected", state === "CONNECTED");
  }).observe(walletState, { childList: true, subtree: true, characterData: true });
  window.addEventListener("tempo:wallet-receipt", (event) => {
    const hash = event.detail?.hash;
    if (HASH.test(hash || "")) {
      const status = ["pending", "confirmed", "failed"].includes(event.detail?.status) ? event.detail.status : "pending";
      model.walletProofs.set(hash.toLowerCase(), { ...event.detail, status, at: new Date().toISOString() });
      if (status === "confirmed") {
        toast("Wallet transaction confirmed on Somnia");
      } else if (status === "pending") toast("Transaction submitted · receipt pending");
      else toast("Transaction failed or reverted");
    }
  });
  window.addEventListener("tempo:wallet-complete", (event) => {
    const hash = event.detail?.hashes?.at(-1);
    if (HASH.test(hash || "")) openProof(hash);
  });
}

async function bootstrap() {
  loadSettings();
  bindGlobal();
  updateNavigation();
  const results = await Promise.allSettled([
    getJson("/api/wallet/config"),
    getJson("/api/journal?n=300"),
    getJson("/api/state"),
    getJson("/api/stats"),
    path() === "/docs" ? ensureDocs() : Promise.resolve(),
  ]);
  if (results[0].status === "fulfilled") { model.walletConfig = results[0].value; model.loaded.wallet = true; }
  if (results[1].status === "fulfilled") { model.records = Array.isArray(results[1].value.records) ? results[1].value.records : []; model.loaded.journal = true; }
  if (results[2].status === "fulfilled") {
    const state = results[2].value;
    if (state?.live && Array.isArray(state.markets) && Array.isArray(state.agents) && Array.isArray(state.settlements)) {
      model.state = state;
      model.loaded.state = true;
      model.refreshAt = state.at;
      window.dispatchEvent(new CustomEvent("tempo:state", { detail: state }));
    }
  }
  if (results[3].status === "fulfilled") { model.stats = results[3].value; model.loaded.stats = true; }
  updateChrome();
  renderRoute();
  model.statsTimer = window.setInterval(() => void refreshStats(true), 60_000);
  requestAnimationFrame(showFirstVisitOnboarding);
  if (!new URLSearchParams(location.search).has("snapshot")) startStream();
}

void bootstrap();
