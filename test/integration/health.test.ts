import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { Journal } from "@tempo/core";
import { TempoServer, type ReadinessResult } from "@tempo/engine";

const servers: TempoServer[] = [];
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.stop()));
  roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }));
});

function fakeFirm(readiness: () => Promise<ReadinessResult>) {
  const root = mkdtempSync(join(tmpdir(), "tempo-health-"));
  roots.push(root);
  mkdirSync(root, { recursive: true });
  return {
    journal: new Journal(root, "health-test"),
    snapshot: async () => ({}),
    readiness,
  } as never;
}

async function request(server: TempoServer, path: string, init: RequestInit = {}): Promise<Response> {
  const port = server.listeningPort();
  if (!port) throw new Error("server did not bind");
  return fetch(`http://127.0.0.1:${port}${path}`, { ...init, headers: { host: `127.0.0.1:${port}`, ...(init.headers ?? {}) } });
}

const healthy = (): ReadinessResult => ({
  ok: true,
  checkedAt: new Date().toISOString(),
  checks: { indexer: { ok: true }, rpc: { ok: true, block: "123" }, prices: { BTC: { ok: true }, ETH: { ok: true } } },
});

describe("health and readiness boundary", () => {
  it("returns a deterministic health body without dependency or secret data", async () => {
    const server = new TempoServer(fakeFirm(async () => healthy()), 0, tmpdir());
    servers.push(server);
    await server.start();
    const response = await request(server, "/health");
    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    expect(body).toMatchObject({ status: "ok", service: "tempo", version: "1.0.0" });
    expect(JSON.stringify(body)).not.toMatch(/private|secret|rpc|indexer|address|TEMPO_KEY/i);
  });

  it("returns cached readiness and a safe 503 when a dependency fails", async () => {
    let calls = 0;
    const server = new TempoServer(fakeFirm(async () => { calls++; return healthy(); }), 0, tmpdir());
    servers.push(server);
    await server.start();
    expect((await request(server, "/ready")).status).toBe(200);
    expect((await request(server, "/ready")).status).toBe(200);
    expect(calls).toBe(1);

    const failed = new TempoServer(fakeFirm(async () => ({
      ok: false,
      checkedAt: new Date().toISOString(),
      checks: { indexer: { ok: false }, rpc: { ok: false }, prices: { BTC: { ok: false } } },
    })), 0, tmpdir());
    servers.push(failed);
    await failed.start();
    const response = await request(failed, "/ready");
    expect(response.status).toBe(503);
    const body = await response.text();
    expect(body).toContain('"status":"not_ready"');
    expect(body).not.toMatch(/https?:|private|secret|address|TEMPO_KEY/i);
  });

  it("rejects malformed methods at the HTTP boundary", async () => {
    const server = new TempoServer(fakeFirm(async () => healthy()), 0, tmpdir());
    servers.push(server);
    await server.start();
    expect((await request(server, "/health", { method: "POST" })).status).toBe(405);
  });
});

