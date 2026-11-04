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
    await openConsole(page);
    const css = await page.locator(".glass-win").evaluate((el) => { const c = getComputedStyle(el); return { f: c.backdropFilter || c.webkitBackdropFilter, bg: c.backgroundImage + c.backgroundColor }; });
    expect(css.f).toMatch(/blur\(\d+px\)/);
    expect(css.bg).toMatch(/rgba?\(|color\(|oklab/);
    expect(css.bg).not.toMatch(/rgb\(10, 31, 21\)/);
  });
});

test.describe("console: its own controls (no window dots)", () => {
  test("there are no mac-style red, yellow or green dots", async ({ page }) => {
    await openCase(page);
    const win = await openConsole(page);
    const dots = await win.locator("button").evaluateAll((bs) => bs.filter((b) => { const r = b.getBoundingClientRect(); const c = getComputedStyle(b).backgroundColor; return r.width < 18 && r.height < 18 && /rgb\((255, 95, 87|254, 188, 46|40, 200, 64)\)/.test(c); }).length);
    expect(dots).toBe(0);
  });

  test("the size steps: prompt only, normal, large; the lit one is the current one", async ({ page }) => {
    await openCase(page, "idempotency-race", "case", 12);
    const win = await openConsole(page);
    const log = page.locator("[role=log]");
    const height = async () => (await log.boundingBox())?.height ?? 0;
    const step = (name: string) => page.getByRole("button", { name, exact: true });
    await expect(step("Normal size")).toHaveAttribute("aria-pressed", "true");
    await expect.poll(height).toBeGreaterThan(150);
    const normal = await height();

    await step("Large").click();
    await expect(step("Large")).toHaveAttribute("aria-pressed", "true");
    await expect.poll(height).toBeGreaterThan(normal + 100);

    await step("Prompt only").click();
    await expect(step("Prompt only")).toHaveAttribute("aria-pressed", "true");
    // The log is clipped to nothing: the window is just its bar and prompt, and the hidden log cannot be tabbed into.
    await expect.poll(async () => (await win.boundingBox())?.height ?? 0).toBeLessThan(150);
    await expect(log).not.toBeInViewport({ ratio: 0.01 });
    await expect(page.getByLabel(/Command prompt/)).toBeVisible();

    await step("Normal size").click();
    await expect.poll(async () => Math.abs((await height()) - normal)).toBeLessThan(4);
  });

  test("the fold closes it and the pill comes back", async ({ page }) => {
    await openCase(page);
    const win = await openConsole(page);
    await page.getByRole("button", { name: "Close the console" }).click();
    await expect(win).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Open the console" })).toBeVisible();
  });

  test("a command typed while it is prompt-only opens the log so the answer is visible", async ({ page }) => {
    await openCase(page);
    await openConsole(page);
    await page.getByRole("button", { name: "Prompt only", exact: true }).click();
    await type(page, "help");
    await expect.poll(async () => (await page.locator("[role=log]").boundingBox())?.height ?? 0).toBeGreaterThan(150);
    await expect(page.getByRole("log")).toContainText("goto <page>");
  });

  test("it is not a plain rectangle, and it carries colour", async ({ page }) => {
    await openCase(page);
    await openConsole(page);
    const css = await page.locator(".glass-win").evaluate((el) => { const c = getComputedStyle(el); return { r: [c.borderTopLeftRadius, c.borderTopRightRadius, c.borderBottomRightRadius, c.borderBottomLeftRadius], bg: c.backgroundImage }; });
    expect(new Set(css.r).size).toBeGreaterThan(1);
    expect(css.bg).toMatch(/rgba?\(198, 244, 50/);
    await expect(page.locator(".glass-tab")).toBeVisible();
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
