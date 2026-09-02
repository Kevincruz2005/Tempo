#!/usr/bin/env npx tsx
/**
 * tempo — the CLI over @tempo/core (same logic the web uses).
 *
 *   tempo doctor | markets | book | watch | agents | firm | trade | positions
 *   tempo claims | activity | verify | settlements | faucet | backtest
 */
import { loadConfig, TempoExchange, oracleQuestionUrl, quantizeSize, type BinaryMarketInfo } from "@tempo/core";
import { createPublicClient, formatUnits } from "viem";

const args = process.argv.slice(2);
const cmd = args[0] ?? "help";
const flag = (name: string, def?: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? (args[i + 1]?.startsWith("--") ? undefined : args[i + 1]) : def;
};
const hasFlag = (name: string): boolean => args.includes(`--${name}`);

const cfg = loadConfig();
const fmt = (n: number, d = 3) => n.toFixed(d);
const short = (h?: string) => (h ? `${h.slice(0, 10)}…${h.slice(-6)}` : "—");
const dashboardUrl = (host: string, port: number): string => {
  const displayHost = host === "0.0.0.0" || host === "::" ? "localhost" : host.includes(":") ? `[${host}]` : host;
  return `http://${displayHost}:${port}`;
};

function out(line = ""): void {
  process.stdout.write(line + "\n");
}

function die(msg: string): never {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(1);
}

async function withExchange(fn: (ex: TempoExchange) => Promise<void>, withKey = false): Promise<void> {
  const ex = new TempoExchange({
    config: cfg,
    privateKey: withKey ? cfg.keys.maker ?? cfg.keys.taker : undefined,
  });
  try {
    await fn(ex);
  } finally {
    await ex.close().catch(() => {});
  }
}

async function resolveMarket(ex: TempoExchange, fragment: string): Promise<BinaryMarketInfo> {
  const rows = await ex.markets();
  const matches = rows.filter((m) => m.symbol.includes(fragment) || m.marketId.includes(fragment));
  if (matches.length === 0) die(`no market matches "${fragment}"`);
  return matches.sort((a, b) => a.expiry - b.expiry)[0];
}

async function main(): Promise<void> {
  switch (cmd) {
    case "doctor": {
      out("TEMPO doctor — probing chain, indexer, feed, keys");
      out(`network:        ${cfg.network}`);
      out(`indexer:        ${cfg.endpoints.indexerUrl}`);
      out(`rpc:            ${cfg.endpoints.rpcUrl}`);
      out(`ws rpc:         ${cfg.endpoints.wsRpcUrl}`);
      out(`price feed:     ${cfg.endpoints.priceFeed?.url ?? "UNAVAILABLE"}`);
      out(`dry run:        ${cfg.dryRun}`);
      out(`maker key:      ${cfg.keys.maker ? "present" : "ABSENT (read-only)"}`);
      out(`taker key:      ${cfg.keys.taker ? "present" : "ABSENT (read-only)"}`);
      await withExchange(async (ex) => {
        try {
          const rows = await ex.markets();
          out(`live markets:   ${rows.length} (managed assets: ${cfg.assets.join(",")})`);
        } catch (e) {
          out(`live markets:   UNAVAILABLE (${String(e).slice(0, 80)})`);
        }
        try {
          const dec = await ex.collateralDecimals();
          out(`collateral:     ${cfg.addresses.collateral} (${dec} decimals)`);
        } catch (e) {
          out(`collateral:     read failed (${String(e).slice(0, 80)})`);
        }
        for (const asset of cfg.assets) {
          const px = await ex.spot(asset).catch(() => null);
          out(`feed ${asset}:     ${px ? `${fmt(px.price, 2)} (ema ${fmt(px.ema, 2)})` : "UNAVAILABLE"}`);
        }
        if (cfg.keys.maker) {
          const bal = await ex.collateralBalance().catch(() => null);
          out(`maker balance:  ${bal ? `${fmt(bal.human, 2)} collateral` : "read failed"}`);
        }
      });
      break;
    }

    case "markets": {
      await withExchange(async (ex) => {
        const rows = await ex.markets();
        const now = Date.now() / 1000;
        out(
          "symbol".padEnd(40) +
            "asset".padEnd(6) +
            "cad".padEnd(5) +
            "left".padEnd(7) +
            "venue".padEnd(12) +
            "marketId",
        );
        for (const m of rows.sort((a, b) => a.expiry - b.expiry)) {
          const left = Math.max(0, Math.round(m.expiry - now));
          out(
            m.symbol.padEnd(40) +
              m.asset.padEnd(6) +
              `${Math.round(m.intervalSec / 60)}m`.padEnd(5) +
              `${left}s`.padEnd(7) +
              (m.venueId ? m.venueId.slice(0, 10) : "—").padEnd(12) +
              m.marketId.slice(0, 12),
          );
        }
        out(`\n${rows.length} live windows — the venue's own rolling series`);
      });
      break;
    }

    case "book": {
      const fragment = args[1];
      if (!fragment) die("usage: tempo book <symbol-fragment>");
      await withExchange(async (ex) => {
        const m = await resolveMarket(ex, fragment);
        const oc = await ex.onchain(m.marketId);
        if (oc.status !== 1) out(`market status: ${oc.status} (1=Trading) — book may be final`);
        const [params, book, spot, opening] = await Promise.all([
          ex.bookParams(oc.pool),
          ex.book(m.upSymbol, 5),
          ex.spot(m.asset),
          ex.openingPrice(m.marketId),
        ]);
        out(`market:   ${m.symbol}  (${m.asset} ${Math.round(m.intervalSec / 60)}m, ${Math.max(0, Math.round(m.expiry - Date.now() / 1000))}s left)`);
        out(`strike:   ${opening !== undefined ? fmt(opening, 2) : "PENDING (opening price not yet published)"}`);
        out(`spot:     ${spot ? fmt(spot.price, 2) : "UNAVAILABLE"}  [price-feed]`);
        out(`grid:     tick ${params.tick} lot ${params.lot} (${params.decimals} decimals)`);
        out("");
        out("YES book (Up probability):");
        for (const a of book.asks.slice(0, 5).reverse()) out(`  ${fmt(a.price, 3)} × ${fmt(a.size, 1)}`);
        out("  --- touch ---");
        for (const b of book.bids.slice(0, 5)) out(`  ${fmt(b.price, 3)} × ${fmt(b.size, 1)}`);
        if (book.bids.length === 0 && book.asks.length === 0) out("  EMPTY BOOK — no liquidity yet (the genesis gap)");
      });
      break;
    }

    case "watch": {
      const asset = (flag("asset") ?? "").toUpperCase();
      await withExchange(async (ex) => {
        const rows = (await ex.markets()).filter((m) => (asset ? m.asset === asset : true)).slice(0, 6);
        out(`watching ${rows.length} windows (live tail) — ctrl-c to stop`);
        const paramsByMarket = new Map<string, Awaited<ReturnType<TempoExchange["bookParams"]>>>();
        for (const m of rows) {
          const oc = await ex.onchain(m.marketId);
          paramsByMarket.set(m.marketId, await ex.bookParams(oc.pool));
          await ex.sdk.client.watchMarket(oc.pool).catch(() => {});
        }
        let last = "";
        const tick = (): void => {
          const lines: string[] = [];
          for (const m of rows) {
            const book = ex.sdk.client.getLiveBinaryOrderBookByMarket(m.marketId, { depth: 2 });
            const params = paramsByMarket.get(m.marketId);
            const scale = params ? 10 ** params.decimals : undefined;
            const bid = book.yesBids[0] && scale ? Number(book.yesBids[0].price) / scale : null;
            const ask = book.yesAsks[0] && scale ? Number(book.yesAsks[0].price) / scale : null;
            const left = Math.max(0, Math.round(m.expiry - Date.now() / 1000));
            lines.push(
              `${m.symbol.padEnd(30)} ${String(left).padStart(5)}s  ` +
                `${bid !== null ? fmt(bid, 3) : "  —  "}/` +
                `${ask !== null ? fmt(ask, 3) : "  —  "}`,
            );
          }
          const frame = lines.join("\n");
          if (frame !== last) {
            last = frame;
            out("\n" + frame);
          }
        };
        const unsub = ex.sdk.client.subscribeLive(() => tick());
        const timer = setInterval(tick, 1000);
        await new Promise<void>((resolve) => {
          process.once("SIGINT", resolve);
          process.once("SIGTERM", resolve);
        });
        clearInterval(timer);
        unsub();
        ex.sdk.client.stopLive();
      });
      break;
    }

    case "agents":
    case "positions": {
      await withExchange(async (ex) => {
        for (const [name, key] of [["GENESIS", cfg.keys.maker], ["VECTOR", cfg.keys.taker]] as const) {
          out(`== ${name} ${key ? "" : "(no key — READ-ONLY)"}`);
          if (!key) continue;
          const agent = new TempoExchange({ config: cfg, privateKey: key });
          try {
            const bal = await agent.collateralBalance();
            out(`   address:    ${agent.walletAddress}`);
            out(`   collateral: ${fmt(bal.human, 2)} (${bal.decimals} decimals)`);
            if (cmd === "positions") {
              const rows = await agent.markets();
              for (const m of rows.slice(0, 12)) {
                const oc = await agent.onchain(m.marketId);
                if (oc.status === 0 || oc.status === 5) continue;
                const balances = await Promise.all([agent.outcomeBalance(oc, "UP"), agent.outcomeBalance(oc, "DOWN")]).catch(() => null);
                if (!balances) {
                  out(`   ${m.symbol}: UNAVAILABLE`);
                } else if (balances[0] > 0 || balances[1] > 0) {
                  out(`   ${m.symbol}: UP ${fmt(balances[0], 1)} / DOWN ${fmt(balances[1], 1)}`);
                }
              }
            }
          } finally {
            await agent.close().catch(() => {});
          }
        }
      });
      break;
    }

    case "faucet": {
      if (cfg.network !== "testnet") die("faucet is testnet-only");
      const key = cfg.keys.maker ?? cfg.keys.taker;
      if (!key) die("no key configured (TEMPO_KEY_MAKER / TEMPO_KEY_TAKER)");
      await withExchange(async (ex) => {
        const before = await ex.collateralBalance();
        const res = await ex.faucet();
        const after = await ex.collateralBalance();
        out(`faucet tx:  ${short(res.hash)}`);
        out(`balance:    ${fmt(before.human, 2)} → ${fmt(after.human, 2)} (minted on demand, 10k cap/call)`);
      }, true);
      break;
    }

    case "trade": {
      // tempo trade <fragment> <up|down> <qty> [--price p]
      const [, fragment, sideRaw, qtyRaw] = args;
      const side = (sideRaw ?? "").toLowerCase();
      const qty = Number(qtyRaw ?? 0);
      if (!fragment || !["up", "down"].includes(side) || !(qty > 0)) {
        die("usage: tempo trade <symbol-fragment> <up|down> <qty> [--price p]");
      }
      const priceArg = flag("price");
      await withExchange(async (ex) => {
        const m = await resolveMarket(ex, fragment);
        const oc = await ex.onchain(m.marketId);
        if (oc.status !== 1) die(`market not trading (status ${oc.status})`);
        const params = await ex.bookParams(oc.pool);
        let price: number;
        if (priceArg) {
          price = Number(priceArg);
        } else {
          const book = await ex.book(m.upSymbol, 3);
          const askUp = book.asks[0]?.price;
          if (side === "up") {
            if (askUp === undefined) die("no ask on the UP book — pass --price");
            price = askUp;
          } else {
            const bidUp = book.bids[0]?.price;
            if (bidUp === undefined) die("no bid on the UP book — pass --price");
            price = Math.max(params.tick, Math.min(1 - params.tick, 1 - bidUp));
          }
        }
        const size = quantizeSize(qty, params.lotSize, params.decimals);
        if (size <= 0) die(`qty ${qty} is below one lot (${params.lot})`);
        const symbol = side === "up" ? m.upSymbol : m.downSymbol;
        out(`IOC buy ${size} ${symbol} @ ${fmt(price)} …`);
        const res = await ex.place(symbol, "buy", size, price, { ioc: true });
        out(`tx:      ${res.hash ?? "—"}`);
        out(`filled:  ${fmt(res.filled ?? 0, 1)} of ${size}`);
      }, true);
      break;
    }

    case "claims": {
      const doClaim = hasFlag("claim");
      await withExchange(async (ex) => {
        const claimable = await ex.claims(Number(flag("limit", "25")));
        if (claimable.length === 0) {
          out("no recently settled markets");
          return;
        }
        for (const c of claimable) {
          const oc = await ex.onchain(c.marketId);
          if (!oc.isResolved && !oc.isVoided) continue;
          const balances = ex.walletAddress
            ? await Promise.all([ex.outcomeBalance(oc, "UP"), ex.outcomeBalance(oc, "DOWN")]).catch(() => null)
            : null;
          const up = balances?.[0];
          const down = balances?.[1];
          const link = oracleQuestionUrl(c.oracleQuestionId);
          out(
            `${c.marketId.slice(0, 14)}  ${oc.isVoided ? "VOIDED (both 0.5)" : `winner ${oc.winningOutcome === 0 ? "UP" : "DOWN"}`}  ` +
              `held UP ${up === undefined ? "UNAVAILABLE" : fmt(up, 1)} / DOWN ${down === undefined ? "UNAVAILABLE" : fmt(down, 1)}  ${link ? `\n   oracle: ${link}` : ""}`,
          );
          if (doClaim) {
            if (up === undefined || down === undefined) die("claim balances are UNAVAILABLE");
            for (const s of oc.isVoided ? (["UP", "DOWN"] as const) : ([oc.winningOutcome === 0 ? "UP" : "DOWN"] as const)) {
              if ((s === "UP" ? up : down) <= 0) continue;
              const res = await ex.redeem(c.marketId, oc, s);
              out(`   redeemed ${s}: ${short(res.hash)}`);
            }
          }
        }
      }, doClaim);
      break;
    }

    case "settlements": {
      await withExchange(async (ex) => {
        const past = await ex.pastMarkets({ limit: Number(flag("limit", "10")) });
        for (const p of past) {
          const expiry = Number(p.expiry);
          const oid = p.oracleQuestionId !== undefined && p.oracleQuestionId !== null ? String(p.oracleQuestionId) : undefined;
          out(
            `${String(p.asset)} ${String(Number(p.intervalSec) / 60)}m expired ${new Date(expiry * 1000).toISOString()}  ` +
              `trades ${String(p.tradeCount)}  last ${p.lastPrice ? formatUnits(BigInt(String(p.lastPrice)), Number(p.quoteDecimals ?? p.baseDecimals)) : "—"}` +
              (oid ? `\n   oracle: https://prd.oracle.somnia.host/questions/${oid}?view=graph` : ""),
          );
        }
      });
      break;
    }

    case "activity": {
      const { Firm } = await import("@tempo/engine");
      void Firm;
      const { Journal } = await import("@tempo/core");
      const j = new Journal(cfg.journalDir, "tempo");
      const n = Number(flag("n", "40"));
      const recs = j.readFiles().slice(-n);
      for (const r of recs) {
        const base = `${r.ts.slice(11, 19)} ${r.type.padEnd(15)} ${r.agent ?? "firm".padEnd(7)} ${r.symbol ?? r.marketId?.slice(0, 14) ?? ""}`;
        const extra = r.tx ? ` tx=${short(r.tx)}` : "";
        const data = r.data ? ` ${JSON.stringify(r.data).slice(0, 110)}` : "";
        out(base + extra + data);
      }
      if (recs.length === 0) out("(journal is empty — run `tempo firm simulate` or `tempo firm start`)");
      process.exit(0);
      break;
    }

    case "backtest": {
      await withExchange(async (ex) => {
        const rows = await ex.backtest(Number(flag("limit", "10")));
        out("real-feed midpoint fair-value backtest (AI ESTIMATE; finalized outcome is chain fact)");
        for (const row of rows) {
          out(
            `${row.asset.padEnd(4)} ${new Date(row.expiry * 1000).toISOString()}  ` +
              (row.status === "EVALUATED"
                ? `estimate ${fmt(row.estimate!, 4)} outcome ${row.outcome} brier ${fmt(row.brier!, 4)} samples ${row.samples}`
                : `NO DATA (${row.reason})`),
          );
        }
        const evaluated = rows.filter((row) => row.status === "EVALUATED");
        out(
          evaluated.length
            ? `mean Brier ${fmt(evaluated.reduce((sum, row) => sum + row.brier!, 0) / evaluated.length, 4)} over ${evaluated.length} real windows`
            : "mean Brier: NO DATA",
        );
      });
      break;
    }

    case "verify": {
      const { Journal } = await import("@tempo/core");
      const { createPublicClient, http } = await import("viem");
      const { somniaShannon, somniaMainnet } = await import("@somnia-chain/markets-sdk/chains");
      const j = new Journal(cfg.journalDir, "tempo");
      const recs = j.readFiles(Date.now() - 7 * 24 * 3600_000);
      const txRecords = recs.filter((r) => r.tx);
      out(`journal records (7d): ${recs.length}, carrying tx hashes: ${txRecords.length}`);
      const chain = cfg.network === "testnet" ? somniaShannon : somniaMainnet;
      const client = createPublicClient({ chain, transport: http(cfg.endpoints.rpcUrl) });
      const hashes = [...new Set(txRecords.map((r) => r.tx!))];
      let ok = 0;
      let fail = 0;
      for (const h of hashes.slice(0, 50)) {
        try {
          const receipt = await client.getTransactionReceipt({ hash: h as `0x${string}` });
          ok++;
          out(`  ${h} block=${receipt.blockNumber} status=${receipt.status}`);
        } catch (e) {
          fail++;
          out(`  ${h} NOT FOUND on chain (${String(e).slice(0, 60)})`);
        }
      }
      out(`\nverified ${ok}/${hashes.length} transaction hashes against ${cfg.network} (failed: ${fail})`);
      process.exit(0);
      break;
    }

    case "firm": {
      const mode = args[1] ?? "simulate";
      const { Firm, TempoServer } = await import("@tempo/engine");
      const firm = new Firm(cfg);
      const simulate = mode === "simulate";
      const realCfg = { ...cfg, dryRun: simulate ? true : cfg.dryRun };
      if (simulate) {
        // simulate: force dry-run regardless of env
        const firmDry = new Firm(realCfg);
        const port = Number(flag("port", "7333"));
        const host = flag("host", process.env.TEMPO_HTTP_HOST ?? "127.0.0.1")!;
        const webDir = new URL("../../web/public/", import.meta.url).pathname;
        const server = new TempoServer(firmDry, port, webDir, { host });
        out(`TEMPO firm — SIMULATE (decisions journaled, nothing sent)`);
        out(`dashboard: ${dashboardUrl(host, port)}`);
        await server.start();
        await firmDry.start();
        await new Promise<void>((resolve) => {
          let stopping = false;
          const stop = async (): Promise<void> => {
            if (stopping) return;
            stopping = true;
            await firmDry.stop();
            await server.stop();
            resolve();
          };
          process.once("SIGINT", () => void stop());
          process.once("SIGTERM", () => void stop());
        });
        return;
      }
      if (mode !== "start") die("usage: tempo firm simulate|start");
      if (!cfg.keys.maker && !cfg.keys.taker) {
        die("no agent keys configured — set TEMPO_KEY_MAKER / TEMPO_KEY_TAKER in .env (or run `tempo firm simulate`)");
      }
      const port = Number(flag("port", "7333"));
      const host = flag("host", process.env.TEMPO_HTTP_HOST ?? "127.0.0.1")!;
      const webDir = new URL("../../web/public/", import.meta.url).pathname;
      const server = new TempoServer(firm, port, webDir, { host });
      out(`TEMPO firm — ${cfg.dryRun ? "DRY-RUN" : "LIVE (real orders, real funds)"}`);
      out(`dashboard: ${dashboardUrl(host, port)}`);
      await server.start();
      await firm.start();
      await new Promise<void>((resolve) => {
        let stopping = false;
        const stop = async (): Promise<void> => {
          if (stopping) return;
          stopping = true;
          await firm.stop();
          await server.stop();
          resolve();
        };
        process.once("SIGINT", () => void stop());
        process.once("SIGTERM", () => void stop());
      });
      return;
    }

    default: {
      out("TEMPO — the autonomous opening auction for DreamDEX Event Contracts");
      out("");
      out("  doctor                  probe chain/indexer/feed/keys (read-only)");
      out("  markets                 live windows: series, seconds-left, venue");
      out("  book <frag>             one window's book + strike + spot + grid");
      out("  watch [--asset BTC]     streaming book view (live tail)");
      out("  agents                  firm roster + balances");
      out("  positions               outcome balances per agent");
      out("  firm simulate [--host H --port N]  run dry, local-only by default");
      out("  firm start [--host H --port N]     run for real (keys required)");
      out("  trade <frag> <up|down> <qty> [--price p]   manual IOC order");
      out("  claims [--claim]        settled markets + redeem winnings");
      out("  settlements             recently settled windows + oracle links");
      out("  backtest [--limit N]    real-feed fair-value replay on finalized windows");
      out("  activity [--n 50]       journal tape: events → decisions → txs");
      out("  verify                  cross-check journal tx hashes on-chain");
      out("  faucet                  mint testnet collateral (testnet, keys required)");
      process.exit(0);
    }
  }
}

void main()
  .then(() => process.exit(0))
  .catch((e) => die(String(e)));
