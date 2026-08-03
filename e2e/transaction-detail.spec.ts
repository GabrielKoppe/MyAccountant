// e2e/transaction-detail.spec.ts
//
// Spec 66 §8 (P8) — cenários do modal de detalhe/painel de parcelas que dependem
// das fixtures dedicadas semeadas em `e2e/fixtures/seed.ts` (`seedSpec66Fixtures`,
// mês isolado 2099/11): (a) cabeçalho com MoneyValue/StatusBadge + 4 abas
// navegáveis, somente leitura; (b) viewer navega por um vínculo sem ver "Editar";
// (c) badge de parcela abre o painel lateral com o rodapé de 3 ações.
import { test, expect } from "@playwright/test";

import { db } from "./fixtures/db";
import { manifest } from "./fixtures/manifest";

test.afterAll(async () => {
  await db.$disconnect();
});

test.describe("owner", () => {
  test.use({ storageState: "e2e/.auth/owner.json" });

  test("abrir o detalhe de uma transação simples: cabeçalho + 4 abas + read-only + nota", async ({
    page,
  }) => {
    const m = manifest();
    await page.goto(`/${m.mainAccountId}/months/${m.spec66MonthId}?tab=${m.roSectionId}`);

    const row = page.getByRole("row").filter({ hasText: "Spec 66 — transação simples" });
    await row.getByRole("button", { name: "Mais ações" }).click();
    await page.getByRole("menuitem", { name: "Ver detalhes" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Cabeçalho: MoneyValue é o maior elemento (apex visual) — comparação de
    // font-size computado contra a descrição, sem depender de valores de tema.
    const moneyEl = dialog.getByText(/450,00/).first();
    const descriptionEl = dialog.getByText("Spec 66 — transação simples").first();
    await expect(moneyEl).toBeVisible();
    await expect(descriptionEl).toBeVisible();
    const [moneyFontSize, descriptionFontSize] = await Promise.all([
      moneyEl.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
      descriptionEl.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
    ]);
    expect(moneyFontSize).toBeGreaterThan(descriptionFontSize);

    // Status via StatusBadge — nunca <Chip> (regra do design system).
    await expect(dialog.getByText("Favorito")).toBeVisible();
    await expect(dialog.locator(".MuiChip-root")).toHaveCount(0);

    // 4 abas presentes e navegáveis.
    const tabs = dialog.getByRole("tab");
    await expect(tabs).toHaveCount(4);
    await expect(tabs.nth(0)).toHaveText("Resumo");
    await expect(tabs.nth(1)).toHaveText("Classificação");
    await expect(tabs.nth(2)).toHaveText("Parcelas e vínculos");
    await expect(tabs.nth(3)).toHaveText("Histórico");

    // Resumo (aba inicial): nota em bloco read-only.
    await expect(dialog.getByText("Nota de exemplo para a aba Resumo.")).toBeVisible();

    // Classificação: sem dado preenchido → EmptyState (nunca aba em branco).
    await tabs.nth(1).click();
    await expect(dialog.getByText("Sem classificação preenchida")).toBeVisible();

    // Parcelas e vínculos: sem grupo/links → EmptyState.
    await tabs.nth(2).click();
    await expect(dialog.getByText("Sem parcelas ou vínculos")).toBeVisible();

    // Histórico: origem + criado por.
    await tabs.nth(3).click();
    await expect(dialog.getByText("Origem")).toBeVisible();
    await expect(dialog.getByText("Criado por")).toBeVisible();

    // Somente leitura: nenhum campo editável dentro do modal.
    await expect(dialog.getByRole("textbox")).toHaveCount(0);

    await dialog.getByRole("button", { name: "Fechar" }).click();
    await expect(dialog).toBeHidden();
  });

  test("badge de parcela abre o painel lateral com rodapé de 3 ações e 'Criar neste mês'", async ({
    page,
  }) => {
    const m = manifest();
    await page.goto(`/${m.mainAccountId}/months/${m.spec66MonthId}?tab=${m.roSectionId}`);

    const row = page.getByRole("row").filter({ hasText: "Spec 66 — notebook parcelado" });
    // O badge é um Chip clicável dentro de um Tooltip: o MUI escreve `aria-label`
    // com o título do tooltip, então o nome acessível é "Parcela 1 de 3 — …".
    await row.getByRole("button", { name: /^Parcela 1 de 3/ }).click();

    await expect(page.getByText("Grupo de parcelamento")).toBeVisible();
    await expect(page.getByText(/900,00/)).toBeVisible();

    // Rodapé: 3 ações ("Lançar próxima" é a única habilitada de cara — a próxima
    // pendência cai num mês já existente, 2099/12). "Desfazer grupo" é IconButton
    // com aria-label desde a spec 73 §2.6 — continua acessível pelo mesmo nome.
    const settleButton = page.getByRole("button", { name: "Quitar parcelas" });
    const launchNextButton = page.getByRole("button", { name: "Lançar próxima" });
    const undoButton = page.getByRole("button", { name: "Desfazer grupo" });
    await expect(settleButton).toBeVisible();
    await expect(launchNextButton).toBeVisible();
    await expect(launchNextButton).toBeEnabled();
    await expect(undoButton).toBeVisible();

    // Cronograma: "Criar neste mês" preservado por-item (parcela 2, cujo mês já existe).
    await expect(page.getByText("Criar neste mês")).toBeVisible();
  });
});

test.describe("viewer", () => {
  test.use({ storageState: "e2e/.auth/viewer.json" });

  test("aba 'Parcelas e vínculos' lista o vínculo e 'abrir' navega ao alvo, sem 'Editar'", async ({
    page,
  }) => {
    const m = manifest();
    const target = await db.transaction.findUniqueOrThrow({
      where: { id: m.linkTargetTxId },
      select: { monthId: true, sectionId: true },
    });

    await page.goto(`/${m.mainAccountId}/months/${m.spec66MonthId}?tab=${m.roSectionId}`);

    const row = page.getByRole("row").filter({ hasText: "Spec 66 — despesa original" });
    await row.getByRole("button", { name: "Mais ações" }).click();
    await page.getByRole("menuitem", { name: "Ver detalhes" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Viewer: sem "Editar".
    await expect(dialog.getByRole("button", { name: "Editar" })).toHaveCount(0);

    await dialog.getByRole("tab", { name: "Parcelas e vínculos" }).click();
    await expect(dialog.getByText("Spec 66 — reembolso")).toBeVisible();

    await dialog.getByRole("button", { name: "Abrir transação vinculada" }).click();

    await expect(dialog).toBeHidden();
    await page.waitForURL(
      (url) =>
        url.pathname === `/${m.mainAccountId}/months/${target.monthId}` &&
        url.searchParams.get("tab") === target.sectionId,
    );
    await expect(page.getByText("Spec 66 — reembolso")).toBeVisible();
  });
});
