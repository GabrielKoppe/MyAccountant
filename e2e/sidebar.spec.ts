// e2e/sidebar.spec.ts
//
// Spec 65 §10.3 (P4) — Drawer mobile + rail + a11y/motion (NAV-05). Cobre o
// que é impossível de validar em jsdom (Vitest): breakpoints reais via
// `@media`, hover→Tooltip e `prefers-reduced-motion` real do browser. Ver
// §4 (critérios NAV-05) e §2.3.
import { test, expect } from "@playwright/test";

import { db } from "./fixtures/db";
import { manifest } from "./fixtures/manifest";

test.use({ storageState: "e2e/.auth/owner.json" });
test.afterAll(async () => {
  await db.$disconnect();
});

const NAV_LABEL = "Navegação principal";

test.describe("Viewport mobile (< md): Drawer temporário", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("sidebar não ocupa espaço permanente; hambúrguer abre o Drawer e navegar fecha", async ({
    page,
  }) => {
    const m = manifest();
    await page.goto(`/${m.mainAccountId}/months/${m.roMonthId}`);

    // A coluna permanente existe no DOM (Box `component="nav"`) mas fica
    // `display:none` abaixo de `md` — não deve ocupar espaço nem estar
    // visível para o usuário.
    const permanentNav = page.getByRole("navigation", { name: NAV_LABEL });
    await expect(permanentNav).not.toBeVisible();

    // O hambúrguer é o único jeito de alcançar a navegação nesta largura.
    const hamburger = page.getByRole("button", { name: "Abrir menu de navegação" });
    await expect(hamburger).toBeVisible();
    await expect(hamburger).toHaveAttribute("aria-expanded", "false");

    // Antes de abrir, os itens do Drawer não são alcançáveis (Modal do MUI
    // com `keepMounted` fica oculto — `visibility:hidden`).
    const dashboardsLink = page.getByRole("link", { name: "Dashboards" });
    await expect(dashboardsLink).toBeHidden();

    await hamburger.click();
    await expect(hamburger).toHaveAttribute("aria-expanded", "true");
    await expect(dashboardsLink).toBeVisible();

    // Navegar por um item fecha o Drawer (não deixa overlay preso na tela).
    await dashboardsLink.click();
    await page.waitForURL((url) => url.pathname.endsWith("/dashboards"), { timeout: 15_000 });
    await expect(dashboardsLink).toBeHidden();
  });
});

test.describe("Desktop (>= md): coluna permanente recolhível", () => {
  test("toggle recolhe a sidebar para o rail (64px) e os itens expõem Tooltip no hover", async ({
    page,
  }) => {
    const m = manifest();
    await page.goto(`/${m.mainAccountId}/months/${m.roMonthId}`);

    const nav = page.getByRole("navigation", { name: NAV_LABEL });
    await expect(nav).toBeVisible();
    await expect(nav).toHaveCSS("width", "240px");
    await expect(nav.getByText("Dashboards")).toBeVisible();

    const collapseBtn = nav.getByRole("button", { name: "Recolher navegação" });
    await expect(collapseBtn).toHaveAttribute("aria-expanded", "true");
    await collapseBtn.click();

    // Rail: 64px, sem rótulo textual — só ícone + Tooltip/aria-label.
    await expect(nav).toHaveCSS("width", "64px");
    await expect(nav.getByText("Dashboards")).toHaveCount(0);
    const dashboardsItem = nav.getByRole("link", { name: "Dashboards" });
    await expect(dashboardsItem).toBeVisible();

    await dashboardsItem.hover();
    await expect(page.getByRole("tooltip", { name: "Dashboards" })).toBeVisible();

    const expandBtn = nav.getByRole("button", { name: "Expandir navegação" });
    await expect(expandBtn).toHaveAttribute("aria-expanded", "false");
  });

  test("rail: rodapé mantém o avatar do usuário com o badge de não-lidas (NAV-05)", async ({
    page,
  }) => {
    const m = manifest();
    const owner = await db.user.findUniqueOrThrow({
      where: { email: m.users.owner },
      select: { id: true },
    });
    // Notificação própria do teste (não depende do estado deixado por
    // e2e/notifications-menu.spec.ts, que marca o seed do owner como lido) —
    // apagada no fim para não contaminar outras specs que rodem depois.
    const created = await db.notification.create({
      data: {
        userId: owner.id,
        accountId: m.mainAccountId,
        actorId: owner.id,
        type: "invite_accepted",
        title: "E2E sidebar.spec.ts — notificação de teste (rail badge)",
        link: null,
        count: 1,
        isRead: false,
      },
      select: { id: true },
    });

    try {
      await page.goto(`/${m.mainAccountId}/months/${m.roMonthId}`);
      const nav = page.getByRole("navigation", { name: NAV_LABEL });
      await nav.getByRole("button", { name: "Recolher navegação" }).click();
      await expect(nav).toHaveCSS("width", "64px");

      // Avatar (host sempre-montado do UserMenuButton) continua visível recolhido.
      await expect(nav.locator(".MuiAvatar-root")).toBeVisible();
      // Badge de não-lidas visível junto ao avatar (contador >= 1).
      await expect(
        nav.locator(".MuiBadge-badge").filter({ hasText: /^[1-9]\d*$/ }),
      ).toBeVisible();
    } finally {
      await db.notification.delete({ where: { id: created.id } });
    }
  });
});

test.describe("prefers-reduced-motion: reduce", () => {
  test.use({ reducedMotion: "reduce" });

  test("recolher/expandir não anima largura quando o usuário pede menos movimento", async ({
    page,
  }) => {
    const m = manifest();
    await page.goto(`/${m.mainAccountId}/months/${m.roMonthId}`);

    const nav = page.getByRole("navigation", { name: NAV_LABEL });
    // Guard `@media (prefers-reduced-motion: reduce) { transition: none }`
    // (AppSidebar.tsx) — com a preferência ativa, a duração da transição de
    // `width` deve ser 0s (equivalente a nenhuma transição).
    const transitionDuration = await nav.evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(transitionDuration).toBe("0s");
  });
});
