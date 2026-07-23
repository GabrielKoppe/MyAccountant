// e2e/planning-dimensions.spec.ts
//
// Regressão dos bugs de dimensão reportados: criar Meta/Orçamento com uma dimensão
// de <Select> comum (Seção/Responsável) selecionada falhava ("ID inválido" no Orçamento,
// silêncio na Meta). Causa: os campos de dimensão NÃO selecionados chegavam ao
// zodResolver como "" (string vazia), e `z.string().cuid().optional()` só ignora
// `undefined` — em "" roda o `.cuid()` e falha. O `planning-forms.spec.ts` só cobria
// Categoria (CreatableEntitySelect); os <Select> comuns (Seção/Responsável/Tipo de tabela)
// nunca foram exercitados end-to-end — este arquivo fecha essa lacuna.
import { test, expect } from "@playwright/test";
import { manifest } from "./fixtures/manifest";
import { db } from "./fixtures/db";

test.use({ storageState: "e2e/.auth/owner.json" });
test.afterAll(async () => {
  await db.$disconnect();
});

test("criar Meta com Seção (Select comum) selecionada salva sectionId", async ({ page }) => {
  const m = manifest();
  const goalName = `Meta Dim ${Date.now()}`;

  await page.goto(`/${m.mainAccountId}/planning/goals`);
  await page.getByRole("button", { name: "Nova meta" }).first().click();
  const dialog = page.getByRole("dialog");

  await dialog.getByLabel("Nome").fill(goalName);
  await dialog.getByLabel("Valor alvo").fill("100,00");

  // Seção é um <Select> MUI comum (não o CreatableEntitySelect) — combobox rotulado
  // pelo InputLabel "Seção (opcional)".
  await dialog.getByRole("combobox", { name: "Seção (opcional)" }).click();
  await page.getByRole("option", { name: "Saídas", exact: true }).click();

  await dialog.getByRole("button", { name: "Salvar" }).click();

  await expect(page.getByText("Meta criada.")).toBeVisible();
  await expect(dialog).toBeHidden();

  const created = await db.goal.findFirstOrThrow({
    where: { accountId: m.mainAccountId, name: goalName },
    select: { sectionId: true },
  });
  expect(created.sectionId).not.toBeNull();
});

test("criar Orçamento com Seção (Select comum) selecionada salva sem 'ID inválido'", async ({
  page,
}) => {
  const m = manifest();
  const budgetName = `Orç Dim ${Date.now()}`;

  await page.goto(`/${m.mainAccountId}/planning/budgets`);
  await page.getByRole("button", { name: "Novo orçamento" }).first().click();
  const dialog = page.getByRole("dialog");

  await dialog.getByRole("combobox", { name: "Seção", exact: true }).click();
  await page.getByRole("option", { name: "Saídas", exact: true }).click();

  await dialog.getByLabel("Valor alvo").fill("100,00");
  await dialog.getByLabel("Nome (opcional)").fill(budgetName);

  await dialog.getByRole("button", { name: "Salvar" }).click();

  await expect(page.getByText("Orçamento criado.")).toBeVisible();
  await expect(dialog).toBeHidden();

  const created = await db.budget.findFirstOrThrow({
    where: { accountId: m.mainAccountId, name: budgetName },
    select: { sectionIds: true },
  });
  expect(created.sectionIds).toHaveLength(1);
});

test("criar Orçamento com DUAS categorias (multi-select criável) salva categoryIds com os 2 ids", async ({
  page,
}) => {
  const m = manifest();
  const budgetName = `Orç Multi ${Date.now()}`;

  await page.goto(`/${m.mainAccountId}/planning/budgets`);
  await page.getByRole("button", { name: "Novo orçamento" }).first().click();
  const dialog = page.getByRole("dialog");

  // Categoria é um CreatableEntitySelect MULTIPLE (chips) — Autocomplete com
  // disableCloseOnSelect, então uma única abertura permite escolher as duas opções
  // em sequência sem reabrir. Localiza pelo combobox (aria-label "Categoria") como no
  // teste single de planning-forms.spec.ts.
  await dialog.getByRole("combobox", { name: "Categoria", exact: true }).click();
  await page.getByRole("option", { name: "Alimentação", exact: true }).click();
  await page.getByRole("option", { name: "Transporte", exact: true }).click();
  // Fecha o dropdown (disableCloseOnSelect o mantém aberto) antes de mexer nos outros campos.
  await page.keyboard.press("Escape");

  // Os dois chips selecionados (MUI <Chip>, renderizado como div) devem estar visíveis
  // no controle antes do submit — dropdown já fechado pelo Escape, então o texto só
  // aparece como chip, não como opção da lista.
  await expect(dialog.getByText("Alimentação", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Transporte", { exact: true })).toBeVisible();

  await dialog.getByLabel("Valor alvo").fill("100,00");
  await dialog.getByLabel("Nome (opcional)").fill(budgetName);

  await dialog.getByRole("button", { name: "Salvar" }).click();

  await expect(page.getByText("Orçamento criado.")).toBeVisible();
  await expect(dialog).toBeHidden();

  const [alimentacao, transporte] = await Promise.all([
    db.category.findFirstOrThrow({
      where: { accountId: m.mainAccountId, name: "Alimentação" },
      select: { id: true },
    }),
    db.category.findFirstOrThrow({
      where: { accountId: m.mainAccountId, name: "Transporte" },
      select: { id: true },
    }),
  ]);

  const created = await db.budget.findFirstOrThrow({
    where: {
      accountId: m.mainAccountId,
      name: budgetName,
      categoryIds: { hasEvery: [alimentacao.id, transporte.id] },
    },
    select: { categoryIds: true },
  });
  expect(created.categoryIds).toHaveLength(2);
  expect(created.categoryIds).toEqual(
    expect.arrayContaining([alimentacao.id, transporte.id]),
  );
});

test("criar Orçamento com Responsável selecionado salva memberUserIds (party id)", async ({
  page,
}) => {
  const m = manifest();
  const budgetName = `Orç Responsável ${Date.now()}`;

  await page.goto(`/${m.mainAccountId}/planning/budgets`);
  await page.getByRole("button", { name: "Novo orçamento" }).first().click();
  const dialog = page.getByRole("dialog");

  // "Membro" virou "Responsável" (Spec 60): a dimensão não é mais um <Select> comum com
  // "— Nenhum —", e sim um CreatableEntitySelect MULTIPLE (chips), com opções vindas das
  // `responsibleParty` da account (partyDisplayMap), não dos account members. "Responsável
  // E2E" (kind external) é semeado em seed.ts. Mesmo idioma do multi-select de Categoria:
  // abre a combobox, escolhe a opção, Escape p/ fechar (disableCloseOnSelect a mantém aberta).
  await dialog.getByRole("combobox", { name: "Responsável", exact: true }).click();
  await page.getByRole("option", { name: "Responsável E2E", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(dialog.getByText("Responsável E2E", { exact: true })).toBeVisible();

  await dialog.getByLabel("Valor alvo").fill("100,00");
  await dialog.getByLabel("Nome (opcional)").fill(budgetName);

  await dialog.getByRole("button", { name: "Salvar" }).click();

  await expect(page.getByText("Orçamento criado.")).toBeVisible();
  await expect(dialog).toBeHidden();

  // memberUserIds guarda o id da responsibleParty selecionada (a dimensão "member" do
  // Budget resolve por partyId via responsiblePartyIdsForFilter). Assert no banco: 1 id,
  // e é exatamente o da party "Responsável E2E".
  const party = await db.responsibleParty.findFirstOrThrow({
    where: { accountId: m.mainAccountId, name: "Responsável E2E" },
    select: { id: true },
  });
  const created = await db.budget.findFirstOrThrow({
    where: { accountId: m.mainAccountId, name: budgetName },
    select: { memberUserIds: true },
  });
  expect(created.memberUserIds).toHaveLength(1);
  expect(created.memberUserIds).toContain(party.id);
});
