// Records the real Mattermost room the gate ruled in (local stack, seeded test user from .env; nothing secret is printed).
import { chromium } from "/Users/ansh/CLAUDE/firedrill/dashboard/node_modules/@playwright/test/index.mjs";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const OUT = "/private/tmp/claude-501/-Users-ansh-CLAUDE/c58980f1-c10a-4936-8e86-e0cca7549fd6/scratchpad/cap/mm";
const env = Object.fromEntries(readFileSync("/Users/ansh/CLAUDE/firedrill/.env", "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const base = `http://localhost:${env.MATTERMOST_HOST_PORT || 8065}`;
const mode = process.argv[2] || "shot";
rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const p = await ctx.newPage();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await p.goto(`${base}/login`); await wait(2500);
if (new URL(p.url()).pathname === "/landing") { await p.getByRole("link", { name: "View in Browser" }).click(); await wait(3500); }
await p.locator("#input_loginId").fill(env.MATTERMOST_USER || "user");
await p.locator("#input_password-input").fill(env.MATTERMOST_USER_PASSWORD);
await p.locator("#saveSetting").click(); await wait(4000);
console.log("after login:", new URL(p.url()).pathname);
// skip onboarding prompts if any
for (const label of [/skip/i, /not now/i, /no thanks/i, /dismiss/i]) { const b = p.getByRole("button", { name: label }).first(); if (await b.count()) await b.click().catch(() => {}); }
await wait(1500);
const link = p.getByText("firedrill-idempotency-race", { exact: false }).first();
console.log("channel link:", await link.count());
if (await link.count()) { await link.click(); await wait(3000); }
await p.screenshot({ path: `${OUT}/shot.png` });
console.log("url:", new URL(p.url()).pathname);
if (mode === "clip") {
  const cdp = await ctx.newCDPSession(p);
  const frames = []; let n = 0;
  cdp.on("Page.screencastFrame", async (e) => {
    const file = `f${String(n++).padStart(5, "0")}.jpg`;
    writeFileSync(`${OUT}/${file}`, Buffer.from(e.data, "base64"));
    frames.push({ file, t: e.metadata.timestamp });
    cdp.send("Page.screencastFrameAck", { sessionId: e.sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  await wait(2500);
  const list = p.locator("#postListContent, .post-list__dynamic").first();
  for (let i = 0; i < 18; i++) { await p.mouse.move(900, 500); await p.mouse.wheel(0, -260); await wait(180); }
  await wait(1500);
  for (let i = 0; i < 18; i++) { await p.mouse.wheel(0, 260); await wait(180); }
  await wait(1500);
  const replies = p.getByText(/\d+ repl(y|ies)/);
  const n2 = await replies.count();
  if (n2) { await replies.nth(n2 - 1).click(); await wait(4500); }
  const first = n2 > 2 ? replies.nth(n2 - 3) : null;
  if (first) { await first.click(); await wait(4500); }
  await cdp.send("Page.stopScreencast").catch(() => {});
  const end = frames[frames.length - 1].t + 0.2;
  writeFileSync(`${OUT}/list.txt`, frames.map((f, i) => `file '${f.file}'\nduration ${((frames[i + 1]?.t ?? end) - f.t).toFixed(4)}`).join("\n") + `\nfile '${frames[frames.length - 1].file}'\n`);
  console.log("frames", frames.length);
}
await browser.close();
