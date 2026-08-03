// e2e/fixtures/manifest.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const E2E_PASSWORD = "E2ePass123";

export type SeedManifest = {
  users: Record<"owner" | "editor" | "viewer" | "invitee", string>;
  mainAccountId: string;
  inviteAccountId: string;
  roMonthId: string;
  roSectionId: string;
  // Spec 66 P8 — fixtures do modal de detalhe (e2e/transaction-detail.spec.ts), num mês
  // dedicado isolado (2099/11) na conta principal. Seção reusa `roSectionId` ("Saídas").
  spec66MonthId: string;
  simpleTxId: string;
  linkSourceTxId: string;
  linkTargetTxId: string;
  installmentGroupId: string;
  installmentTxId: string;
  // Spec 73 §2.1/§2.3 — import de fatura com parcelamento
  // (e2e/installment-import-link.spec.ts), meses dedicados 2098/06 e 2098/07 na
  // conta principal.
  spec73InvoiceMonthId: string;
  spec73ImportMonthId: string;
  spec73GroupId: string;
  // Spec 73 §2.4 — passo "Automações" (e2e/month-automations.spec.ts) numa conta
  // DEDICADA: `TableTemplate.autoApply` é account-wide e faria o passo 2 aparecer
  // em toda criação de mês da conta principal.
  automationsAccountId: string;
  automationsMonthId: string;
  automationsTemplateId: string;
  automationsBrokenTemplateId: string;
  automationsManualGroupId: string;
  automationsManualPendingId: string;
  automationsImportPendingId: string;
};

export function manifest(): SeedManifest {
  const path = join(process.cwd(), "e2e/.auth/seed-manifest.json");
  return JSON.parse(readFileSync(path, "utf8")) as SeedManifest;
}
