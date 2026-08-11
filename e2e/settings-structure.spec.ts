// e2e/settings-structure.spec.ts
//
// Spec 68 §8 (Critérios de Teste · E2E) — as quatro páginas da família Estrutura.
//
// O que só existe aqui, e não no unit: a página REAL renderizada a partir do banco,
// com o dado semeado passando pelo Server Component, pelo adapter de status e pelas
// células adaptativas. O unit prova a lógica com props inventadas; isto prova que o
// que sai do Prisma chega à tela do jeito certo.
//
// Convenção deste diretório: nenhum spec importa de `src/` (o `tsconfig.json` exclui
// `e2e/`, então o path mapping `@/*` nunca foi exercitado pelo transform do
// Playwright). Os textos abaixo são literais que ESPELHAM `src/lib/messages/pt-BR.ts`
// — se um rótulo mudar lá, este arquivo quebra de propósito.
import { expect, test, type Page } from "@playwright/test";

import { manifest } from "./fixtures/manifest";

/** Linha da tabela que contém um texto — o `<tr>` ancestral. */
function rowWith(page: Page, text: string) {
  return page.locator("tbody tr").filter({ hasText: text }).first();
}

test.describe("Estrutura · Seções", () => {
  test.use({ storageState: "e2e/.auth/owner.json" });

  test("cada seção mostra o tipo como badge, e a legenda dos quatro tipos aparece", async ({
    page,
  }) => {
    await page.goto(`/${manifest().mainAccountId}/settings/sections`);
    await expect(page.getByRole("heading", { name: "Seções" })).toBeVisible();

    // Spec 68 D1 — o badge lê o `countType` que já existia. O seed tem uma seção de
    // cada: Entradas=add, Saídas=subtract, Investimentos=neutral.
    await expect(rowWith(page, "Entradas")).toContainText("Entrada");
    await expect(rowWith(page, "Saídas")).toContainText("Saída");
    await expect(rowWith(page, "Investimentos")).toContainText("Neutra");

    // A legenda vive no `subheader` do shell, NÃO no `toolbar` — o gate dos 12 itens
    // a esconderia numa lista de 3 seções, que é justamente o caso aqui.
    const main = page.locator("main");
    await expect(main.getByText("Tipos", { exact: true })).toBeVisible();
    await expect(main.getByText("sai da conta")).toBeVisible();
    await expect(main.getByText("entra na conta")).toBeVisible();
    await expect(main.getByText("não entra no total do mês")).toBeVisible();
  });

  test("o menu da linha não oferece Mesclar em Seções", async ({ page }) => {
    await page.goto(`/${manifest().mainAccountId}/settings/sections`);

    await page.getByRole("button", { name: "Ações desta linha: Saídas" }).click();

    await expect(page.getByRole("menuitem", { name: "Ver uso" })).toBeVisible();
    // Escopo deliberado: seção não está entre as entidades de mesclagem (§2.5), e
    // item inaplicável NÃO é renderizado desabilitado — some.
    await expect(page.getByRole("menuitem", { name: "Mesclar" })).toHaveCount(0);
  });
});

test.describe("Estrutura · Categorias", () => {
  test.use({ storageState: "e2e/.auth/owner.json" });

  test("expandir uma categoria revela suas subcategorias", async ({ page }) => {
    await page.goto(`/${manifest().mainAccountId}/settings/categories`);
    await expect(page.getByRole("heading", { name: "Categorias" })).toBeVisible();

    // A coluna "Seção padrão" (e o "herda" da subcategoria, que existia só para
    // dizer que ela herdava a seção do pai) saiu na revisão de estilo — era erro de
    // projeto. O que resta para provar aqui é a árvore em si.
    await expect(rowWith(page, "Alimentação")).toBeVisible();
    await expect(page.getByText("Mercado")).toHaveCount(0);

    await page.getByRole("button", { name: "Expandir Alimentação" }).click();
    await expect(rowWith(page, "Mercado")).toBeVisible();
  });
});

test.describe("Estrutura · Instituições", () => {
  test.use({ storageState: "e2e/.auth/owner.json" });

  test("a célula Detalhes renderiza só o que existe para o tipo", async ({ page }) => {
    await page.goto(`/${manifest().mainAccountId}/settings/institutions`);
    await expect(page.getByRole("heading", { name: "Instituições" })).toBeVisible();

    // Cartão: final + fecha/vence.
    const card = rowWith(page, "Cartão E2E");
    await expect(card).toContainText("Cartão");
    await expect(card).toContainText("4471");
    await expect(card).toContainText("fecha 8 / vence 15");

    // Banco: agência e conta — e NENHUM campo de cartão.
    const bank = rowWith(page, "Banco E2E");
    await expect(bank).toContainText("ag. 0192");
    await expect(bank).toContainText("cc 34567-8");
    await expect(bank).not.toContainText("fecha");

    // Corretora: nada se aplica, e a célula diz isso em vez de ficar muda.
    await expect(rowWith(page, "Corretora E2E")).toContainText("corretora não tem detalhes");
  });

  test("instituição sem tipo mostra '—' e nenhum detalhe inventado", async ({ page }) => {
    await page.goto(`/${manifest().mainAccountId}/settings/institutions`);

    // "Banco A" é anterior à Spec 68: nada é inferido do nome (§4), nem mesmo o
    // "Banco" que está escrito nele.
    const untyped = rowWith(page, "Banco A");
    await expect(untyped).not.toContainText("ag.");
    await expect(untyped).not.toContainText("fecha");
  });
});

test.describe("Estrutura · Responsáveis", () => {
  test.use({ storageState: "e2e/.auth/owner.json" });

  test("responsável sem membro vinculado diz 'nenhum — só rótulo'", async ({ page }) => {
    await page.goto(`/${manifest().mainAccountId}/settings/responsibles`);
    await expect(page.getByRole("heading", { name: "Responsáveis" })).toBeVisible();

    // D4 — vínculo 0..N para qualquer kind: o seed cria um `external` sem ninguém, e
    // a célula precisa distinguir isso de "carregando" ou "vazio por engano".
    await expect(rowWith(page, "Responsável E2E")).toContainText("nenhum — só rótulo");
  });
});
