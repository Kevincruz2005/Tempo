/**
 * Journal — the observability spine. Every event, decision, order, fill,
 * settlement, claim, and error is appended as one typed JSONL record with
 * provenance. The web UI, `tempo activity`, and `tempo verify` all read this.
 *
 * Nothing here invents values: records carry what actually happened, with the
 * exact inputs a decision saw.
 */
import { createWriteStream, mkdirSync, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { WriteStream } from "node:fs";

export type JournalType =
  | "startup"
  | "market-birth"
  | "market-state"
  | "price"
  | "decision"
  | "order-sent"
  | "order-receipt"
  | "order-cancelled"
  | "fill"
  | "risk-reject"
  | "error"
  | "settlement"
  | "claim"
  | "shutdown";

export interface JournalRecord {
  ts: string;
  type: JournalType;
  agent?: string;
  /** What produced this record: feed endpoint, indexer, contract, policy name. */
  source?: string;
  marketId?: string;
  symbol?: string;
  /** Free-form payload — real values only. */
  data?: Record<string, unknown>;
  /** Transaction hash when a write actually landed. */
  tx?: string;
  block?: number;
}

export class Journal {
  private stream: WriteStream | null = null;
  private listeners = new Set<(r: JournalRecord) => void>();
  private recent: JournalRecord[] = [];

  constructor(private dir: string, private name = "tempo") {}

  open(): void {
    mkdirSync(this.dir, { recursive: true });
    const file = join(this.dir, `${this.name}-${new Date().toISOString().slice(0, 10)}.jsonl`);
    this.stream = createWriteStream(file, { flags: "a" });
  }

  append(rec: Omit<JournalRecord, "ts"> & { ts?: string }): JournalRecord {
    const full: JournalRecord = { ts: rec.ts ?? new Date().toISOString(), ...rec } as JournalRecord;
    const line = JSON.stringify(full);
    this.stream?.write(line + "\n");
    this.recent.push(full);
    if (this.recent.length > 2000) this.recent.splice(0, 1000);
    for (const l of this.listeners) {
      try {
        l(full);
      } catch {
        /* listener errors never break the journal */
      }
    }
    return full;
  }

  subscribe(l: (r: JournalRecord) => void): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  /** Last N records (newest last), optionally filtered. */
  tail(n = 100, filter?: (r: JournalRecord) => boolean): JournalRecord[] {
    const src = this.recent.filter(filter ?? (() => true));
    return src.slice(-n);
  }

  /** Records at or after an ISO timestamp or epoch millisecond value. */
  since(from: string | number): JournalRecord[] {
    const sinceMs = typeof from === "number" ? from : Date.parse(from);
    if (!Number.isFinite(sinceMs)) return [];
    const disk = this.readFiles(sinceMs);
    const known = new Set(disk.map((record) => JSON.stringify(record)));
    for (const record of this.recent) {
      const encoded = JSON.stringify(record);
      if (Date.parse(record.ts) >= sinceMs && !known.has(encoded)) disk.push(record);
    }
    return disk.sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
  }

  /** Deterministically replay records in chronological order. */
  replay<T>(records: readonly JournalRecord[], initial: T, reduce: (state: T, record: JournalRecord) => T): T {
    return [...records]
      .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts))
      .reduce(reduce, initial);
  }

  /** Read records from journal files on disk (for `tempo verify` across days). */
  readFiles(sinceMs = 0): JournalRecord[] {
    if (!existsSync(this.dir)) return [];
    const out: JournalRecord[] = [];
    for (const f of readdirSafe(this.dir)) {
      if (!f.endsWith(".jsonl")) continue;
      const path = join(this.dir, f);
      try {
        if (statSync(path).mtimeMs < sinceMs) continue;
        for (const line of readFileSync(path, "utf8").split("\n")) {
          if (!line.trim()) continue;
          try {
            const rec = JSON.parse(line) as JournalRecord;
            if (Date.parse(rec.ts) >= sinceMs) out.push(rec);
          } catch {
            /* skip corrupt line honestly */
          }
        }
      } catch {
        /* unreadable file: skip */
      }
    }
    return out.sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
  }

  close(): void {
    this.stream?.end();
    this.stream = null;
  }
}

function readdirSafe(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}
