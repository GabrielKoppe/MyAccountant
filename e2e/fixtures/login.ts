import { expect, type BrowserContext, type Page } from "@playwright/test";
import { E2E_PASSWORD } from "./manifest";

/**
 * Login por credentials robusto a race de hidratação: re-tenta o submit até o cookie de
 * sessão do NextAuth aparecer. Um clique em "Entrar" antes do React hidratar o form vira
 * no-op (nenhum POST) — o retry re-navega e re-submete até o round-trip de fato acontecer.
 * A checagem é por cookie (não por URL), robusta ao destino do redirect pós-login.
 */
export async function loginAs(page: Page, ctx: BrowserContext, email: string): Promise<void> {
  await expect(async () => {
    const hasSession = (await ctx.cookies()).some((c) => c.name.endsWith("authjs.session-token"));
    if (hasSession) return;
    await page.goto("/login");
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Senha").fill(E2E_PASSWORD);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.waitForTimeout(2000);
    expect((await ctx.cookies()).some((c) => c.name.endsWith("authjs.session-token"))).toBe(true);
  }).toPass({ timeout: 45_000, intervals: [1000, 2000, 3000, 5000] });
}
