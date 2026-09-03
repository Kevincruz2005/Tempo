import { readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";

const listed = spawnSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" });
if (listed.status !== 0) throw new Error("git ls-files failed");

const excluded = /^(?:node_modules|coverage|dist|journal|test\/artifacts)\//;
const sensitiveName = /(?:^|\/)(?:\.env|.*(?:private[-_.]?key|mnemonic|keystore|credentials?).*)$/i;
const allowedNames = new Set([".env.example"]);
const patterns: Array<[string, RegExp]> = [
  ["assigned 32-byte private key", /(?:private.?key|maker.?key|taker.?key|TEMPO_KEY_(?:MAKER|TAKER))\s*[:=]\s*["']0x[0-9a-f]{64}["']/i],
  ["PEM private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["GitHub token", /github_pat_[A-Za-z0-9_]{40,}|gh[opsu]_[A-Za-z0-9]{36,}/],
  ["OpenAI API key", /sk-(?:proj-)?[A-Za-z0-9_-]{32,}/],
  ["AWS access key", /AKIA[0-9A-Z]{16}/],
];

const findings: string[] = [];
for (const path of listed.stdout.split("\0").filter(Boolean)) {
  if (excluded.test(path)) continue;
  if (sensitiveName.test(path) && !allowedNames.has(path)) findings.push(`${path}: sensitive filename is tracked or unignored`);
  let stat;
  try { stat = statSync(path); } catch { continue; }
  if (!stat.isFile() || stat.size > 2_000_000) continue;
  let content: string;
  try { content = readFileSync(path, "utf8"); } catch { continue; }
  if (content.includes("\0")) continue;
  for (const [label, pattern] of patterns) if (pattern.test(content)) findings.push(`${path}: ${label}`);
}

if (findings.length) {
  process.stderr.write(`Secret scan failed:\n${findings.map((finding) => `- ${finding}`).join("\n")}\n`);
  process.exit(1);
}
process.stdout.write(`Secret scan PASS (${listed.stdout.split("\0").filter(Boolean).length} repository files inspected)\n`);
