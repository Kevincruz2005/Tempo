import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "@tempo/core";

const names = [
  "TEMPO_NETWORK",
  "TEMPO_DRY_RUN",
  "TEMPO_RPC_URL",
  "TEMPO_WS_RPC_URL",
  "TEMPO_INDEXER_URL",
  "TEMPO_EXPLORER_URL",
] as const;
const saved = Object.fromEntries(names.map((name) => [name, process.env[name]]));
afterEach(() => {
  for (const name of names) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
});

describe("loadConfig", () => {
  it("defaults writes to dry-run and uses verified testnet endpoints", () => {
    process.env.TEMPO_NETWORK = "testnet";
    delete process.env.TEMPO_DRY_RUN;
    const cfg = loadConfig("/tmp");
    expect(cfg.dryRun).toBe(true);
    expect(cfg.endpoints.indexerUrl).toBe("https://dev.smk.somnia.host/v1/graphql");
    expect(cfg.endpoints.rpcUrl).toBe("https://api.infra.testnet.somnia.network");
  });

  it("treats blank endpoint overrides as absent", () => {
    process.env.TEMPO_NETWORK = "testnet";
    process.env.TEMPO_RPC_URL = "";
    process.env.TEMPO_WS_RPC_URL = "  ";
    process.env.TEMPO_INDEXER_URL = "";
    process.env.TEMPO_EXPLORER_URL = "\t";
    const cfg = loadConfig("/tmp");
    expect(cfg.endpoints.rpcUrl).toBe("https://api.infra.testnet.somnia.network");
    expect(cfg.endpoints.wsRpcUrl).toBe("wss://api.infra.testnet.somnia.network/ws");
    expect(cfg.endpoints.indexerUrl).toBe("https://dev.smk.somnia.host/v1/graphql");
    expect(cfg.endpoints.explorerUrl).toBe("https://shannon-explorer.somnia.network");
  });
});
