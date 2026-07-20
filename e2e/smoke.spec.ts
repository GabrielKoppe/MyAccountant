// e2e/smoke.spec.ts
import { test, expect } from "@playwright/test";

test("página de login renderiza", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeVisible();
});
