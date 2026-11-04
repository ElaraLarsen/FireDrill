import { expect, type Page } from "@playwright/test";

/** Errors the page raised on its own. The refused WebSocket to the gate is expected: no gate runs in these tests. */
export function watch(page: Page): () => string[] {
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (/8787|ERR_CONNECTION_REFUSED|WebSocket connection/.test(t)) return;
    errs.push(`console: ${t}`);
  });
  return () => errs;
}

export const step = (page: Page) => Number(new URL(page.url()).hash.match(/step=(\d+)/)?.[1] ?? NaN);

export async function openCase(page: Page, incident = "idempotency-race", pageName = "case", at: number | "end" = 0) {
  await page.goto(`/#/case/${incident}/${pageName}?step=${at}`);
  await expect(page.getByRole("button", { name: "Open the console" })).toBeVisible();
}

export async function openConsole(page: Page) {
  await page.getByRole("button", { name: "Open the console" }).click();
  const win = page.getByRole("dialog", { name: "Console" });
  await expect(win).toBeVisible();
  // Let the opening animation settle so sizes and positions are the resting ones.
  await expect.poll(() => win.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  await page.waitForTimeout(450);
  return win;
}

export async function type(page: Page, text: string) {
  const input = page.getByLabel(/Command prompt/);
  await input.fill(text);
  await input.press("Enter");
}
