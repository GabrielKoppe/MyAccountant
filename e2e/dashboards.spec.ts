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
  // A asserção que existia aqui procurava o heading "Visão Anual", removido do app em
  // `affc145` — muito antes da Spec 69. Como ela morria ANTES das duas asserções
  // seguintes, este teste passou a não exercitar widget nenhum, que é justamente o que
  // ele promete no nome. O sinal certo de "a página anual renderizou" é o KPI do ano:
  // ele só aparece depois do layout resolvido e dos dados carregados.
  await expect(page.getByText("Total do Ano")).toBeVisible({ timeout: 15_000 });

  // Mensal: navegar direto para o mês read-only (tem dados semeados).
  await page.goto(`/${m.mainAccountId}/dashboards/monthly/${m.roMonthId}`);
  await expect(page.getByText("Total do Mês")).toBeVisible({ timeout: 15_000 });
  // Sem crash: nenhum error boundary do Next visível.
  await expect(page.getByText(/Application error|something went wrong/i)).toHaveCount(0);
});
