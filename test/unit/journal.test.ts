import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Journal } from "@tempo/core";

describe("Journal", () => {
  it("tails, filters, and replays typed records", () => {
    const journal = new Journal("/tmp/tempo-unit-journal-does-not-open");
    journal.append({ ts: "2026-09-02T00:00:00.000Z", type: "startup" });
    journal.append({ ts: "2026-09-02T00:00:01.000Z", type: "decision", agent: "GENESIS" });
    expect(journal.tail(1)[0]?.type).toBe("decision");
    expect(journal.since("2026-09-02T00:00:00.500Z")).toHaveLength(1);
    expect(journal.replay(journal.tail(), 0, (count) => count + 1)).toBe(2);
  });

  it("flushes appended records before close resolves", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tempo-journal-"));
    try {
      const journal = new Journal(dir, "flush");
      journal.open();
      journal.append({ type: "order-receipt", tx: `0x${"1".repeat(64)}` });
      await journal.close();
      const records = journal.readFiles();
      expect(records).toHaveLength(1);
      expect(readFileSync(join(dir, `flush-${new Date().toISOString().slice(0, 10)}.jsonl`), "utf8")).toContain("order-receipt");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
