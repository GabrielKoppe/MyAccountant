import { join } from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { manifest } from "./fixtures/manifest";
import { db } from "./fixtures/db";

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

test("importar CSV faz as transações aparecerem na tabela", async ({ page }) => {
  const m = manifest();

  // Criar mês 2098/Fevereiro (a partir de uma página de mês, que tem "Novo mês").
  await page.goto(`/${m.mainAccountId}/months/${m.roMonthId}`);
  await page.getByRole("button", { name: "Novo mês", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox").click();
  await page.getByRole("option", { name: "Fevereiro" }).click();
  await dialog.getByLabel("Ano").fill("2098");
  await dialog.getByRole("button", { name: "Criar", exact: true }).click();
  // 20s: desde a spec 73 a criação de mês faz duas idas ao servidor (preview de
  // automações → createMonth). Sem automação o passo 2 é omitido, mas o preview
  // acontece de qualquer forma.
  await expect(dialog).toBeHidden({ timeout: 20_000 });

  const created = await db.month.findFirstOrThrow({
    where: { accountId: m.mainAccountId, year: 2098, month: 2 },
    select: { id: true },
  });
  await page.goto(`/${m.mainAccountId}/months/${created.id}?tab=${m.roSectionId}`);

  // Abrir o wizard e carregar o arquivo. O rótulo é `m.csvImport.importButton`
  // ("Importar"); `exact` evita casar com "Importar outro arquivo" do resultado.
  await page.getByRole("button", { name: "Importar", exact: true }).first().click();
  await page
    .locator('input[type="file"]')
    .setInputFiles(join(process.cwd(), "e2e/fixtures/sample-import.csv"));

  // Upload → Mapeamento.
  await page.getByRole("button", { name: "Próximo" }).click();

  // Mapear as colunas obrigatórias (data/valor) + descrição, e formato de valor US
  // (o CSV usa ponto decimal com delimitador vírgula; "brl" quebraria o parse).
  await mapColumn(page, "Coluna de data", "data");
  await mapColumn(page, "Coluna de valor", "valor");
  await mapColumn(page, "Coluna de descrição", "descricao");
  await page.getByRole("radio", { name: "US (1,234.56)" }).check();

  // Mapeamento → Pré-visualização → Configuração.
  await page.getByRole("button", { name: "Próximo" }).click();
  await page.getByRole("button", { name: "Próximo" }).click();

  // Configuração: destino obrigatório (nome da tabela + seção).
  await page.getByLabel("Nome da tabela").fill("Importados");
  await mapColumn(page, "Seção", "Saídas");

  await page.getByRole("button", { name: "Confirmar importação" }).click();

  // Tela de resultado → "Ver tabela" fecha o wizard e navega para a tabela criada.
  await page.getByRole("link", { name: "Ver tabela" }).click();

  // As transações importadas aparecem na tabela.
  await expect(page.getByText("Padaria E2E")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Salario E2E")).toBeVisible();
});
