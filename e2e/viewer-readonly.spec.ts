// e2e/viewer-readonly.spec.ts
import { test, expect } from "@playwright/test";

import { manifest } from "./fixtures/manifest";

test.use({ storageState: "e2e/.auth/viewer.json" });

test("viewer não vê controles de escrita na tabela", async ({ page }) => {
  const m = manifest();
  await page.goto(`/${m.mainAccountId}/months/${m.roMonthId}?tab=${m.roSectionId}`);

  // Leitura funciona: a tabela e a transação semeadas aparecem.
  await expect(page.getByText("Contas fixas")).toBeVisible();
  await expect(page.getByText("Aluguel")).toBeVisible();

  // Escrita indisponível: add-row e toggles de linha ausentes.
  await expect(page.getByRole("button", { name: "Nova transação" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Marcar como pendente" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Adicionar aos favoritos" })).toHaveCount(0);
});

// Spec 65 §4 NAV-04 / §10.5 (P7): carve-out do redirect global de /settings/*
// — "Membros" abre em leitura para todos os papéis; os demais destinos
// continuam owner/editor-only.
test("viewer vê /settings/members em modo leitura, sem ações de gestão", async ({ page }) => {
  const m = manifest();
  await page.goto(`/${m.mainAccountId}/settings/members`);

  // Sem redirect: a página de membros abre normalmente para o viewer.
  await expect(page).toHaveURL(`/${m.mainAccountId}/settings/members`);
  await expect(page.getByRole("heading", { name: "Membros" })).toBeVisible();

  // Ações de gestão restritas a owner (MembersTable/InviteForm já gateiam
  // por role) — nenhuma deve aparecer para o viewer.
  await expect(page.getByRole("button", { name: "Enviar convite" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Remover" })).toHaveCount(0);
  await expect(page.getByRole("combobox")).toHaveCount(0);
});

test("viewer é barrado em /settings/general e /settings/connectors", async ({ page }) => {
  const m = manifest();

  await page.goto(`/${m.mainAccountId}/settings/general`);
  await page.waitForURL((url) => !url.pathname.includes("/settings/"));

  await page.goto(`/${m.mainAccountId}/settings/connectors`);
  await page.waitForURL((url) => !url.pathname.includes("/settings/"));
});
