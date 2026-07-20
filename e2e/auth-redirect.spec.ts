// e2e/auth-redirect.spec.ts
import { test, expect } from "@playwright/test";
import { manifest } from "./fixtures/manifest";

// Sem storageState → sessão anônima.
test.use({ storageState: { cookies: [], origins: [] } });

test("rota protegida redireciona para /login com callbackUrl", async ({ page }) => {
  const target = `/${manifest().mainAccountId}`;
  await page.goto(target);
  await expect(page).toHaveURL(/\/login\?callbackUrl=/);
  await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeVisible();
});
