import { escapeHtml } from "/security.js";

const $ = (id) => document.getElementById(id);
const TESTNET_CHAIN_ID = 50312;
const TESTNET_CHAIN_HEX = "0xc488";
let provider;
let account;
let chainId;
let lastPrepared;

function setState(state, detail = "") {
  $("wallet-state").textContent = state;
  $("wallet-meta").textContent = detail;
}

function currentProvider() {
  return provider ?? window.ethereum;
}

function showNetworkState() {
  const warning = $("wallet-warning");
  if (!chainId) {
    warning.hidden = true;
    return;
  }
  if (chainId !== TESTNET_CHAIN_ID) {
    warning.hidden = false;
    warning.innerHTML = `WRONG NETWORK · wallet chain ${chainId}; TEMPO testnet requires ${TESTNET_CHAIN_ID} <button type="button" id="wallet-switch">Switch network</button>`;
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
    if (!Array.isArray(accounts) || !/^0x[0-9a-f]{40}$/i.test(accounts[0] ?? "")) throw new Error("wallet returned malformed account");
    account = accounts[0];
    const rawChain = await wallet.request({ method: "eth_chainId" });
    chainId = typeof rawChain === "string" ? Number.parseInt(rawChain, 16) : Number(rawChain);
    const balance = await readBalance();
    setState("CONNECTED", `${account.slice(0, 8)}...${account.slice(-6)} · chain ${chainId} · ${balance}`);
    $("wallet-connect").textContent = "Disconnect wallet";
    showNetworkState();
    await refreshWalletActivity();
    populateMarkets();
  } catch (error) {
    setState("REJECTED", error instanceof Error ? error.message.slice(0, 120) : "wallet request failed");
  }
}

async function switchNetwork() {
  const wallet = currentProvider();
  if (!wallet) return;
  try {
    await wallet.request({ method: "wallet_switchEthereumChain", params: [{ chainId: TESTNET_CHAIN_HEX }] });
  } catch (error) {
    if (error?.code !== 4902) {
      $("wallet-warning").textContent = "Network switch rejected by wallet.";
      return;
    }
    await wallet.request({ method: "wallet_addEthereumChain", params: [{ chainId: TESTNET_CHAIN_HEX, chainName: "Somnia Shannon", nativeCurrency: { name: "Somnia Testnet Token", symbol: "STT", decimals: 18 }, rpcUrls: ["https://api.infra.testnet.somnia.network"], blockExplorerUrls: ["https://shannon-explorer.somnia.network"] }] });
  }
  chainId = TESTNET_CHAIN_ID;
  showNetworkState();
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
  if (!account || chainId !== TESTNET_CHAIN_ID) return;
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
      "RiskEngine: ACCEPTED · chain status: 1 (Trading)",
      "The SDK unsigned calls are ready; approve each wallet confirmation explicitly.",
    ].join("\n");
    await signPrepared();
  } catch (error) {
    summary.hidden = false;
    summary.textContent = `PRE-SIGN BLOCKED · ${error instanceof Error ? error.message.slice(0, 160) : "unavailable"}`;
  }
}

async function waitReceipt(hash) {
  for (let i = 0; i < 30; i++) {
    const receipt = await currentProvider().request({ method: "eth_getTransactionReceipt", params: [hash] });
    if (receipt) return receipt;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return null;
}

async function signPrepared() {
  if (!lastPrepared || !account) return;
  const wallet = currentProvider();
  try {
    const hashes = [];
    for (const call of [lastPrepared.approval, lastPrepared.order].filter(Boolean)) {
      const hash = await wallet.request({ method: "eth_sendTransaction", params: [{ from: account, to: call.to, data: call.data, value: `0x${BigInt(call.value).toString(16)}` }] });
      const receipt = await waitReceipt(hash);
      if (!receipt || receipt.status !== "0x1") throw new Error(`receipt reverted or unavailable: ${hash}`);
      hashes.push(hash);
    }
    $("wallet-summary").textContent += `\n\nRECEIPTS · ${hashes.join(" · ")} · status success`;
    await refreshWalletActivity();
  } catch (error) {
    $("wallet-summary").textContent += `\n\nSIGNING STOPPED · ${error instanceof Error ? error.message.slice(0, 160) : "wallet rejected"}`;
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
    provider = discovered[0]?.provider ?? window.ethereum;
    if (!provider) setState("UNSUPPORTED", "No wallet provider detected.");
    if (provider?.on) {
      provider.on("accountsChanged", (accounts) => { if (!accounts?.length) { account = undefined; setState("DISCONNECTED", "Wallet disconnected."); } else void connect(); });
      provider.on("chainChanged", () => void connect());
      provider.on("disconnect", () => { account = undefined; setState("DISCONNECTED", "Wallet provider disconnected."); });
    }
  }, 250);
}

window.addEventListener("tempo:state", (event) => { lastState = event.detail; populateMarkets(); });
$("wallet-connect")?.addEventListener("click", () => account ? (account = undefined, setState("DISCONNECTED", "Wallet disconnected."), $("wallet-connect").textContent = "Connect wallet") : void connect());
$("wallet-warning")?.addEventListener("click", () => void switchNetwork());
$("wallet-prepare")?.addEventListener("click", () => void reviewTrade());
discoverWallets();
