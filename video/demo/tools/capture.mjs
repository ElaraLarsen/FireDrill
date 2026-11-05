// Records the real dashboard (served by the compose stack on :5173) into numbered JPEG frames, one folder per clip.
import { chromium } from "/Users/ansh/CLAUDE/firedrill/dashboard/node_modules/@playwright/test/index.mjs";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";

const OUT = "/private/tmp/claude-501/-Users-ansh-CLAUDE/c58980f1-c10a-4936-8e86-e0cca7549fd6/scratchpad/cap";
const BASE = "http://localhost:5173";
const LIVE = "gate%3A54414f3d-544a-4925-8138-e98406916860";
const only = process.argv[2];

const browser = await chromium.launch({ channel: "chrome" });

async function clip(name, viewport, script, opts = {}) {
  if (only && only !== name) return;
  const dir = `${OUT}/${name}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: opts.dsf ?? 1, ...(opts.mobile ? { isMobile: true, hasTouch: true } : {}) });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  const frames = [];
  let n = 0;
  cdp.on("Page.screencastFrame", async (e) => {
    const file = `f${String(n++).padStart(5, "0")}.jpg`;
    writeFileSync(`${dir}/${file}`, Buffer.from(e.data, "base64"));
    frames.push({ file, t: e.metadata.timestamp });
    cdp.send("Page.screencastFrameAck", { sessionId: e.sessionId }).catch(() => {});
  });
  const W = viewport.width * (opts.dsf ?? 1), H = viewport.height * (opts.dsf ?? 1);
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
  const t0 = Date.now();
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  await script(p, wait);
  await wait(300);
  await cdp.send("Page.stopScreencast").catch(() => {});
  const secs = (Date.now() - t0) / 1000;
  const end = frames.length ? frames[frames.length - 1].t + 0.2 : 0;
  // an ffmpeg concat list with each frame held until the next one arrives: constant-frame-rate output keeps real timing
  const list = frames.map((f, i) => `file '${f.file}'\nduration ${((frames[i + 1]?.t ?? end) - f.t).toFixed(4)}`).join("\n") + `\nfile '${frames[frames.length - 1].file}'\n`;
  writeFileSync(`${dir}/list.txt`, list);
  writeFileSync(`${dir}/meta.json`, JSON.stringify({ frames: frames.length, seconds: +secs.toFixed(2), span: +(end - frames[0].t).toFixed(2) }));
  console.log(name, JSON.stringify({ frames: frames.length, seconds: Math.round(secs), avgFps: +(frames.length / (end - frames[0].t)).toFixed(1) }));
  await ctx.close();
}

const HD = { width: 1920, height: 1080 };
const smoothScroll = async (p, wait, total, steps, gap) => { for (let i = 0; i < steps; i++) { await p.mouse.wheel(0, total / steps); await wait(gap); } };

await clip("landing", HD, async (p, wait) => {
  await p.goto(`${BASE}/#/`); await wait(4500);
  await smoothScroll(p, wait, 900, 30, 60); await wait(2500);
  await smoothScroll(p, wait, 1100, 36, 60); await wait(2500);
  await smoothScroll(p, wait, 1300, 40, 60); await wait(2500);
  await smoothScroll(p, wait, 1300, 40, 60); await wait(2500);
  await smoothScroll(p, wait, 2600, 60, 60); await wait(3500);
});

await clip("run", HD, async (p, wait) => {
  await p.goto(`${BASE}/#/cases`); await wait(3500);
  await p.goto(`${BASE}/#/case/${LIVE}/case?step=0`); await wait(3200);
  await p.getByRole("button", { name: "Open the console" }).click(); await wait(1800);
  const input = p.getByLabel(/Command prompt/);
  await input.pressSequentially("run", { delay: 160 }); await input.press("Enter");
  await p.waitForFunction(() => /step=4[0-2]/.test(location.hash), null, { timeout: 170000 }).catch(() => {});
  await wait(6000);
});

await clip("console", HD, async (p, wait) => {
  await p.goto(`${BASE}/#/case/${LIVE}/ruling?step=24`); await wait(3200);
  await p.getByRole("button", { name: "Open the console" }).click(); await wait(1800);
  const input = p.getByLabel(/Command prompt/);
  const say = async (t, hold = 2200) => { await input.pressSequentially(t, { delay: 120 }); await input.press("Enter"); await wait(hold); };
  await say("help", 3500);
  await say("status", 2800);
  await p.getByRole("button", { name: "Large", exact: true }).click(); await wait(2200);
  await p.getByRole("button", { name: "Normal size", exact: true }).click(); await wait(1500);
  await say("back 3", 2200);
  await say("goto attack", 3000);
  await say("next 8", 3500);
  await say("goto signoff", 3000);
  await say("case ratelimit-boundary", 3500);
  await p.getByRole("button", { name: "Prompt only", exact: true }).click(); await wait(2000);
  await p.getByRole("button", { name: "Close the console" }).click(); await wait(2500);
});

await clip("cases", HD, async (p, wait) => {
  await p.goto(`${BASE}/#/cases`); await wait(4000);
  await smoothScroll(p, wait, 700, 24, 60); await wait(3000);
});

await clip("phone", { width: 390, height: 844 }, async (p, wait) => {
  await p.goto(`${BASE}/#/`); await wait(3500);
  await smoothScroll(p, wait, 1400, 40, 70); await wait(1500);
  await p.goto(`${BASE}/#/case/${LIVE}/attack?step=30`); await wait(2500);
  await p.getByRole("button", { name: "Open the console" }).tap(); await wait(2500);
  await p.getByRole("button", { name: "Close the console" }).tap(); await wait(1500);
  await smoothScroll(p, wait, 1200, 36, 70); await wait(1500);
}, { dsf: 2, mobile: true });

await browser.close();
