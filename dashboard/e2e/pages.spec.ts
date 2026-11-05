import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { openCase, openConsole, watch } from "./helpers";

const ROUTES = ["/#/", "/#/cases", "/#/case/idempotency-race/case?step=0", "/#/case/idempotency-race/room?step=20", "/#/case/ratelimit-boundary/attack?step=30", "/#/case/pagination-cursor/ruling?step=end", "/#/case/idempotency-race/signoff?step=end"];

test.describe("every route loads clean and fits the screen", () => {
  for (const route of ROUTES) {
    test(`${route}`, async ({ page }) => {
      const errors = watch(page);
      await page.goto(route);
      await page.waitForTimeout(1200);
      const w = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, view: window.innerWidth }));
      expect(w.doc, "horizontal scroll").toBeLessThanOrEqual(w.view + 1);
      expect(errors()).toEqual([]);
    });
  }

  test("the open console fits the viewport and never covers the prompt with the page", async ({ page }) => {
    await openCase(page, "idempotency-race", "ruling", 24);
    const win = await openConsole(page);
    const box = (await win.boundingBox())!;
    const vp = page.viewportSize()!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1);
    // The page's last element can scroll clear of the console.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    const bottom = await page.evaluate(() => { const n = document.querySelector('nav[aria-label="Previous and next step"]')!.getBoundingClientRect(); return n.bottom; });
    expect(bottom).toBeLessThanOrEqual(box.y + 2);
  });
});

test.describe("accessibility (axe, serious and critical only)", () => {
  for (const route of ROUTES.slice(2)) {
    test(`${route} with the console open`, async ({ page }) => {
      await page.goto(route);
      await page.getByRole("button", { name: "Open the console" }).click();
      await page.waitForTimeout(1500);
      const r = await new AxeBuilder({ page }).disableRules(["color-contrast"]).analyze();
      const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
    });
  }
  test("home and landing", async ({ page }) => {
    for (const route of ["/#/", "/#/cases"]) {
      await page.goto(route);
      await page.waitForTimeout(1200);
      const r = await new AxeBuilder({ page }).disableRules(["color-contrast"]).analyze();
      const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(bad.map((v) => `${route} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
    }
  });
});

test.describe("colour contrast (WCAG AA, console closed)", () => {
  for (const route of ROUTES) {
    test(`${route}`, async ({ page }) => {
      await page.goto(route);
      await page.waitForTimeout(1500);
      const r = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
      expect(r.violations.flatMap((v) => v.nodes.map((n) => `${n.target.join(" ").slice(0, 90)} :: ${n.any[0]?.message?.slice(0, 80)}`))).toEqual([]);
    });
  }
});

test("landing: the footer wordmark finishes drawing and is not clipped", async ({ page }) => {
  await page.goto("/#/");
  await page.waitForTimeout(1500);
  for (let i = 0; i < 40; i++) { await page.mouse.wheel(0, 900); await page.waitForTimeout(100); }
  await page.waitForTimeout(3000);
  const r = await page.evaluate(() => {
    const el = document.querySelector('[data-gsap="chars"]')!;
    const chars = [...el.querySelectorAll("div,span")].filter((c) => c.children.length === 0 && c.textContent?.trim());
    const moved = chars.filter((c) => { const m = new DOMMatrix(getComputedStyle(c).transform); return Math.abs(m.f) > 1 || Math.abs(m.b) > 0.01; }).length;
    const box = el.getBoundingClientRect();
    return { chars: chars.length, moved, inView: box.top >= 0 && box.bottom <= innerHeight + 1, atBottom: Math.round(scrollY + innerHeight) >= document.documentElement.scrollHeight - 2 };
  });
  expect(r.chars).toBe(9);
  expect(r.atBottom).toBe(true);
  expect(r.moved, "letters still mid-animation").toBe(0);
});

test.describe("refresh starts over at the landing page", () => {
  for (const route of ["/#/cases", "/#/case/idempotency-race/ruling?step=24", "/#/live/case"]) {
    test(`reload on ${route}`, async ({ page }) => {
      await page.goto(route);
      await page.waitForTimeout(800);
      await page.reload();
      await expect.poll(() => new URL(page.url()).hash).toBe("#/");
      await expect(page.getByRole("link", { name: /Open the courtroom/ }).or(page.getByRole("button", { name: /Open the courtroom/ })).first()).toBeVisible();
    });
  }

  test("a link you open still goes where it points", async ({ page }) => {
    await page.goto("/#/case/idempotency-race/signoff?step=end");
    await expect(page.getByRole("button", { name: "Open the console" })).toBeVisible();
    expect(new URL(page.url()).hash).toContain("/case/idempotency-race/signoff");
  });

  test("reloading the landing page itself returns to the top", async ({ page }) => {
    await page.goto("/#/");
    await page.waitForTimeout(1200);
    await page.mouse.wheel(0, 2500);
    await page.waitForTimeout(1500);
    await page.reload();
    await page.waitForTimeout(1200);
    expect(await page.evaluate(() => scrollY)).toBeLessThan(5);
  });
});

test("reduced motion: the console still opens and works", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openCase(page);
  await openConsole(page);
  await page.getByLabel(/Command prompt/).press("Enter");
  await expect(page.getByRole("log")).toContainText("SUBMIT");
});
