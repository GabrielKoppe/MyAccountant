// e2e/planning-forms.spec.ts
import { test, expect } from "@playwright/test";
import { manifest } from "./fixtures/manifest";
import { db } from "./fixtures/db";

test.use({ storageState: "e2e/.auth/owner.json" });
test.afterAll(async () => {
  await db.$disconnect();
});

// Regressão do bug de máscara do campo de valor (NumericFormat): antes do fix, um
// TextField cru deixava digitar "." como separador de milhar "de graça" — "1.234,56"
// virava R$ 123.456,00 (100x o valor) sem nenhum aviso (ver comentário histórico em
// BudgetFormDialog.tsx). O valor abaixo (1.234,56 → 123456 centavos) cobre exatamente
// esse caso: tanto "não consigo digitar no campo" quanto "vírgula/ponto convertidos
// errado" resultam num targetCents/amountCents diferente de 123456n.
const VALUE_INPUT = "1.234,56";
const EXPECTED_CENTS = 123456n;

test("criar Meta com valor via NumericFormat grava targetCents correto", async ({ page }) => {
  const m = manifest();
  const goalName = `Meta E2E ${Date.now()}`;

  await page.goto(`/${m.mainAccountId}/planning/goals`);

  // Botão duplicado (barra de ação + EmptyState, quando não há metas ativas) — mesmo
  // padrão de solo-flow.spec.ts (.first()).
  await page.getByRole("button", { name: "Nova meta" }).first().click();
  const dialog = page.getByRole("dialog");

  await dialog.getByLabel("Nome").fill(goalName);

  const targetField = dialog.getByLabel("Valor alvo");
  await targetField.fill(VALUE_INPUT);
  // Sanity check visual antes do submit: fixedDecimalScale não deve alterar um valor
  // já bem formado — se aparecer diferente de "1.234,56" aqui, a máscara já quebrou
  // antes mesmo de chegar no servidor.
  await expect(targetField).toHaveValue(VALUE_INPUT);

  await dialog.getByRole("button", { name: "Salvar" }).click();

  await expect(page.getByText("Meta criada.")).toBeVisible();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(goalName)).toBeVisible();

  const created = await db.goal.findFirstOrThrow({
    where: { accountId: m.mainAccountId, name: goalName },
    orderBy: { createdAt: "desc" },
    select: { targetCents: true },
  });
  expect(created.targetCents).toBe(EXPECTED_CENTS);
});

test("criar Orçamento com valor + dimensão (categoria) grava amountCents correto", async ({
  page,
}) => {
  const m = manifest();
  const budgetName = `Orçamento E2E ${Date.now()}`;

  await page.goto(`/${m.mainAccountId}/planning/budgets`);

  await page.getByRole("button", { name: "Novo orçamento" }).first().click();
  const dialog = page.getByRole("dialog");

  // Categoria (dimensão obrigatória via superRefine "pelo menos uma dimensão") — o
  // CreatableEntitySelect não tem label flutuante, só aria-label ("Categoria"), então
  // localiza pelo combobox dentro do dialog (não por getByLabel).
  await dialog.getByRole("combobox", { name: "Categoria", exact: true }).click();
  await page.getByRole("option", { name: "Alimentação", exact: true }).click();

  const amountField = dialog.getByLabel("Valor alvo");
  await amountField.fill(VALUE_INPUT);
  await expect(amountField).toHaveValue(VALUE_INPUT);

  await dialog.getByLabel("Nome (opcional)").fill(budgetName);

  await dialog.getByRole("button", { name: "Salvar" }).click();

  await expect(page.getByText("Orçamento criado.")).toBeVisible();
  await expect(dialog).toBeHidden();

  const category = await db.category.findFirstOrThrow({
    where: { accountId: m.mainAccountId, name: "Alimentação" },
    select: { id: true },
  });
  const created = await db.budget.findFirstOrThrow({
    where: { accountId: m.mainAccountId, name: budgetName },
    orderBy: { createdAt: "desc" },
    select: { amountCents: true, categoryId: true },
  });
  expect(created.amountCents).toBe(EXPECTED_CENTS);
  expect(created.categoryId).toBe(category.id);
});

test("criar categoria inline (CreatableEntitySelect) no dialog de Meta e vincular", async ({
  page,
}) => {
  const m = manifest();
  const goalName = `Meta E2E Inline ${Date.now()}`;
  // Sufixo por timestamp evita colisão com o dedupe do CreatableEntitySelect: se o
  // nome já existisse (rerun sem reseed), o componente selecionaria a opção existente
  // em vez de mostrar "＋ Criar", quebrando o cenário que este teste quer cobrir.
  const categoryName = `Viagem E2E ${Date.now()}`;

  await page.goto(`/${m.mainAccountId}/planning/goals`);
  await page.getByRole("button", { name: "Nova meta" }).first().click();
  const dialog = page.getByRole("dialog");

  await dialog.getByLabel("Nome").fill(goalName);
  await dialog.getByLabel("Valor alvo").fill("100,00");

  const categoryField = dialog.getByRole("combobox", { name: "Categoria (opcional)" });
  await categoryField.click();
  await categoryField.fill(categoryName);
  await page.getByRole("option", { name: `Criar "${categoryName}"` }).click();

  // Autocomplete deve mostrar a categoria recém-criada selecionada antes do submit
  // (onCreate → id novo → auto-seleção, GoalsManager.onCreateCategory).
  await expect(categoryField).toHaveValue(categoryName);

  await dialog.getByRole("button", { name: "Salvar" }).click();

  await expect(page.getByText("Meta criada.")).toBeVisible();
  await expect(dialog).toBeHidden();

  const category = await db.category.findFirstOrThrow({
    where: { accountId: m.mainAccountId, name: categoryName },
    select: { id: true },
  });
  const goal = await db.goal.findFirstOrThrow({
    where: { accountId: m.mainAccountId, name: goalName },
    orderBy: { createdAt: "desc" },
    select: { categoryId: true },
  });
  expect(goal.categoryId).toBe(category.id);
});
