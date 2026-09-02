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
});
