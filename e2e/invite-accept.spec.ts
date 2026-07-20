// e2e/invite-accept.spec.ts
import { test, expect } from "@playwright/test";
import { manifest } from "./fixtures/manifest";
import { loginAs } from "./fixtures/login";
import { db } from "./fixtures/db";

test.afterAll(async () => {
  await db.$disconnect();
});

test("owner convida e o convidado aceita, virando membro", async ({ browser }) => {
  const m = manifest();
  const inviteeEmail = m.users.invitee;

  // Idempotência (reruns sem reseed): remove membership/convite pré-existentes do convidado.
  const inviteeUser = await db.user.findUniqueOrThrow({
    where: { email: inviteeEmail },
    select: { id: true },
  });
  await db.accountMember.deleteMany({
    where: { accountId: m.inviteAccountId, userId: inviteeUser.id },
  });
  await db.accountInvite.deleteMany({
    where: { accountId: m.inviteAccountId, email: inviteeEmail },
  });

  // 1. Owner cria o convite pela UI (conta isolada do convite).
  const ownerCtx = await browser.newContext({ storageState: "e2e/.auth/owner.json" });
  const ownerPage = await ownerCtx.newPage();
  await ownerPage.goto(`/${m.inviteAccountId}/settings/members`);
  await ownerPage.getByRole("button", { name: "Convidar membro" }).click();
  const dialog = ownerPage.getByRole("dialog");
  await dialog.getByLabel("Email do convidado").fill(inviteeEmail);
  await dialog.getByLabel("Papel").click();
  await ownerPage.getByRole("option", { name: "Editor" }).click();
  await dialog.getByRole("button", { name: "Enviar convite" }).click();
  await expect(dialog).toBeHidden();
  await ownerCtx.close();

  // 2. Ler o convite pendente direto no DB de teste (DD-08 — email é no-op).
  const invite = await db.accountInvite.findFirstOrThrow({
    where: { accountId: m.inviteAccountId, email: inviteeEmail, status: "pending" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  // 3. Convidado faz login inline (contexto próprio, sem storageState) e aceita via ?inviteId=.
  const inviteeCtx = await browser.newContext();
  const inviteePage = await inviteeCtx.newPage();
  await loginAs(inviteePage, inviteeCtx, inviteeEmail);

  await inviteePage.goto(`/invite/accept?inviteId=${invite.id}`);
  await inviteePage.getByRole("button", { name: "Aceitar e entrar" }).click();

  // 4. Verificar membership criada. O aceite pode mostrar sucesso sem sair de /invite;
  // a prova da aceitação é a membership persistida (poll no DB de teste — DD-08).
  await expect
    .poll(
      async () => {
        const mem = await db.accountMember.findUnique({
          where: { accountId_userId: { accountId: m.inviteAccountId, userId: inviteeUser.id } },
        });
        return mem?.role ?? null;
      },
      { timeout: 15_000 },
    )
    .toBe("editor");
  await inviteeCtx.close();
});
