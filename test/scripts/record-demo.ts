import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const url = process.env.TEMPO_DEMO_URL ?? "http://127.0.0.1:7433";
const durationMs = Number(process.env.TEMPO_DEMO_DURATION_MS ?? 90_000);
const port = Number(process.env.TEMPO_DEMO_CDP_PORT ?? 9223);
const output = process.env.TEMPO_DEMO_OUTPUT ?? "test/reports/tempo-demo-90s.mp4";
const work = mkdtempSync(join(tmpdir(), "tempo-demo-"));
const profile = join(work, "chrome-profile");
mkdirSync(profile);

const chrome = spawn(
  "google-chrome",
  [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--disable-gpu",
    "--hide-scrollbars",
    "--window-size=1440,900",
    "about:blank",
  ],
  { stdio: "ignore" },
);

type CdpMessage = { id?: number; method?: string; params?: Record<string, unknown>; error?: { message: string } };

async function endpoint(): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const pages = (await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json())) as Array<{
        type: string;
        webSocketDebuggerUrl: string;
      }>;
      const page = pages.find((entry) => entry.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // Chrome has not opened its debugging endpoint yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Chrome DevTools endpoint did not become ready");
}

async function run(): Promise<void> {
  const socket = new WebSocket(await endpoint());
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener("open", () => resolve(), { once: true });
    socket.addEventListener("error", () => reject(new Error("Chrome DevTools WebSocket failed")), { once: true });
  });

  let commandId = 0;
  const pending = new Map<number, { resolve: () => void; reject: (error: Error) => void }>();
  const frames: Array<{ path: string; at: number }> = [];
  let lastFrameAt = 0;
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data)) as CdpMessage;
    if (message.id) {
      const waiter = pending.get(message.id);
      if (!waiter) return;
      pending.delete(message.id);
      if (message.error) waiter.reject(new Error(message.error.message));
      else waiter.resolve();
      return;
    }
    if (message.method !== "Page.screencastFrame") return;
    const params = message.params as { data: string; sessionId: number };
    const now = Date.now();
    if (now - lastFrameAt >= 900) {
      const path = join(work, `frame-${String(frames.length).padStart(4, "0")}.jpg`);
      writeFileSync(path, Buffer.from(params.data, "base64"));
      frames.push({ path, at: now });
      lastFrameAt = now;
    }
    socket.send(JSON.stringify({ id: ++commandId, method: "Page.screencastFrameAck", params: { sessionId: params.sessionId } }));
  });

  const call = (method: string, params: Record<string, unknown> = {}) =>
    new Promise<void>((resolve, reject) => {
      const id = ++commandId;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });

  await call("Page.enable");
  await call("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await call("Page.navigate", { url });
  await new Promise((resolve) => setTimeout(resolve, 5_000));
  const startedAt = Date.now();
  await call("Page.startScreencast", { format: "jpeg", quality: 85, maxWidth: 1440, maxHeight: 900, everyNthFrame: 1 });
  await new Promise((resolve) => setTimeout(resolve, durationMs));
  await call("Page.stopScreencast");
  socket.close();

  if (frames.length < 2) throw new Error(`Only ${frames.length} screencast frames were captured`);
  const manifest = frames.flatMap((frame, index) => {
    const nextAt = frames[index + 1]?.at ?? startedAt + durationMs;
    return [`file '${frame.path.replaceAll("'", "'\\''")}'`, `duration ${Math.max(0.1, (nextAt - frame.at) / 1000).toFixed(3)}`];
  });
  manifest.push(`file '${frames.at(-1)!.path.replaceAll("'", "'\\''")}'`);
  const manifestPath = join(work, "frames.txt");
  writeFileSync(manifestPath, `${manifest.join("\n")}\n`);
  mkdirSync(join(output, ".."), { recursive: true });
  await new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn(
      "ffmpeg",
      ["-y", "-f", "concat", "-safe", "0", "-i", manifestPath, "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-movflags", "+faststart", output],
      { stdio: "inherit" },
    );
    ffmpeg.once("error", reject);
    ffmpeg.once("exit", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))));
  });
  console.log(`Recorded ${frames.length} live dashboard frames to ${output}`);
}

try {
  await run();
} finally {
  chrome.kill("SIGTERM");
  rmSync(work, { recursive: true, force: true });
}
