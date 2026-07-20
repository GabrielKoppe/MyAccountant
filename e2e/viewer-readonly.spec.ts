// e2e/viewer-readonly.spec.ts
import { test, expect } from "@playwright/test";
import { manifest } from "./fixtures/manifest";

test.use({ storageState: "e2e/.auth/viewer.json" });

test("viewer não vê controles de escrita na tabela", async ({ page }) => {
  const m = manifest();
  await page.goto(`/${m.mainAccountId}/months/${m.roMonthId}?tab=${m.roSectionId}`);

  // Leitura funciona: a tabela e a transação semeadas aparecem.
  await expect(page.getByText("Contas fixas")).toBeVisible();
  await expect(page.getByText("Aluguel")).toBeVisible();

  // Escrita indisponível: add-row e toggles de linha ausentes.
  await expect(page.getByRole("button", { name: "Nova transação" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Marcar como pendente" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Adicionar aos favoritos" })).toHaveCount(0);
});
