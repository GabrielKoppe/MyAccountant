// e2e/transaction-detail-edit.spec.ts
//
// Spec 66 §10.3 P5 (TX-03/TX-03c) — fecha o loop leitura → edição:
// 1. "Editar" no modal de detalhe leva à edição inline da linha, com foco na
//    Descrição (não na Data) — TransactionRow.tsx / TransactionRowEditor.tsx.
// 2. Fechar o painel de parcelas devolve o foco ao badge que o abriu.
import { test, expect } from "@playwright/test";

import { db } from "./fixtures/db";
import { manifest } from "./fixtures/manifest";

test.use({ storageState: "e2e/.auth/owner.json" });
test.afterAll(async () => {
  await db.$disconnect();
});

test("editar a partir do modal de detalhe entra em edição inline com foco na Descrição", async ({
  page,
}) => {
  const m = manifest();
  await page.goto(`/${m.mainAccountId}/months/${m.roMonthId}?tab=${m.roSectionId}`);

  // "Aluguel" é a transação semeada (e2e/fixtures/seed.ts) na seção read-only.
  const row = page.getByRole("row").filter({ hasText: "Aluguel" });
  await row.getByRole("button", { name: "Mais ações" }).click();
  await page.getByRole("menuitem", { name: "Ver detalhes" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Aluguel")).toBeVisible();

  await dialog.getByRole("button", { name: "Editar" }).click();

  // O modal fecha e a linha correspondente entra em edição inline.
  await expect(dialog).toBeHidden();

  const descriptionInput = page.getByPlaceholder("Descrição");
  await expect(descriptionInput).toBeVisible();
  await expect(descriptionInput).toHaveValue("Aluguel");
  await expect(descriptionInput).toBeFocused();

  // Regressão: o campo Data não deve ficar com o foco (comportamento antigo).
  await expect(page.locator('input[type="date"]')).not.toBeFocused();
});

test("fechar o painel de parcelas devolve o foco ao badge que o abriu", async ({ page }) => {
  const m = manifest();
  const owner = await db.user.findUniqueOrThrow({
    where: { email: m.users.owner },
    select: { id: true },
  });
  const table = await db.financeTable.findFirstOrThrow({
    where: { monthId: m.roMonthId, sectionId: m.roSectionId },
    select: { id: true },
  });
  const group = await db.installmentGroup.create({
    data: {
      accountId: m.mainAccountId,
      description: "Notebook parcelado E2E",
      totalCents: 300000n,
      installmentCount: 3,
      startDate: new Date("2099-12-10"),
      sectionId: m.roSectionId,
    },
    select: { id: true },
  });
  await db.transaction.create({
    data: {
      accountId: m.mainAccountId,
      monthId: m.roMonthId,
      tableId: table.id,
      sectionId: m.roSectionId,
      occurredOn: new Date("2099-12-10"),
      amountCents: 100000n,
      description: "Notebook parcelado E2E",
      createdById: owner.id,
      installmentGroupId: group.id,
      installmentNumber: 1,
    },
  });

  await page.goto(`/${m.mainAccountId}/months/${m.roMonthId}?tab=${m.roSectionId}`);

  // Badge de parcela — abre o painel lateral. O nome acessível vem do Tooltip
  // (o MUI escreve `aria-label` com o título), não do rótulo "1/3" do Chip.
  // Escopado na linha: o badge também aparece no modal de detalhe, e este teste
  // cria a própria transação (uma por execução, incluindo retry).
  const badge = page
    .getByRole("row")
    .filter({ hasText: "Notebook parcelado E2E" })
    .first()
    .getByRole("button", { name: /^Parcela 1 de 3/ });
  await badge.click();

  await expect(page.getByText("Notebook parcelado E2E")).toBeVisible();

  // Fecha via Escape (equivalente ao backdrop click do Drawer do MUI).
  await page.keyboard.press("Escape");
  await expect(page.getByText("Notebook parcelado E2E")).toBeHidden();

  // Foco devolvido ao badge que abriu o painel (TX-03c).
  await expect(badge).toBeFocused();
});
