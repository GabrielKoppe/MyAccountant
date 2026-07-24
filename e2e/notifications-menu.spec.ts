// e2e/notifications-menu.spec.ts
import { test, expect } from "@playwright/test";

import { manifest } from "./fixtures/manifest";

test.use({ storageState: "e2e/.auth/owner.json" });

// Títulos semeados em e2e/fixtures/seed.ts (Spec 65 P5) — manter em sincronia com o seed.
const NOTIF_LINKED_TITLE = "E2E Editor adicionou 1 transação em Dezembro 2099";
const NOTIF_UNLINKED_TITLE = "E2E Editor entrou na conta como editor";

test("notificações no menu do usuário: badge, seção, marca-lido ao expandir e navegação (NAV-02b)", async ({
  page,
}) => {
  const mf = manifest();
  // Página estável já semeada; começamos COM ?tab para provar que o link da notificação
  // navega SEM ?tab (o `link` é o monthId puro — não confundir com o link do quick-add).
  await page.goto(`/${mf.mainAccountId}/months/${mf.roMonthId}?tab=${mf.roSectionId}`);

  // O host sempre-montado (avatar do UserMenuButton) mostra o badge de 2 não-lidas.
  const avatarButton = page.locator(".MuiToolbar-root button:has(.MuiBadge-badge)");
  const badge2 = page.locator(".MuiToolbar-root .MuiBadge-badge").filter({ hasText: /^2$/ });
  await expect(badge2).toBeVisible();

  // Abrir o menu para OUTRO fim (sem expandir Notificações) NÃO pode zerar o badge.
  await avatarButton.click();
  await expect(page.getByRole("button", { name: "Notificações" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(
    page.locator(".MuiToolbar-root .MuiBadge-badge").filter({ hasText: /^2$/ }),
  ).toBeVisible();

  // Expandir a seção Notificações carrega a lista (item com link + item sem link).
  await avatarButton.click();
  await page.getByRole("button", { name: "Notificações" }).click();
  await expect(page.getByText(NOTIF_LINKED_TITLE)).toBeVisible();
  await expect(page.getByText(NOTIF_UNLINKED_TITLE)).toBeVisible();

  // Clicar na notificação com link fecha o menu e navega ao mês SEM ?tab.
  await page.getByText(NOTIF_LINKED_TITLE).click();
  await page.waitForURL(
    (url) =>
      url.pathname === `/${mf.mainAccountId}/months/${mf.roMonthId}` && url.search === "",
    { timeout: 15_000 },
  );
  // Menu fechado após o clique.
  await expect(page.getByText(NOTIF_LINKED_TITLE)).toHaveCount(0);

  // Marca-lido ao expandir: recarregando, não há mais badge com contagem.
  await page.reload();
  await expect(
    page.locator(".MuiToolbar-root .MuiBadge-badge").filter({ hasText: /^[0-9]+$/ }),
  ).toHaveCount(0);
});
