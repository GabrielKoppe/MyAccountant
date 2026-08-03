// e2e/installment-import-link.spec.ts
//
// Spec 73 §2.1/§2.2/§2.3 — import de fatura de cartão com parcelamento.
// Reproduz o cenário real do bug com as fixtures de `seedSpec73Fixtures`:
//
//  - "Cyan Shoes E2E 3/3" (compra 04/05/2098) continua um grupo que já existe —
//    a parcela 2 foi importada na fatura de junho/2098. O preview deve oferecer
//    o vínculo pré-selecionado e o import deve CONSUMIR a pendência 3, sem criar
//    grupo duplicado.
//  - "Einscricao E2E 4/4" (compra 06/03/2098) é grupo novo. O cronograma deve ser
//    ancorado no mês da FATURA (julho/2098 → parcelas 1..4 em abril..julho), não
//    na data da compra retroagida (que daria dez/2097 — o bug original).
import { join } from "node:path";

import { test, expect, type Page } from "@playwright/test";

import { db } from "./fixtures/db";
import { manifest } from "./fixtures/manifest";

test.use({ storageState: "e2e/.auth/owner.json" });
test.afterAll(async () => {
  await db.$disconnect();
});

// Mapeia uma coluna no StepMapping. O <Select> do MUI não tem labelId (sem accessible
// name), então escopamos pelo FormControl que contém o texto do label e abrimos o combobox.
async function mapColumn(page: Page, labelText: string, headerValue: string) {
  const fc = page.locator(".MuiFormControl-root", { hasText: labelText }).first();
  await fc.getByRole("combobox").click();
  await page.getByRole("option", { name: headerValue, exact: true }).click();
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

test("import de fatura: vincula parcela a parcelamento existente e ancora o cronograma no mês da fatura", async ({
  page,
}) => {
  const m = manifest();

  // Estado inicial: 1 grupo "Cyan Shoes E2E" com as pendências 1 e 3.
  const before = await db.installmentGroup.findMany({
    where: { accountId: m.mainAccountId, description: "Cyan Shoes E2E" },
    select: { id: true },
  });
  expect(before).toHaveLength(1);

  // ─── Wizard: upload ────────────────────────────────────────────────────────
  await page.goto(`/${m.mainAccountId}/months/${m.spec73ImportMonthId}?tab=${m.roSectionId}`);
  // O conteúdo do mês é streamado (RSC): esperar a aba da seção antes de clicar,
  // senão um servidor lento faz o clique estourar o timeout do teste.
  await expect(page.getByRole("tab", { name: "Saídas" })).toBeVisible({ timeout: 30_000 });
  // Rótulo real do gatilho do wizard: `m.csvImport.importButton` = "Importar"
  // (`exact` evita casar com "Importar outro arquivo" da tela de resultado).
  await page.getByRole("button", { name: "Importar", exact: true }).first().click();
  await page
    .locator('input[type="file"]')
    .setInputFiles(join(process.cwd(), "e2e/fixtures/installment-invoice.csv"));
  await page.getByRole("button", { name: "Próximo" }).click();

  // ─── Wizard: mapeamento ────────────────────────────────────────────────────
  await mapColumn(page, "Coluna de data", "data");
  await mapColumn(page, "Coluna de valor", "valor");
  await mapColumn(page, "Coluna de descrição", "descricao");
  // O CSV usa ponto decimal (delimitador vírgula) — "brl" quebraria o parse.
  await page.getByRole("radio", { name: "US (1,234.56)" }).check();
  // A coluna de parcela (sinal 1 do detector) vive em "Campos adicionais".
  await page.getByRole("button", { name: "Campos adicionais" }).click();
  await mapColumn(page, "Coluna de parcela", "parcela");

  await page.getByRole("button", { name: "Próximo" }).click();

  // ─── Wizard: preview — parcelamentos detectados ─────────────────────────────
  await page.getByText("Parcelamentos detectados").click();

  // Ambas de alta confiança (coluna X/Y explícita) → pré-marcadas. `groupDescription`
  // é a descrição normalizada (minúscula) — o capitalize é só CSS.
  await expect(page.getByRole("checkbox", { name: "cyan shoes e2e" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "einscricao e2e" })).toBeChecked();

  // Só "Cyan Shoes" casa com grupo existente → seletor de vínculo presente e já em
  // "vincular ao existente". "Einscricao" não casa → nenhum seletor.
  await expect(page.getByRole("combobox", { name: "Vínculo de cyan shoes e2e" })).toHaveText(
    "vincular ao existente",
  );
  await expect(page.getByRole("combobox", { name: "Vínculo de einscricao e2e" })).toHaveCount(0);
  await expect(page.getByText(/parcelamento existente · 3 parcelas/)).toBeVisible();

  // ─── Wizard: configuração + execução ───────────────────────────────────────
  await page.getByRole("button", { name: "Próximo" }).click();
  await page.getByLabel("Nome da tabela").fill("Fatura julho E2E");
  await mapColumn(page, "Seção", "Saídas");
  await page.getByRole("button", { name: "Confirmar importação" }).click();

  // ─── Resultado: 1 vinculada + 1 grupo novo, nenhuma linha sem vínculo ──────
  await expect(page.getByText("Importação concluída")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("1 parcela(s) vinculada(s) a parcelamento existente")).toBeVisible();
  await expect(page.getByText("1 parcelamento(s) criado(s)")).toBeVisible();
  await expect(page.getByText(/importada\(s\) sem vínculo/)).toHaveCount(0);

  // ─── Banco: vínculo consumiu a pendência, sem grupo duplicado ─────────────
  const cyanGroups = await db.installmentGroup.findMany({
    where: { accountId: m.mainAccountId, description: "Cyan Shoes E2E" },
    select: { id: true },
  });
  expect(cyanGroups).toHaveLength(1);
  expect(cyanGroups[0].id).toBe(m.spec73GroupId);

  const cyanPending = await db.pendingInstallment.findMany({
    where: { installmentGroupId: m.spec73GroupId },
    select: { installmentNumber: true },
  });
  // A pendência 3 foi materializada pelo import; a 1 (competência maio) segue prevista.
  expect(cyanPending.map((p) => p.installmentNumber)).toEqual([1]);

  const cyanTx = await db.transaction.findFirstOrThrow({
    where: { installmentGroupId: m.spec73GroupId, installmentNumber: 3 },
    select: { monthId: true, occurredOn: true, amountCents: true },
  });
  expect(cyanTx.monthId).toBe(m.spec73ImportMonthId);
  // `occurredOn` continua sendo a data da compra que o extrato informou.
  expect(isoDate(cyanTx.occurredOn)).toBe("2098-05-04");
  expect(cyanTx.amountCents).toBe(15783n);

  // ─── Banco: grupo novo ancorado no mês da fatura (regressão do BUG-01) ────
  const newGroup = await db.installmentGroup.findFirstOrThrow({
    where: {
      accountId: m.mainAccountId,
      description: { contains: "einscricao", mode: "insensitive" },
    },
    select: { id: true, startDate: true, installmentCount: true, autoCreateOnNewMonth: true },
  });
  expect(newGroup.installmentCount).toBe(4);
  // Parcela 4 = julho/2098 (mês do import) ⇒ parcela 1 = abril/2098, dia da compra (6).
  // O bug original ancorava em `occurredOn - 3 meses` = 2097-12-06.
  expect(isoDate(newGroup.startDate)).toBe("2098-04-06");
  // Grupo criado por import não entra na criação automática de mês.
  expect(newGroup.autoCreateOnNewMonth).toBe(false);

  const newPending = await db.pendingInstallment.findMany({
    where: { installmentGroupId: newGroup.id },
    orderBy: { installmentNumber: "asc" },
    select: { installmentNumber: true, expectedDate: true },
  });
  expect(newPending.map((p) => [p.installmentNumber, isoDate(p.expectedDate)])).toEqual([
    [1, "2098-04-06"],
    [2, "2098-05-06"],
    [3, "2098-06-06"],
  ]);

  // ─── UI: painel rotula a parcela pela COMPETÊNCIA, não pela data da compra ──
  await page.getByRole("link", { name: "Ver tabela" }).click();
  const row = page.getByRole("row").filter({ hasText: "Cyan Shoes E2E" });
  await expect(row).toBeVisible({ timeout: 30_000 });
  // O badge é um Chip clicável dentro de um Tooltip: o MUI põe `aria-label` com o
  // título do tooltip, então o nome acessível é "Parcela 3 de 3 — …", não "3/3".
  await row.getByRole("button", { name: /^Parcela 3 de 3/ }).click();

  await expect(page.getByText("Parcelamento", { exact: true })).toBeVisible();
  // Parcela 3 está no mês de julho/2098 mesmo com occurredOn em maio (BUG-02).
  await expect(page.getByText(/Parcela 3\/3/)).toBeVisible();
  await expect(page.getByText(/julho 2098/)).toBeVisible();
  // Parcela 2 (lançada na fatura de junho) e parcela 1 (ainda prevista, maio).
  await expect(page.getByText(/junho 2098/)).toBeVisible();
  await expect(page.getByText(/maio 2098/)).toBeVisible();
  // Nenhuma parcela deste grupo aparece em dezembro/2097 (a âncora do bug antigo).
  await expect(page.getByText(/dezembro 2097/)).toHaveCount(0);
});

test("marcar parcela prevista como paga entra no progresso sem criar transação", async ({
  page,
}) => {
  const m = manifest();

  // A parcela 1 (competência maio/2098) nunca foi lançada — mês não existe.
  await page.goto(`/${m.mainAccountId}/months/${m.spec73InvoiceMonthId}?tab=${m.roSectionId}`);
  const row = page.getByRole("row").filter({ hasText: "Cyan Shoes E2E" });
  await expect(row).toBeVisible({ timeout: 30_000 });
  // Nome acessível do badge vem do Tooltip (ver nota no teste acima).
  await row.getByRole("button", { name: /^Parcela 2 de 3/ }).click();

  // `.first()`: o cronograma vem ordenado por número de parcela, então a primeira
  // ação de marcar é a da parcela 1 (a pendência 3 pode ou não existir, dependendo
  // de o teste anterior deste arquivo ter rodado).
  const markButton = page.getByRole("button", { name: "Marcar como paga (histórico)" }).first();
  await expect(markButton).toBeVisible();

  const txCountBefore = await db.transaction.count({
    where: { installmentGroupId: m.spec73GroupId },
  });

  await markButton.click();
  await expect(page.getByText("Parcela marcada como paga (histórico).")).toBeVisible();

  // Banco: só `settledAt`; nenhuma Transaction nova.
  const pending = await db.pendingInstallment.findFirstOrThrow({
    where: { installmentGroupId: m.spec73GroupId, installmentNumber: 1 },
    select: { settledAt: true },
  });
  expect(pending.settledAt).not.toBeNull();
  expect(await db.transaction.count({ where: { installmentGroupId: m.spec73GroupId } })).toBe(
    txCountBefore,
  );

  // UI: rótulo de histórico e ação de desfazer.
  await expect(page.getByText(/Parcela 1\/3 · paga \(histórico\)/)).toBeVisible();
  const unmarkButton = page.getByRole("button", { name: "Desfazer marcação de paga" });
  await expect(unmarkButton).toBeVisible();

  // Desfazer volta ao estado previsto (deixa a fixture como estava).
  await unmarkButton.click();
  await expect(page.getByText("Marcação de paga desfeita.")).toBeVisible();
  const restored = await db.pendingInstallment.findFirstOrThrow({
    where: { installmentGroupId: m.spec73GroupId, installmentNumber: 1 },
    select: { settledAt: true },
  });
  expect(restored.settledAt).toBeNull();
});
