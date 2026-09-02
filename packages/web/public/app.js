const $ = (id) => document.getElementById(id);
const fmt = (value, digits = 2) =>
  Number.isFinite(value) ? Number(value).toLocaleString(undefined, { maximumFractionDigits: digits }) : "NO DATA";
const short = (value) => (value ? `${value.slice(0, 8)}...${value.slice(-6)}` : "UNAVAILABLE");

let selected;
let lastState;
let records = [];
const birthPulses = new Set();

function renderWindows(markets = []) {
  const host = $("window-list");
  if (!markets.length) {
    host.innerHTML = '<div class="empty">NO DATA</div>';
    return;
  }
  if (!selected || !markets.some((market) => market.marketId === selected)) {
    selected = (markets.find((market) => market.secondsLeft > 20 && market.view) ?? markets.find((market) => market.secondsLeft > 20) ?? markets[0]).marketId;
  }
  host.innerHTML = markets
    .map(
      (market) => `<button class="window ${market.marketId === selected ? "active" : ""} ${birthPulses.has(market.marketId) ? "birth" : ""}" data-id="${market.marketId}">
        <span><b>${market.asset}</b> ${fmt(market.intervalSec / 60, 0)}m</span>
        <span class="clock ${market.secondsLeft <= 20 ? "urgent" : ""}">${Math.max(0, market.secondsLeft)}s</span>
        <small>${market.lifecycle} · ${short(market.marketId)}</small>
      </button>`,
    )
    .join("");
  host.querySelectorAll("button").forEach((button) =>
    button.addEventListener("click", () => {
      selected = button.dataset.id;
      render(lastState);
    }),
  );
}

function renderFirm(agents = []) {
  $("firm").innerHTML = agents.length
    ? agents
        .map(
          (agent) => `<article class="agent">
            <div><b>${agent.name}</b><span class="status">${agent.readOnly ? "READ ONLY" : agent.dryRun ? "DRY RUN" : "LIVE"}</span></div>
            <dl><dt>Capital · chain fact</dt><dd>${agent.collateral ? fmt(agent.collateral.human) : "UNAVAILABLE"}</dd>
            <dt>Realized P&amp;L · derived</dt><dd title="real fills + on-chain settlements">${agent.readOnly ? "UNAVAILABLE" : fmt(agent.realizedPnl)}</dd>
            <dt>Inventory · derived</dt><dd title="real live-tail fills">${agent.inventory ? Object.values(agent.inventory).reduce((sum, position) => sum + position.qtyUp + position.qtyDown, 0).toFixed(3) : "UNAVAILABLE"}</dd>
            <dt>Working orders</dt><dd>${agent.readOnly ? "UNAVAILABLE" : fmt(agent.openOrders, 0)}</dd></dl>
            <small>${agent.address ? short(agent.address) : "No signer configured"}</small>
          </article>`,
        )
        .join("")
    : '<div class="empty">NO DATA</div>';
}

function renderTape() {
  const host = $("tape");
  if (!records.length) {
    host.innerHTML = '<div class="empty">NO DATA</div>';
    return;
  }
  host.innerHTML = records
    .slice(-80)
    .reverse()
    .map(
      (record) => `<div class="tape-row ${record.type}" title="${record.source ?? "journal"}">
        <time>${record.ts.slice(11, 19)}</time><b>${record.agent ?? "FIRM"}</b><span>${record.type}</span>
        <small>${record.tx ? short(record.tx) : record.data?.outcome ?? record.data?.lifecycle ?? ""}</small>
      </div>`,
    )
    .join("");
}

function renderBook(view) {
  if (!view || (!view.book.yesBids.length && !view.book.yesAsks.length)) {
    $("book").innerHTML = '<div class="empty">NO DATA · awaiting materialized levels</div>';
    return;
  }
  const asks = [...view.book.yesAsks].slice(0, 5).reverse();
  const bids = view.book.yesBids.slice(0, 5);
  $("book").innerHTML = [
    ...asks.map((level) => `<div class="level ask" title="markets-sdk live tail · ${view.bookAt}"><span>${fmt(level.price, 3)}</span><b>${fmt(level.size, 3)}</b></div>`),
    '<div class="touch">UP PRICE / SIZE</div>',
    ...bids.map((level) => `<div class="level bid" title="markets-sdk live tail · ${view.bookAt}"><span>${fmt(level.price, 3)}</span><b>${fmt(level.size, 3)}</b></div>`),
  ].join("");
}

function renderSettlements(settlements = []) {
  $("settlements").innerHTML = settlements.length
    ? settlements
        .map(
          (row) => `<div class="settlement" title="${row.source}">
            <div><b>${row.asset} ${fmt(row.intervalSec / 60, 0)}m</b><span>${row.voided ? "VOID" : row.winningOutcome === 0 ? "UP" : row.winningOutcome === 1 ? "DOWN" : "PENDING"}</span></div>
            <small>${new Date(row.expiry * 1000).toISOString().slice(11, 19)}Z · ${row.tradeCount ?? "NO DATA"} trades · ${row.lastPrice === undefined ? "NO DATA" : fmt(row.lastPrice, 3)}</small>
            ${row.oracleUrl ? `<a href="${row.oracleUrl}" target="_blank" rel="noreferrer">Oracle audit ↗</a>` : '<em>Oracle link unavailable</em>'}
          </div>`,
        )
        .join("")
    : '<div class="empty">NO DATA</div>';
}

function render(state) {
  if (!state) return;
  lastState = state;
  $("pill-net").textContent = state.live.network.toUpperCase();
  $("pill-mode").textContent = state.live.dryRun ? "DRY RUN" : "LIVE";
  $("pill-tail").textContent = state.live.tailing ? "TAIL LIVE" : "POLL FALLBACK";
  $("pill-uptime").textContent = `${state.live.uptimeSec}s`;
  renderWindows(state.markets);
  renderFirm(state.agents);
  renderSettlements(state.settlements);
  const market = state.markets.find((row) => row.marketId === selected);
  $("window-title").firstChild.textContent = market ? `${market.asset} ${fmt(market.intervalSec / 60, 0)}m ` : "Select a window ";
  $("window-sub").textContent = market ? `${market.lifecycle} · ${short(market.marketId)}` : "";
  const view = market?.view;
  $("facts").innerHTML = market
    ? `<div title="DreamDEX indexer"><span>Expiry · fact</span><b>${new Date(market.expiry * 1000).toISOString().slice(11, 19)}Z</b></div>
       <div title="derived from indexed expiry and local clock"><span>Time left · derived</span><b>${Math.max(0, market.secondsLeft)}s</b></div>
       <div title="getMarketOnchain(marketId)"><span>Status · chain fact</span><b>${market.status < 0 ? "NO DATA" : market.status}</b></div>
       <div title="${view?.opening.source ?? "UNAVAILABLE"}"><span>Strike · fact</span><b>${view ? fmt(view.opening.value, 2) : "NO DATA"}</b></div>
       <div title="${view ? `${view.spot.source} · block ${view.spot.block ?? "NO DATA"} · ${view.spot.at}` : "UNAVAILABLE"}"><span>Spot · feed fact</span><b>${view ? fmt(view.spot.value, 2) : "NO DATA"}</b></div>
       <div title="DreamDEX indexer"><span>Venue · fact</span><b>${short(market.venueId)}</b></div>`
    : '<div class="empty">NO DATA</div>';
  renderBook(view);
  $("fv-p").textContent = view && Number.isFinite(view.fairValue.value) ? `${fmt(view.fairValue.value * 100, 1)}%` : "NO DATA";
  $("fv-p").title = view ? `${view.fairValue.source} · ${view.fairValue.at}` : "UNAVAILABLE";
  $("fv-band").innerHTML = view && Number.isFinite(view.fairValue.value)
    ? `<span style="left:${view.fairValue.band[0] * 100}%;width:${Math.max(1, (view.fairValue.band[1] - view.fairValue.band[0]) * 100)}%"></span>`
    : "";
  $("fv-meta").textContent = view && Number.isFinite(view.fairValue.value)
    ? `band ${fmt(view.fairValue.band[0], 3)}–${fmt(view.fairValue.band[1], 3)} · σ ${view.fairValue.sigma.toExponential(2)} · ${view.fairValue.samples} feed samples`
    : "Awaiting a journaled estimate for this window";
}

async function refresh() {
  const response = await fetch("/api/state");
  if (!response.ok) throw new Error(`state ${response.status}`);
  render(await response.json());
}

async function bootstrap() {
  try {
    const journal = await fetch("/api/journal?n=80").then((response) => response.json());
    records = journal.records ?? [];
    renderTape();
    await refresh();
  } catch {
    $("pill-tail").textContent = "UNAVAILABLE";
  }
  setInterval(() => void refresh().catch(() => ($("pill-tail").textContent = "UNAVAILABLE")), 2000);
  const stream = new EventSource("/api/stream");
  stream.onmessage = (event) => {
    const record = JSON.parse(event.data);
    if (record.type === "market-birth" && record.marketId) {
      birthPulses.add(record.marketId);
      setTimeout(() => birthPulses.delete(record.marketId), 1800);
    }
    records.push(record);
    if (records.length > 200) records = records.slice(-120);
    renderTape();
  };
  stream.onerror = () => ($("pill-tail").textContent = "POLL FALLBACK");
}

void bootstrap();
