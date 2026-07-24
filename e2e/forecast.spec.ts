// e2e/forecast.spec.ts
import { test, expect } from "@playwright/test";

import { manifest } from "./fixtures/manifest";

test.use({ storageState: "e2e/.auth/owner.json" });

test("projeção de fluxo de caixa: hero, configurações e alternância de cenário", async ({
  page,
}) => {
  const m = manifest();

  // 1. Abrir a Projeção pelo item "Projeção" da AppSidebar (spec 65), a partir de uma página conhecida
  // (precedente solo-flow/csv-import: o root da conta pode redirecionar; /months/{id} é
  // uma página estável já semeada).
  await page.goto(`/${m.mainAccountId}/months/${m.roMonthId}`);
  await page.getByRole("link", { name: "Projeção" }).click();
  await page.waitForURL((url) => url.pathname.endsWith("/forecast"), { timeout: 15_000 });

  await expect(page.getByRole("heading", { name: "Projeção de Fluxo de Caixa" })).toBeVisible();
  await expect(page.getByText(/Application error|something went wrong/i)).toHaveCount(0);

  // Seed (e2e/fixtures/seed.ts) não cria TableTemplate.autoApply nem PendingInstallment, e
  // o único Month da conta principal (roMonth, 2099/12) está no FUTURO em relação a
  // getCurrentFiscalMonth(hoje) — logo NÃO conta como "mês fechado" (meses fechados =
  // estritamente anteriores ao mês fiscal corrente). Sem recorrentes, parcelas, mês
  // fechado ou override de saldo, startingBalanceCents = "0" e todo ponto projetado
  // também fica em "0" ⇒ ForecastManager.isEmpty é true ⇒ renderiza o EmptyState (não o
  // gráfico/toggle). Isso vale para qualquer ordem de execução da suíte: os meses criados
  // pelas outras specs (solo-flow, csv-import) também usam anos 2098/2099 — sempre no
  // futuro — então nunca viram "mês fechado" e nunca alteram esta leitura.
  await expect(page.getByRole("heading", { name: "Sem dados para projetar" })).toBeVisible();
  await expect(
    page.getByText("Cadastre recorrentes e parcelas para ver sua projeção."),
  ).toBeVisible();

  // 2. Configurar um saldo de partida (override) e o horizonte pela tela de settings. Isso
  // tira a projeção do estado vazio — com override > 0 e sem recorrentes/parcelas/histórico,
  // todo ponto futuro fica constante = saldo informado — permitindo testar de fato o toggle
  // de cenário no passo 4 (o toggle não é renderizado dentro do EmptyState).
  // Dispensa o tooltip de hover da AppSidebar (o popper fica sobre o header e
  // intercepta o clique — actionability do Playwright; clique real do usuário passa).
  await page.mouse.move(0, 0);
  await page.getByRole("link", { name: "Configurar projeção" }).click();
  await page.waitForURL((url) => url.pathname.endsWith("/settings/forecast"), {
    timeout: 15_000,
  });
  await expect(page.getByRole("heading", { name: "Projeção de fluxo de caixa" })).toBeVisible();

  await page.getByLabel("Horizonte da projeção").click();
  await page.getByRole("option", { name: "12 meses" }).click();

  await page.getByLabel("Saldo de partida (opcional)").fill("1000,00");

  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Configurações de projeção salvas.")).toBeVisible();

  // 3. Voltar à Projeção — navegação DIRETA: na tela de Settings o link "Projeção" é ambíguo
  // (item da AppSidebar + item da sidebar de SettingsNav → strict mode violation). Agora com saldo
  // de partida > 0 e sem recorrentes/parcelas/estimativa para movê-lo, a série projetada fica
  // constante e positiva — sai do EmptyState, nunca rompe e mostra aviso de poucos dados.
  await page.goto(`/${m.mainAccountId}/forecast`);
  await page.waitForURL((url) => url.pathname.endsWith("/forecast"), { timeout: 15_000 });

  await expect(page.getByRole("heading", { name: "Projeção de Fluxo de Caixa" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sem dados para projetar" })).toHaveCount(0);
  await expect(page.getByText(/Application error|something went wrong/i)).toHaveCount(0);

  await expect(page.getByText("Saldo informado")).toBeVisible();
  await expect(page.getByText("Sem ruptura no horizonte")).toBeVisible();
  await expect(page.getByText("Estimativa com poucos dados")).toBeVisible();

  // 4. Toggle de cenário — ToggleButtonGroup presente e interagível; alternar cenário não
  // quebra a página (o valor numérico pode não mudar aqui, já que o bloco estimado é 0 em
  // qualquer fator de cenário — o que importa neste smoke é a interação sem crash).
  await page.mouse.move(0, 0); // dispensa tooltip da nav antes de interagir com o toggle
  const scenarioGroup = page.getByRole("group", { name: "Cenário" });
  await expect(scenarioGroup).toBeVisible();

  await scenarioGroup.getByRole("button", { name: "Otimista" }).click();
  await expect(page.getByRole("heading", { name: "Projeção de Fluxo de Caixa" })).toBeVisible();
  await expect(page.getByText(/Application error|something went wrong/i)).toHaveCount(0);

  await scenarioGroup.getByRole("button", { name: "Conservador" }).click();
  await expect(page.getByText(/Application error|something went wrong/i)).toHaveCount(0);
});
