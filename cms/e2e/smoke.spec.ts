import { expect, test } from "@playwright/test";
import { CITIES, cityUrl, skipUnlessRunnable, visit } from "./support";

skipUnlessRunnable();

for (const city of CITIES) {
  test(`${city.key}: forside viser byens navn og har ingen konsolfejl`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await visit(page, cityUrl(city.key));
    expect(res?.status()).toBe(200);
    await expect(page).toHaveTitle(new RegExp(city.name));
    await expect(page.locator("h1, h2").first()).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
  });
}

test("naestvedlokalt: forside -> artikel via klik, artiklen har byens canonical", async ({ page }) => {
  await visit(page, cityUrl("naestvedlokalt"));
  const href = await page.locator('a[href^="/"]').evaluateAll((els) =>
    els.map((a) => a.getAttribute("href")).find((h) => /^\/[a-z0-9-]+\/[a-z0-9-]{12,}$/.test(h ?? "")),
  );
  expect(href, "ingen artikellink på forsiden").toBeTruthy();
  await visit(page, cityUrl("naestvedlokalt", href!));
  await expect(page.locator("h1").first()).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /^https:\/\/naestvedlokalt\.dk\//);
});

test("nyhedsbrev: tom/ugyldig tilmelding viser fejl i stedet for succes", async ({ page }) => {
  await visit(page, cityUrl("naestvedlokalt", "/nyhedsbrev"));
  await page.locator('input[name="email"]').fill("ikke-en-mail");
  await page.locator('form button[type="submit"]').first().click();
  await expect(page.getByText(/gyldig|påkrævet|samtykke|fejl/i).first()).toBeVisible();
  await expect(page.getByText(/tak for din tilmelding|du er tilmeldt/i)).toHaveCount(0);
});

test("ukendt side giver 404 med vej videre", async ({ page }) => {
  const res = await visit(page, cityUrl("naestvedlokalt", "/findes-ikke-e2e"));
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("link", { name: /forside/i }).first()).toBeVisible();
});

test("/redaktion kræver login", async ({ page }) => {
  await visit(page, cityUrl("naestvedlokalt", "/redaktion"));
  await expect(page).toHaveURL(/\/login/);
});

test("/partner/<falsk token> sendes ikke til login", async ({ page }) => {
  await visit(page, cityUrl("naestvedlokalt", "/partner/e2e-falsk-token"));
  await expect(page).not.toHaveURL(/\/login/);
});
