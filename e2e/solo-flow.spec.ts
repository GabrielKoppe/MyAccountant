import { test, expect } from "@playwright/test";
import { manifest } from "./fixtures/manifest";
import { db } from "./fixtures/db";

test.use({ storageState: "e2e/.auth/owner.json" });
test.afterAll(async () => {
  await db.$disconnect();
});

test("criar mês, tabela, transação e exportar CSV com a transação", async ({ page }) => {
  const m = manifest();
  // Uma página de mês tem o botão "Novo mês" no header (o root da conta redireciona p/ onboarding).
  await page.goto(`/${m.mainAccountId}/months/${m.roMonthId}`);

  // 1. Criar mês 2098/Janeiro.
  await page.getByRole("button", { name: "Novo mês", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox").click(); // único combobox no dialog = select de mês
  await page.getByRole("option", { name: "Janeiro" }).click();
  await dialog.getByLabel("Ano").fill("2098");
  await dialog.getByRole("button", { name: "Criar", exact: true }).click();
  // 20s: desde a spec 73 a criação de mês faz duas idas ao servidor (preview de
  // automações → createMonth). Sem automação o passo 2 é omitido, mas o preview
  // acontece de qualquer forma.
  await expect(dialog).toBeHidden({ timeout: 20_000 });

  const created = await db.month.findFirstOrThrow({
    where: { accountId: m.mainAccountId, year: 2098, month: 1 },
    select: { id: true },
  });
  await page.goto(`/${m.mainAccountId}/months/${created.id}?tab=${m.roSectionId}`);

  // 2. Criar uma tabela na seção. Rótulo real: `m.financeTables.createButton`.
  await page.getByRole("button", { name: "Nova tabela" }).first().click();
  const tableDialog = page.getByRole("dialog");
  await tableDialog.getByLabel("Nome da tabela").fill("Mercado");
  await tableDialog.getByRole("button", { name: "Criar" }).click();
  await expect(tableDialog).toBeHidden();

  // 3. Lançar uma transação na linha inline.
  await page.getByRole("button", { name: "Nova transação" }).first().click();
  const row = page
    .getByRole("row")
    .filter({ has: page.getByRole("button", { name: "Salvar", exact: true }) });
  await row.getByPlaceholder("Descrição").fill("Compra teste E2E");
  // Célula de valor: único input[type=text] da linha sem placeholder/aria-label.
  await row.locator('input[type="text"]:not([placeholder]):not([aria-label])').first().fill("100");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("Compra teste E2E")).toBeVisible();

  // 4. Exportar CSV pelo menu e checar o conteúdo.
  await page.goto(`/${m.mainAccountId}/months/${created.id}?tab=summary`);
  await page.getByRole("button", { name: "Mais opções" }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("menuitem", { name: "CSV" }).click(),
  ]);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const csv = Buffer.concat(chunks).toString("utf8");
  expect(csv).toContain("Compra teste E2E");
});
