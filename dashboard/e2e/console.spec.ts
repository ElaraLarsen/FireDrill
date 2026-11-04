import { expect, test } from "@playwright/test";
import { openCase, openConsole, step, type, watch } from "./helpers";

test.describe("console: hidden until asked for", () => {
  test("starts as a small pill, with no window and no log on screen", async ({ page }) => {
    const errors = watch(page);
    await openCase(page);
    await expect(page.getByRole("dialog", { name: "Console" })).toHaveCount(0);
    await expect(page.getByRole("log")).toHaveCount(0);
    const pill = await page.getByRole("button", { name: "Open the console" }).boundingBox();
    expect(pill!.height).toBeLessThan(64);
    expect(errors()).toEqual([]);
  });

  test("opens with an animation, focuses the prompt, and Escape puts it away", async ({ page }) => {
    await openCase(page);
    await page.getByRole("button", { name: "Open the console" }).click();
    const win = page.getByRole("dialog", { name: "Console" });
    // Mid-animation it is still fading in; it settles fully opaque.
    const early = await win.evaluate((el) => Number(getComputedStyle(el).opacity));
    expect(early).toBeLessThan(1);
    await expect.poll(() => win.evaluate((el) => Number(getComputedStyle(el).opacity))).toBe(1);
    await expect(page.getByLabel(/Command prompt/)).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(win).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Open the console" })).toBeFocused();
  });

  test("the slash and backtick keys open it from anywhere on the page", async ({ page }) => {
    await openCase(page);
    await page.keyboard.press("/");
    await expect(page.getByRole("dialog", { name: "Console" })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.keyboard.press("`");
    await expect(page.getByRole("dialog", { name: "Console" })).toBeVisible();
  });

  test("is glass: frosted backdrop, translucent fill, and no solid black", async ({ page }) => {
    await openCase(page);
    const win = await openConsole(page);
    const css = await win.evaluate((el) => { const c = getComputedStyle(el); return { f: c.backdropFilter || c.webkitBackdropFilter, bg: c.backgroundImage + c.backgroundColor }; });
    expect(css.f).toMatch(/blur\(\d+px\)/);
    expect(css.bg).toMatch(/rgba?\(|color\(|oklab/);
    expect(css.bg).not.toMatch(/rgb\(10, 31, 21\)/);
  });
});

test.describe("console: the three dots work", () => {
  test("red hides it, yellow shrinks it to the prompt and back, green grows it and back", async ({ page }) => {
    await openCase(page, "idempotency-race", "case", 12);
    const win = await openConsole(page);
    const log = page.locator("[role=log]");
    const height = async () => (await log.boundingBox())?.height ?? 0;
    await expect.poll(height).toBeGreaterThan(150);
    const normal = await height();

    await page.getByRole("button", { name: "Make the console bigger" }).click();
    await expect.poll(height).toBeGreaterThan(normal + 100);
    await page.getByRole("button", { name: "Back to normal size" }).click();
    await expect.poll(async () => Math.abs((await height()) - normal)).toBeLessThan(4);

    await page.getByRole("button", { name: "Shrink to just the prompt" }).click();
    // The log is clipped to nothing: the window is just its two bars, and the hidden log cannot be tabbed into.
    await expect.poll(async () => (await win.boundingBox())?.height ?? 0).toBeLessThan(120);
    await expect(log).not.toBeInViewport({ ratio: 0.01 });
    await expect(page.getByLabel(/Command prompt/)).toBeVisible();
    await page.getByRole("button", { name: "Show the log again" }).click();
    await expect.poll(height).toBeGreaterThan(150);

    await page.getByRole("button", { name: "Close the console" }).click();
    await expect(win).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Open the console" })).toBeVisible();
  });

  test("a command typed while shrunk opens the log so its answer is visible", async ({ page }) => {
    await openCase(page);
    await openConsole(page);
    await page.getByRole("button", { name: "Shrink to just the prompt" }).click();
    await type(page, "help");
    await expect.poll(async () => (await page.locator("[role=log]").boundingBox())?.height ?? 0).toBeGreaterThan(150);
    await expect(page.getByRole("log")).toContainText("goto <page>");
  });

  test("each dot shows its glyph when you point at them", async ({ page }) => {
    await openCase(page);
    await openConsole(page);
    const glyph = page.getByRole("button", { name: "Close the console" }).locator("svg");
    await expect(glyph).toHaveCSS("opacity", "0");
    await page.getByRole("button", { name: "Close the console" }).hover();
    await expect(glyph).toHaveCSS("opacity", "1");
  });
});

test.describe("console: the prompt drives the replay", () => {
  test("Enter on an empty prompt runs one step; the transcript gains exactly one line", async ({ page }) => {
    await openCase(page);
    await openConsole(page);
    await page.getByLabel(/Command prompt/).press("Enter");
    await expect.poll(() => step(page)).toBe(1);
    await expect(page.getByRole("log")).toContainText("SUBMIT fix/idempotency-race");
  });

  test("next, back, status, goto, reset, unknown", async ({ page }) => {
    await openCase(page);
    await openConsole(page);
    await type(page, "next 14");
    await expect.poll(() => step(page)).toBe(14);
    await type(page, "back 4");
    await expect.poll(() => step(page)).toBe(10);
    await type(page, "status");
    await expect(page.getByRole("log")).toContainText("step        10 of 48");
    await type(page, "goto attack");
    await expect(page).toHaveURL(/\/attack\?step=10/);
    await type(page, "bogus");
    await expect(page.getByRole("log")).toContainText("command not found: bogus");
    await type(page, "reset");
    await expect.poll(() => step(page)).toBe(0);
    await expect(page.getByRole("log")).not.toContainText("SUBMIT");
  });

  test("tab completes, arrow-up recalls, clear empties the screen", async ({ page }) => {
    await openCase(page);
    await openConsole(page);
    const input = page.getByLabel(/Command prompt/);
    await input.fill("sta");
    await input.press("Tab");
    await expect(input).toHaveValue("status");
    await input.press("Enter");
    await input.press("ArrowUp");
    await expect(input).toHaveValue("status");
    await input.fill("clear");
    await input.press("Enter");
    await expect(page.getByRole("log")).not.toContainText("status");
  });

  test("case switches recording and an unknown case says so", async ({ page }) => {
    await openCase(page);
    await openConsole(page);
    await type(page, "case pagination-cursor");
    await expect(page).toHaveURL(/pagination-cursor/);
    await type(page, "case nope");
    await expect(page.getByRole("log")).toContainText("No case called nope");
  });

  test("run plays on its own and any key stops it; Space does not play or pause anything", async ({ page }) => {
    await openCase(page);
    await openConsole(page);
    await type(page, "run");
    await expect.poll(() => step(page), { timeout: 8000 }).toBeGreaterThan(1);
    await page.keyboard.press("x");
    const at = step(page);
    await page.waitForTimeout(2500);
    expect(step(page)).toBe(at);
    await page.keyboard.press("Escape"); // close
    await page.locator("body").click({ position: { x: 5, y: 300 } });
    await page.keyboard.press("Space");
    await page.waitForTimeout(1800);
    expect(step(page)).toBe(at);
  });

  test("the pill's arrows step the replay while the console stays hidden", async ({ page }) => {
    await openCase(page);
    await page.getByRole("button", { name: "Next step" }).click();
    await page.getByRole("button", { name: "Next step" }).click();
    await expect.poll(() => step(page)).toBe(2);
    await page.getByRole("button", { name: "Back one step" }).click();
    await expect.poll(() => step(page)).toBe(1);
    await expect(page.getByRole("dialog", { name: "Console" })).toHaveCount(0);
    await page.getByRole("button", { name: "Open the console" }).click();
    await expect(page.getByRole("log")).toContainText("SUBMIT fix/idempotency-race");
  });

  test("it stays open while you move from page to page", async ({ page }) => {
    await openCase(page);
    await openConsole(page);
    await page.getByRole("button", { name: /^Attack/ }).click();
    await expect(page.getByRole("dialog", { name: "Console" })).toBeVisible();
  });
});

for (const incident of ["idempotency-race", "ratelimit-boundary", "pagination-cursor"]) {
  test(`every step of ${incident} runs to a merge with no page error`, async ({ page }) => {
    const errors = watch(page);
    await openCase(page, incident);
    await openConsole(page);
    await type(page, "next 99");
    await type(page, "next 99");
    await expect(page.getByRole("log")).toContainText("merged into main @", { timeout: 8000 });
    await type(page, "next");
    await expect(page.getByRole("log")).toContainText("end of the drill");
    await type(page, "status");
    await expect(page.getByRole("log")).toContainText(/main\s+merged @ [0-9a-f]{7}/);
    expect(errors()).toEqual([]);
  });
}
