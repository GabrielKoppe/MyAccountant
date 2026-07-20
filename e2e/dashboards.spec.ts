// e2e/dashboards.spec.ts
import { test, expect } from "@playwright/test";
import { manifest } from "./fixtures/manifest";

test.use({ storageState: "e2e/.auth/owner.json" });

test("dashboards anual e mensal carregam e renderizam widgets", async ({ page }) => {
  const m = manifest();

  // Anual: nav "Dashboards" redireciona para o ano mais recente.
  await page.goto(`/${m.mainAccountId}`);
  await page.getByRole("link", { name: "Dashboards" }).click();
  await page.waitForURL(/\/dashboards\/yearly\/\d+/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Visão Anual" })).toBeVisible();
  await expect(page.getByText("Total do Ano")).toBeVisible();

  // Mensal: navegar direto para o mês read-only (tem dados semeados).
  await page.goto(`/${m.mainAccountId}/dashboards/monthly/${m.roMonthId}`);
  await expect(page.getByText("Total do Mês")).toBeVisible({ timeout: 15_000 });
  // Sem crash: nenhum error boundary do Next visível.
  await expect(page.getByText(/Application error|something went wrong/i)).toHaveCount(0);
});
