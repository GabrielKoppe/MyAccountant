// e2e/settings-hub.spec.ts
//
// Spec 67 §8 (Critérios de Teste · E2E) — hub `/[accountId]/settings`, recorte
// por papel e varredura do `SettingsPageShell` pelas 17 rotas.
//
// O que só existe aqui (impossível em jsdom): o redirect real de
// `/settings/dashboards` → `/dashboards/monthly` (D4), a ausência de redirect do
// `viewer` em `/settings/*` (D3) e o destino real do link "Configurações" da
// AppSidebar (§4 SET-02).
import { expect, test, type Locator, type Page } from "@playwright/test";

import { manifest } from "./fixtures/manifest";

// ---------------------------------------------------------------------------
// Catálogo esperado
// ---------------------------------------------------------------------------
//
// ESPELHA `src/components/settings/settings-catalog.ts` (SETTINGS_FAMILIES).
// Deliberadamente NÃO importado: nenhum spec deste `e2e/` importa de `src/`
// hoje, `tsconfig.json` exclui a pasta `e2e` (logo o path mapping `@/*` nunca
// foi exercitado pelo transform do Playwright) e `settings-catalog.ts` puxa
// `@/lib/messages` em runtime — um import que falhasse derrubaria o arquivo
// inteiro. A não-divergência entre esta lista e o catálogo já é garantida no
// unit (`settings-nav-groups.test.ts`, "17 rotas sem órfão nem duplicata"); a
// travessia abaixo (`expectCardRows`) confirma que o que o hub RENDERIZA é
// exatamente esta lista.
//
// Se uma família/página nova entrar no catálogo, ela entra aqui também.

type ExpectedFamily = {
  label: string;
  /** `href` relativo a `/[accountId]/settings/`, na ordem do card. */
  rows: string[];
};

/** Ordem normativa do §4 (SET-02): Estrutura → Apresentação → Entrada de dados → Planejamento → Conta. */
const OWNER_FAMILIES: ExpectedFamily[] = [
  { label: "Estrutura", rows: ["sections", "categories", "institutions", "responsibles"] },
  // Dashboards é UMA linha (D4) apontando para `/settings/dashboards`, que redireciona.
  { label: "Apresentação", rows: ["table-types", "models", "dashboards"] },
  { label: "Entrada de dados", rows: ["templates", "aliases", "connectors"] },
  { label: "Planejamento", rows: ["forecast", "checklist"] },
  { label: "Conta", rows: ["general", "members", "audit"] },
];

/** Rota real + moldura esperada. 17 rotas = 15 páginas, com Dashboards contando 3 (D4). */
const SETTINGS_ROUTES: Array<{ href: string; family: string; title: string }> = [
  { href: "sections", family: "Estrutura", title: "Seções" },
  { href: "categories", family: "Estrutura", title: "Categorias" },
  { href: "institutions", family: "Estrutura", title: "Instituições" },
  { href: "responsibles", family: "Estrutura", title: "Responsáveis" },
  { href: "table-types", family: "Apresentação", title: "Tipos de tabela" },
  { href: "models", family: "Apresentação", title: "Modelos de tabela" },
  { href: "dashboards/monthly", family: "Apresentação", title: "Dashboards" },
  { href: "dashboards/yearly", family: "Apresentação", title: "Dashboards" },
  { href: "dashboards/month-summary", family: "Apresentação", title: "Dashboards" },
  { href: "templates", family: "Entrada de dados", title: "Templates de importação" },
  { href: "aliases", family: "Entrada de dados", title: "Apelidos" },
  { href: "connectors", family: "Entrada de dados", title: "Conectores de IA" },
  { href: "forecast", family: "Planejamento", title: "Projeção" },
  { href: "checklist", family: "Planejamento", title: "Checklist mensal" },
  { href: "general", family: "Conta", title: "Geral" },
  { href: "members", family: "Conta", title: "Membros" },
  { href: "audit", family: "Conta", title: "Trilha de auditoria" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Cards do hub. Escopo `main` porque a `AppSidebar` fica FORA do `<main>`; a
 * `SettingsNav` (dentro do `<main>`, vinda do `settings/layout.tsx`) repete os
 * mesmos rótulos e hrefs das linhas, então nada aqui pode ser buscado no
 * documento inteiro. `.MuiCard-root` e não `.MuiPaper-root`: o banner de
 * atenção é um `Paper` e entraria na contagem.
 */
function hubCards(page: Page): Locator {
  return page.locator("main .MuiCard-root");
}

/** A linha inteira do card é um `<a>` — o href é a asserção, não o texto. */
async function expectCardRows(card: Locator, settingsBase: string, rows: string[]): Promise<void> {
  const links = card.getByRole("link");
  // Conta primeiro: pega linha ÓRFÃ (href fora do catálogo) tanto quanto falta.
  await expect(links).toHaveCount(rows.length);
  for (const href of rows) {
    await expect(card.locator(`a[href="${settingsBase}/${href}"]`)).toHaveCount(1);
  }
}

// ---------------------------------------------------------------------------
// §4 SET-02 — hub para `owner`
// ---------------------------------------------------------------------------

test.describe("hub de Configurações — owner", () => {
  test.use({ storageState: "e2e/.auth/owner.json" });

  test("renderiza os 5 cards de família na ordem da spec, com contagens", async ({ page }) => {
    const m = manifest();
    const settingsBase = `/${m.mainAccountId}/settings`;
    await page.goto(settingsBase);

    // A rota `/settings` existe e é o hub — não mais um redirect para `general`.
    await expect(page).toHaveURL(settingsBase);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Configurações");

    const cards = hubCards(page);
    await expect(cards).toHaveCount(OWNER_FAMILIES.length);

    for (const [index, family] of OWNER_FAMILIES.entries()) {
      const card = cards.nth(index);
      // `toHaveText` lê `textContent` — imune ao `text-transform: uppercase`
      // do `Typography variant="overline"` do cabeçalho do card.
      await expect(card.locator("h2")).toHaveText(family.label);
      await expectCardRows(card, settingsBase, family.rows);
    }

    // Contagem barata à direita da linha (§4 SET-02). Só onde o catálogo tem
    // contagem — Geral, Auditoria e Dashboards saem sem número, de propósito.
    // Regex e não valor fixo: outros specs da suíte criam dados na conta principal.
    await expect(cards.nth(0).locator(`a[href="${settingsBase}/sections"]`)).toContainText(/\d/);
    await expect(cards.nth(4).locator(`a[href="${settingsBase}/members"]`)).toContainText(/\d/);
    // Dashboards sai SEM número: as três páginas (mensal, anual, resumo) são
    // fixas, então contagem ali é ruído. Só o rótulo e o subtítulo.
    await expect(cards.nth(1).locator(`a[href="${settingsBase}/dashboards"]`)).toHaveText(
      /^Dashboards/,
    );
  });

  test("clicar numa linha do card navega para a página daquela linha", async ({ page }) => {
    const m = manifest();
    const settingsBase = `/${m.mainAccountId}/settings`;
    await page.goto(settingsBase);

    // Linha comum: card Estrutura → Categorias.
    await hubCards(page).nth(0).locator(`a[href="${settingsBase}/categories"]`).click();
    await page.waitForURL((url) => url.pathname === `${settingsBase}/categories`, {
      timeout: 15_000,
    });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Categorias");

    // Linha de Dashboards (D4): UMA linha para `/settings/dashboards`, que
    // redireciona para a sub-rota `monthly`.
    await page.goto(settingsBase);
    await hubCards(page).nth(1).locator(`a[href="${settingsBase}/dashboards"]`).click();
    await page.waitForURL((url) => url.pathname === `${settingsBase}/dashboards/monthly`, {
      timeout: 15_000,
    });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dashboards");
  });
});

// ---------------------------------------------------------------------------
// §4 "Papéis" — editor
// ---------------------------------------------------------------------------

test.describe("hub de Configurações — editor", () => {
  test.use({ storageState: "e2e/.auth/editor.json" });

  // DIVERGÊNCIA SPEC × CÓDIGO — a própria Spec 67 se contradiz sobre o editor:
  //
  //   (a) §4 SET-02: "O card **Conta** DEVE ser renderizado apenas para
  //       `owner`, marcado com o badge 'somente owner'."
  //   (b) §4 SET-01: "Os itens da família Conta NÃO DEVEM ser renderizados para
  //       papéis diferentes de `owner`."
  //   (c) §8 (E2E):  "`/settings` renderiza 5 cards para `owner` e 4 para
  //       `editor` (sem o card Conta)."
  //   (d) §4 "Papéis": "`editor` DEVE acessar as famílias 1–4; da família Conta
  //       DEVE ver Geral e Membros, mas NÃO DEVE ver Trilha de auditoria."
  //
  // (d) exige o card Conta para o editor; (a), (b) e (c) o proíbem.
  // `getSettingsFamilies` (settings-catalog.ts) implementa (d): para `editor`
  // devolve as 5 famílias, filtrando apenas os `entry.ownerOnly` — hoje só
  // `audit`. Coerente com o guard real das páginas: `general` só barra `viewer`
  // (o editor a acessa), e só `audit` é `role !== "owner"`.
  //
  // Este teste verifica o COMPORTAMENTO REAL. Não asserta o badge "somente
  // owner": o catálogo mantém `ownerBadge: true` na família Conta para o
  // editor, o que é um rótulo falso para quem de fato acessa Geral e Membros —
  // reportado, mas fora do escopo desta suíte.
  test("vê as 5 famílias; o card Conta aparece sem a Trilha de auditoria", async ({ page }) => {
    const m = manifest();
    const settingsBase = `/${m.mainAccountId}/settings`;
    await page.goto(settingsBase);

    await expect(page).toHaveURL(settingsBase);

    const cards = hubCards(page);
    await expect(cards).toHaveCount(OWNER_FAMILIES.length);

    const contaCard = cards.nth(4);
    await expect(contaCard.locator("h2")).toHaveText("Conta");
    // Só o ITEM ownerOnly some — a família continua inteira no hub.
    await expectCardRows(contaCard, settingsBase, ["general", "members"]);
    await expect(page.locator(`main a[href="${settingsBase}/audit"]`)).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// §4 "Papéis" / D3 — viewer
// ---------------------------------------------------------------------------

test.describe("hub de Configurações — viewer", () => {
  test.use({ storageState: "e2e/.auth/viewer.json" });

  // D3: o carve-out da Spec 65 (NAV-04) é mantido — `viewer` NÃO é redirecionado
  // para fora de `/settings/*`; vê o hub com apenas o card Conta e a linha Membros.
  test("abre o hub sem redirect, com apenas o card Conta e a linha Membros", async ({ page }) => {
    const m = manifest();
    const settingsBase = `/${m.mainAccountId}/settings`;
    await page.goto(settingsBase);

    await expect(page).toHaveURL(settingsBase);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Configurações");

    const cards = hubCards(page);
    await expect(cards).toHaveCount(1);
    await expect(cards.nth(0).locator("h2")).toHaveText("Conta");
    await expectCardRows(cards.nth(0), settingsBase, ["members"]);

    // `getSettingsFamilies("viewer")` zera o `ownerBadge`: a família que o viewer
    // enxerga não é "somente owner".
    await expect(page.locator("main").getByText("somente owner")).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// §4 SET-03 — varredura do shell pelas 17 rotas
// ---------------------------------------------------------------------------

test.describe("SettingsPageShell — varredura das 17 rotas", () => {
  test.use({ storageState: "e2e/.auth/owner.json" });

  for (const route of SETTINGS_ROUTES) {
    test(`/settings/${route.href} expõe breadcrumb, título, propósito e ≤1 ação primária`, async ({
      page,
    }) => {
      const m = manifest();
      const path = `/${m.mainAccountId}/settings/${route.href}`;
      await page.goto(path);

      // Nenhuma das 17 redireciona para o owner.
      await expect(page).toHaveURL(path);

      // O cabeçalho do shell é o único `<header>` da página (a AppSidebar e a
      // SettingsNav usam `<nav>`/`<div>`), e fica dentro do `<main>`.
      const header = page.locator("header");
      await expect(header).toHaveCount(1);

      // Regra 1 — breadcrumb `Configurações / <Família>`, sempre.
      const breadcrumb = header.getByRole("navigation", { name: "Trilha de navegação" });
      await expect(breadcrumb).toBeVisible();
      await expect(breadcrumb).toContainText("Configurações");
      await expect(breadcrumb).toContainText(route.family);

      // Um único `h1`, e é o título da página (D5/D15: `variant="h4"`, `component="h1"`).
      const h1 = page.getByRole("heading", { level: 1 });
      await expect(h1).toHaveCount(1);
      await expect(h1).toHaveText(route.title);

      // Regra 3 — uma frase de propósito, sempre. É o único `<p>` do cabeçalho
      // (breadcrumb e chip são `span`; ações são `button`).
      const purpose = header.locator("p");
      await expect(purpose).toHaveCount(1);
      await expect(purpose).not.toBeEmpty();
      // "Frase", não rótulo solto: o propósito mais curto do §7.5 tem 60+ chars.
      expect(((await purpose.textContent()) ?? "").trim().length).toBeGreaterThan(30);

      // Regra 4 — no máximo UMA ação primária `contained` no cabeçalho.
      // (Estados vazios do CORPO podem ter o seu próprio `contained`; por isso
      // o escopo é o `<header>`, não a página.)
      const containedInHeader = await header.locator(".MuiButton-contained").count();
      expect(containedInHeader).toBeLessThanOrEqual(1);
    });
  }
});

// ---------------------------------------------------------------------------
// §4 SET-02 — o link "Configurações" da AppSidebar aponta para o hub
// ---------------------------------------------------------------------------

test.describe("AppSidebar → Configurações", () => {
  test.use({ storageState: "e2e/.auth/owner.json" });

  test('o link "Configurações" leva a /settings, não a /settings/general', async ({ page }) => {
    const m = manifest();
    const settingsBase = `/${m.mainAccountId}/settings`;

    // Parte de uma página estável já semeada (mesmo precedente de forecast.spec.ts).
    await page.goto(`/${m.mainAccountId}/months/${m.roMonthId}`);

    // Escopo na coluna permanente: o Drawer mobile é `keepMounted` e duplicaria o link.
    const nav = page.getByRole("navigation", { name: "Navegação principal" });
    const settingsLink = nav.getByRole("link", { name: "Configurações", exact: true });
    await expect(settingsLink).toHaveAttribute("href", settingsBase);

    await settingsLink.click();
    await page.waitForURL((url) => url.pathname === settingsBase, { timeout: 15_000 });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Configurações");
    await expect(hubCards(page)).toHaveCount(OWNER_FAMILIES.length);
  });
});
