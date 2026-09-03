import { escapeHtml } from "/security.js";

const $ = (id) => document.getElementById(id);
let provider;
let account;
let chainId;
let lastPrepared;
let lastState;
let walletConfig;
let signing = false;
let discoveredWallets = [];
let selectedWalletKey;

const FEATURED_WALLETS = [
  { key: "metamask", name: "MetaMask", mark: "M", rdns: ["io.metamask"] },
  { key: "okx", name: "OKX Wallet", mark: "O", rdns: ["com.okex.wallet", "com.okx.wallet"] },
  { key: "coinbase", name: "Coinbase Wallet", mark: "C", rdns: ["com.coinbase.wallet"] },
];

const ADDRESS = /^0x[0-9a-f]{40}$/i;
const HASH = /^0x[0-9a-f]{64}$/i;

function clearPrepared(message) {
  lastPrepared = undefined;
  $("wallet-confirm").hidden = true;
  $("wallet-cancel").hidden = true;
  if (message) {
    $("wallet-summary").hidden = false;
    $("wallet-summary").textContent = message;
  }
}

async function loadWalletConfig() {
  const response = await fetch("/api/wallet/config");
  const body = await response.json();
  if (!response.ok || !Number.isSafeInteger(body.chainId) || !/^0x[0-9a-f]+$/i.test(body.chainHex)) throw new Error("wallet network configuration unavailable");
  walletConfig = body;
  showNetworkState();
}

function setState(state, detail = "") {
  $("wallet-state").textContent = state;
  $("wallet-meta").textContent = detail;
}

function currentProvider() {
  return provider;
}

function identifyWallet(info) {
  const rdns = String(info?.rdns ?? "").toLowerCase();
  const name = String(info?.name ?? "").toLowerCase();
  const match = FEATURED_WALLETS.find((wallet) => wallet.rdns.some((value) => rdns === value) || name.includes(wallet.name.toLowerCase().split(" ")[0]));
  return match?.key ?? "browser";
}

function renderWalletChoices() {
  const picker = $("wallet-picker");
  const options = $("wallet-options");
  if (!picker || !options || account) return;
  const entries = FEATURED_WALLETS.map((wallet) => {
    const found = discoveredWallets.find((item) => identifyWallet(item.info) === wallet.key);
    return { ...wallet, provider: found?.provider };
  });
  if (!entries.some((entry) => entry.provider) && window.ethereum) {
    entries.push({ key: "browser", name: "Browser wallet", mark: "?", rdns: [], provider: window.ethereum });
  }
  options.innerHTML = entries
    .map((entry) => {
      const detected = Boolean(entry.provider);
      const selected = entry.key === selectedWalletKey;
      const label = detected ? "Detected · select" : "Not detected";
      return `<button class="wallet-option${selected ? " selected" : ""}" type="button" data-wallet="${escapeHtml(entry.key)}" ${detected ? "" : "disabled"}>
        <span class="wallet-option-mark">${escapeHtml(entry.mark)}</span>
        <span class="wallet-option-copy"><span class="wallet-option-name">${escapeHtml(entry.name)}</span><span class="wallet-option-state">${label}</span></span>
      </button>`;
    })
    .join("");
  options.querySelectorAll("button[data-wallet]").forEach((button) => {
    button.addEventListener("click", () => {
      const entry = entries.find((item) => item.key === button.dataset.wallet);
      if (!entry?.provider) return;
      selectedWalletKey = entry.key;
      provider = entry.provider;
      bindProviderEvents(provider);
      picker.hidden = true;
      void connect();
    });
  });
  picker.hidden = false;
}

function bindProviderEvents(wallet) {
  if (!wallet?.on) return;
  wallet.on("accountsChanged", (accounts) => { clearPrepared("PRE-SIGN CANCELLED · wallet account changed"); if (!accounts?.length) { account = undefined; setState("DISCONNECTED", "Wallet disconnected."); renderWalletChoices(); } else void connect(); });
  wallet.on("chainChanged", () => { clearPrepared("PRE-SIGN CANCELLED · wallet network changed"); void connect(); });
  wallet.on("disconnect", () => { clearPrepared("PRE-SIGN CANCELLED · wallet provider disconnected"); account = undefined; setState("DISCONNECTED", "Wallet disconnected."); renderWalletChoices(); });
}

function showNetworkState() {
  const warning = $("wallet-warning");
  if (!chainId) {
    warning.hidden = true;
    return;
  }
  if (!walletConfig) {
    warning.hidden = false;
    warning.textContent = "Wallet network configuration unavailable.";
    $("wallet-trade").hidden = true;
  } else if (chainId !== walletConfig.chainId) {
    warning.hidden = false;
    warning.innerHTML = `WRONG NETWORK · wallet chain ${chainId}; TEMPO ${walletConfig.network} requires ${walletConfig.chainId} <button type="button" id="wallet-switch">Switch network</button>`;
    $("wallet-switch")?.addEventListener("click", () => void switchNetwork());
    $("wallet-trade").hidden = true;
  } else {
    warning.hidden = true;
    $("wallet-trade").hidden = false;
  }
}

async function readBalance() {
  const value = await currentProvider().request({ method: "eth_getBalance", params: [account, "latest"] });
  const wei = BigInt(value);
  const whole = wei / 1_000_000_000_000_000_000n;
  const fraction = (wei % 1_000_000_000_000_000_000n).toString().padStart(18, "0").slice(0, 4);
  return `${whole}.${fraction} STT`;
}

async function connect() {
  const wallet = currentProvider();
  if (!wallet) {
    setState("UNSUPPORTED", "No EIP-6963 or window.ethereum provider detected.");
    return;
  }
  try {
    const accounts = await wallet.request({ method: "eth_requestAccounts" });
    if (!Array.isArray(accounts) || accounts.length === 0 || accounts.some((value) => !ADDRESS.test(value))) throw new Error("wallet returned malformed account");
    account = accounts[0];
    const rawChain = await wallet.request({ method: "eth_chainId" });
    if (typeof rawChain !== "string" || !/^0x[0-9a-f]+$/i.test(rawChain)) throw new Error("wallet returned malformed chain id");
    chainId = Number.parseInt(rawChain, 16);
    if (!Number.isSafeInteger(chainId)) throw new Error("wallet returned malformed chain id");
    const balance = await readBalance();
    setState("CONNECTED", `${account.slice(0, 8)}...${account.slice(-6)} · chain ${chainId} · ${balance}`);
    $("wallet-connect").textContent = "Disconnect wallet";
    $("wallet-picker").hidden = true;
    showNetworkState();
    await refreshWalletActivity();
    populateMarkets();
  } catch (error) {
    setState("REJECTED", error instanceof Error ? error.message.slice(0, 120) : "wallet request failed");
  }
}

async function switchNetwork() {
  const wallet = currentProvider();
  if (!wallet || !walletConfig) return;
  try {
    await wallet.request({ method: "wallet_switchEthereumChain", params: [{ chainId: walletConfig.chainHex }] });
  } catch (error) {
    if (error?.code !== 4902) {
      $("wallet-warning").textContent = "Network switch rejected by wallet.";
      return;
    }
    await wallet.request({ method: "wallet_addEthereumChain", params: [{ chainId: walletConfig.chainHex, chainName: walletConfig.chainName, nativeCurrency: walletConfig.nativeCurrency, rpcUrls: [walletConfig.rpcUrl], blockExplorerUrls: [walletConfig.explorerUrl] }] });
  }
  await connect();
}

async function refreshWalletActivity() {
  if (!account) return;
  try {
    const response = await fetch(`/api/wallet/activity?address=${encodeURIComponent(account)}`);
    if (!response.ok) throw new Error(`activity ${response.status}`);
    const data = await response.json();
    $("wallet-activity").innerHTML = `<small>YOUR ACTIVITY · ${data.fills?.length ?? 0} fills · ${data.orders?.length ?? 0} watched orders · live store attribution</small>`;
  } catch {
    $("wallet-activity").textContent = "YOUR ACTIVITY · UNAVAILABLE";
  }
}

function populateMarkets() {
  const select = $("wallet-market");
  const markets = lastState?.markets?.filter((market) => market.status === 1) ?? [];
  select.innerHTML = markets.length
    ? markets.map((market) => `<option value="${escapeHtml(market.marketId)}">${escapeHtml(market.asset)} ${market.intervalSec / 60}m · ${Math.max(0, market.secondsLeft)}s</option>`).join("")
    : "<option value=\"\">NO TRADING WINDOWS</option>";
}

async function reviewTrade() {
  if (!account || !walletConfig || chainId !== walletConfig.chainId || signing) return;
  const market = $("wallet-market").value;
  const outcome = $("wallet-side").value;
  const size = Number($("wallet-size").value);
  const price = Number($("wallet-price").value);
  const summary = $("wallet-summary");
  try {
    const query = new URLSearchParams({ address: account, market, outcome, size: String(size), price: String(price) });
    const response = await fetch(`/api/wallet/prepare?${query}`);
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "order preparation failed");
    if (body.review?.chainId !== chainId || body.review?.allowlistValidated !== true) throw new Error("prepared transaction failed chain or destination validation");
    const calls = [body.approval, body.order].filter(Boolean);
    if (!calls.length || calls.some((call) => !ADDRESS.test(call.to) || typeof call.data !== "string" || !/^0x[0-9a-f]*$/i.test(call.data))) throw new Error("prepared transaction is malformed");
    lastPrepared = body;
    summary.hidden = false;
    summary.textContent = [
      "PRE-SIGN SUMMARY · IOC",
      `market: ${body.prepared.market.symbol}`,
      `side: ${body.prepared.outcome}`,
      `size: ${body.prepared.size}`,
      `limit price: ${body.prepared.price}`,
      `expiry: ${body.prepared.expireTimestampNs} ns`,
      `seconds left: ${Math.round(body.prepared.secondsLeft)}`,
      `worst-case cost: ${body.prepared.worstCaseCost}`,
      `collateral available: ${body.review.collateralBalance}`,
      `chain: ${body.review.chainId} (${walletConfig.network})`,
      `destinations: ${body.review.destinations.join(", ")}`,
      `native value: ${body.review.nativeValue}`,
      "RiskEngine: ACCEPTED · chain status: 1 (Trading)",
      "Review complete. Select Confirm in wallet to request signatures.",
    ].join("\n");
    $("wallet-confirm").hidden = false;
    $("wallet-cancel").hidden = false;
  } catch (error) {
    summary.hidden = false;
    summary.textContent = `PRE-SIGN BLOCKED · ${error instanceof Error ? error.message.slice(0, 160) : "unavailable"}`;
  }
}

async function waitReceipt(hash) {
  if (!HASH.test(hash)) throw new Error("wallet returned malformed transaction hash");
  for (let i = 0; i < 30; i++) {
    const receipt = await currentProvider().request({ method: "eth_getTransactionReceipt", params: [hash] });
    if (receipt) {
      if (receipt.status !== "0x1" && receipt.status !== "0x0") throw new Error("wallet returned malformed receipt");
      return receipt;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return null;
}

async function signPrepared() {
  if (!lastPrepared || !account || !walletConfig || signing) return;
  const wallet = currentProvider();
  signing = true;
  $("wallet-confirm").hidden = true;
  $("wallet-cancel").hidden = true;
  try {
    const currentAccounts = await wallet.request({ method: "eth_accounts" });
    const currentChain = await wallet.request({ method: "eth_chainId" });
    if (!Array.isArray(currentAccounts) || currentAccounts[0]?.toLowerCase() !== account.toLowerCase()) throw new Error("wallet account changed after review");
    if (typeof currentChain !== "string" || Number.parseInt(currentChain, 16) !== walletConfig.chainId) throw new Error("wallet network changed after review");
    const hashes = [];
    for (const call of [lastPrepared.approval, lastPrepared.order].filter(Boolean)) {
      const hash = await wallet.request({ method: "eth_sendTransaction", params: [{ from: account, to: call.to, data: call.data, value: `0x${BigInt(call.value).toString(16)}` }] });
      if (!HASH.test(hash)) throw new Error("wallet returned malformed transaction hash");
      const receipt = await waitReceipt(hash);
      if (!receipt || receipt.status !== "0x1") throw new Error(`receipt reverted or unavailable: ${hash}`);
      hashes.push(hash);
    }
    $("wallet-summary").textContent += `\n\nRECEIPTS · ${hashes.join(" · ")} · status success`;
    await refreshWalletActivity();
  } catch (error) {
    $("wallet-summary").textContent += `\n\nSIGNING STOPPED · ${error instanceof Error ? error.message.slice(0, 160) : "wallet rejected"}`;
  } finally {
    signing = false;
    lastPrepared = undefined;
  }
}

function discoverWallets() {
  const discovered = [];
  const handler = (event) => {
    if (event.detail?.provider && !discovered.some((item) => item.info?.uuid === event.detail.info?.uuid)) discovered.push(event.detail);
  };
  window.addEventListener("eip6963:announceProvider", handler);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  setTimeout(() => {
    window.removeEventListener("eip6963:announceProvider", handler);
    discoveredWallets = discovered;
    if (!discovered.length && !window.ethereum) setState("UNSUPPORTED", "No wallet provider detected.");
    renderWalletChoices();
  }, 250);
}

window.addEventListener("tempo:state", (event) => { lastState = event.detail; populateMarkets(); });
$("wallet-connect")?.addEventListener("click", () => {
  if (account) {
    clearPrepared();
    account = undefined;
    setState("DISCONNECTED", "Wallet disconnected.");
    $("wallet-connect").textContent = "Connect wallet";
    renderWalletChoices();
    return;
  }
  if (!provider) {
    renderWalletChoices();
    return;
  }
  void connect();
});
$("wallet-warning")?.addEventListener("click", () => void switchNetwork());
$("wallet-prepare")?.addEventListener("click", () => void reviewTrade());
$("wallet-confirm")?.addEventListener("click", () => void signPrepared());
$("wallet-cancel")?.addEventListener("click", () => clearPrepared("PRE-SIGN CANCELLED · no wallet request was sent"));
for (const id of ["wallet-market", "wallet-side", "wallet-size", "wallet-price"]) $(id)?.addEventListener("change", () => clearPrepared());
void loadWalletConfig().catch((error) => setState("UNAVAILABLE", error instanceof Error ? error.message : "wallet configuration unavailable"));
discoverWallets();
