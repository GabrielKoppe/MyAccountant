// e2e/month-automations.spec.ts
//
// Spec 73 §2.4 — passo "Automações" da criação de mês. Antes, `createMonth`
// disparava modelos `autoApply` e parcelas previstas às cegas; agora o usuário
// revisa e escolhe item por item, e a escolha vale só para aquela criação.
//
// Fixtures: `seedSpec73AutomationsAccount` (conta DEDICADA — `TableTemplate.autoApply`
// é account-wide e faria o passo 2 aparecer em toda criação de mês da conta
// principal, quebrando `solo-flow` e `csv-import`). Conteúdo: 1 modelo bem
// configurado (2 itens) · 1 modelo sem seção (bloqueado) · 1 parcela de grupo
// manual (pré-marcada) · 1 parcela de grupo de import (desmarcada). Todas as
// pendências caem em 2098/09, o mês que o teste cria pela UI.
import { test, expect } from "@playwright/test";

import { db } from "./fixtures/db";
import { manifest } from "./fixtures/manifest";

test.use({ storageState: "e2e/.auth/owner.json" });
test.afterAll(async () => {
  await db.$disconnect();
});

test("passo Automações respeita o padrão de cada item e aplica só o que ficou marcado", async ({
  page,
}) => {
  const m = manifest();

  await page.goto(`/${m.automationsAccountId}/months/${m.automationsMonthId}`);

  // ─── Passo 1: mês/ano → "Criar" agora avança para as Automações ────────────
  await page.getByRole("button", { name: "Novo mês", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox").click();
  await page.getByRole("option", { name: "Setembro" }).click();
  await dialog.getByLabel("Ano").fill("2098");
  await dialog.getByRole("button", { name: "Criar", exact: true }).click();

  // ─── Passo 2: revisão ──────────────────────────────────────────────────────
  await expect(dialog.getByText("Automações · Setembro 2098")).toBeVisible({ timeout: 15_000 });
  await expect(dialog.getByText("Revise o que será criado junto com o mês.")).toBeVisible();

  // Os dois tipos de automação aparecem agrupados.
  await expect(dialog.getByText("Modelos de tabela")).toBeVisible();
  await expect(dialog.getByText("Parcelas previstas")).toBeVisible();

  // Modelo bem configurado: marcado, com destino e contagem de itens.
  const templateCheckbox = dialog.getByRole("checkbox", { name: "Contas fixas E2E" });
  await expect(templateCheckbox).toBeChecked();
  await expect(dialog.getByText(/Saídas › Manual · 2 itens/)).toBeVisible();

  // Modelo sem seção: desmarcado, não selecionável e com o motivo visível — em vez
  // de falhar silenciosamente no snackbar depois de o mês já existir.
  const brokenCheckbox = dialog.getByRole("checkbox", { name: "Modelo quebrado E2E" });
  await expect(brokenCheckbox).not.toBeChecked();
  await expect(brokenCheckbox).toBeDisabled();
  await expect(dialog.getByText(/seção não configurada no modelo/)).toBeVisible();

  // Parcela de grupo criado à mão: pré-marcada, rotulada como tal.
  const manualCheckbox = dialog.getByRole("checkbox", { name: "Curso manual E2E" });
  await expect(manualCheckbox).toBeChecked();
  await expect(dialog.getByText(/2\/3 · criada na mão/)).toBeVisible();

  // Parcela de grupo vindo de import: desmarcada (a fatura é a fonte da parcela).
  const importCheckbox = dialog.getByRole("checkbox", { name: "Fatura import E2E" });
  await expect(importCheckbox).not.toBeChecked();
  await expect(dialog.getByText(/2\/3 · vem da fatura \(import\)/)).toBeVisible();

  // ─── Inverter as duas escolhas: prova que a seleção manda nos dois sentidos ──
  await manualCheckbox.uncheck();
  await importCheckbox.check();
  await expect(dialog.getByText("1 de 2 marcados")).toBeVisible(); // grupo "Parcelas previstas"

  await dialog.getByRole("button", { name: "Criar mês" }).click();
  await expect(dialog).toBeHidden({ timeout: 20_000 });

  // ─── Banco ─────────────────────────────────────────────────────────────────
  const created = await db.month.findFirstOrThrow({
    where: { accountId: m.automationsAccountId, year: 2098, month: 9 },
    select: { id: true },
  });

  // Modelo marcado foi aplicado: tabela criada com os 2 itens do modelo.
  // A tabela NÃO é exclusiva do modelo: a conversão de parcela reusa a tabela de
  // mesma seção + tipo quando ela já existe (spec 41 DD-08), então a asserção é
  // sobre os itens do modelo estarem lá, não sobre o total de linhas da tabela.
  const templateTable = await db.financeTable.findFirstOrThrow({
    where: { monthId: created.id, name: "Contas fixas E2E" },
    select: { id: true },
  });
  const templateTxs = await db.transaction.findMany({
    where: {
      tableId: templateTable.id,
      description: { in: ["Aluguel E2E", "Internet E2E"] },
    },
    select: { description: true },
  });
  expect(templateTxs.map((t) => t.description).sort()).toEqual(["Aluguel E2E", "Internet E2E"]);

  // Modelo bloqueado não criou nada.
  expect(
    await db.financeTable.count({ where: { monthId: created.id, name: "Modelo quebrado E2E" } }),
  ).toBe(0);

  // Parcela marcada (grupo de import) foi materializada: pendência consumida.
  expect(await db.pendingInstallment.count({ where: { id: m.automationsImportPendingId } })).toBe(
    0,
  );
  const importTx = await db.transaction.findFirstOrThrow({
    where: { monthId: created.id, description: "Fatura import E2E" },
    select: { installmentNumber: true },
  });
  expect(importTx.installmentNumber).toBe(2);

  // Parcela desmarcada (grupo manual) NÃO foi materializada, mesmo com o padrão ligado.
  expect(await db.pendingInstallment.count({ where: { id: m.automationsManualPendingId } })).toBe(
    1,
  );
  expect(
    await db.transaction.count({ where: { monthId: created.id, description: "Curso manual E2E" } }),
  ).toBe(0);

  // Desmarcar no modal é decisão pontual: NÃO altera o padrão do parcelamento.
  const manualGroup = await db.installmentGroup.findUniqueOrThrow({
    where: { id: m.automationsManualGroupId },
    select: { autoCreateOnNewMonth: true },
  });
  expect(manualGroup.autoCreateOnNewMonth).toBe(true);
});

test("sem modelo automático nem parcela prevista, a criação de mês não mostra o passo Automações", async ({
  page,
}) => {
  const m = manifest();

  // Conta principal: nenhum `TableTemplate.autoApply` e nenhuma pendência caindo em
  // 2098/10 → o passo extra apareceria vazio, então é omitido.
  await page.goto(`/${m.mainAccountId}/months/${m.roMonthId}`);
  await page.getByRole("button", { name: "Novo mês", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox").click();
  await page.getByRole("option", { name: "Outubro" }).click();
  await dialog.getByLabel("Ano").fill("2098");
  await dialog.getByRole("button", { name: "Criar", exact: true }).click();

  await expect(dialog).toBeHidden({ timeout: 20_000 });
  await expect(page.getByText(/Automações ·/)).toHaveCount(0);

  expect(
    await db.month.count({ where: { accountId: m.mainAccountId, year: 2098, month: 10 } }),
  ).toBe(1);
});
