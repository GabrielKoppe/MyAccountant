// e2e/fixtures/seed.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { assertSafeSeedTarget } from "../../prisma/seed-guard";

const prisma = new PrismaClient();
const PASSWORD = "E2ePass123";

const BASE_SECTIONS = [
  { name: "Entradas", countType: "add" as const, order: 0 },
  { name: "Saídas", countType: "subtract" as const, order: 1 },
  { name: "Investimentos", countType: "neutral" as const, order: 2 },
];
const BASE_TABLE_TYPES = [
  { name: "Manual", isDefault: true, hiddenColumns: {} },
  { name: "Cartão de crédito", isDefault: false, hiddenColumns: { investmentType: true } },
];
const BASE_CATEGORIES = [
  { name: "Alimentação", subs: ["Mercado", "Restaurante"] },
  { name: "Transporte", subs: ["Combustível", "Uber/Táxi"] },
];
const BASE_INSTITUTIONS = ["Banco A", "Banco B"];

async function reset() {
  // Reset via cascade: account.deleteMany() apaga (onDelete: Cascade) todo dado account-scoped
  // (sections, months, finance_tables, transactions, categories, subcategories, institutions,
  // budgets, installment_groups, pending_installments, balance_accounts, balance_snapshots,
  // account_settings, account_members, account_invites, etc. — ver schema.prisma).
  // Verificado no schema: nenhuma FK aponta para Account com onDelete: Restrict, e toda FK
  // onDelete: Restrict (para User ou Section) está numa tabela que é ela própria account-scoped
  // e já é cascade-deletada junto com o account (Postgres checa constraints não-deferráveis ao
  // fim do statement, então o cascade inteiro resolve antes da checagem de Restrict).
  await prisma.account.deleteMany();
  // Neste ponto nenhuma linha aponta para User com onDelete: Restrict (todas eram account-scoped
  // e já foram cascade-deletadas acima) — user.deleteMany() cascade limpa sessions/oauth/user_settings.
  await prisma.user.deleteMany();
}

async function createUser(email: string, name: string) {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  return prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      settings: { create: { theme: "system", locale: "pt-BR", timezone: "America/Sao_Paulo" } },
    },
    select: { id: true },
  });
}

async function seedConfig(accountId: string, ownerId: string) {
  await prisma.section.createMany({ data: BASE_SECTIONS.map((s) => ({ ...s, accountId })) });
  await prisma.tableType.createMany({ data: BASE_TABLE_TYPES.map((t) => ({ ...t, accountId })) });
  for (const name of BASE_INSTITUTIONS) {
    await prisma.institution.create({ data: { accountId, name, createdById: ownerId } });
  }
  for (const { name, subs } of BASE_CATEGORIES) {
    const cat = await prisma.category.create({ data: { accountId, name, createdById: ownerId } });
    await prisma.subcategory.createMany({
      data: subs.map((n) => ({ accountId, categoryId: cat.id, name: n })),
    });
  }
  // Responsável (Spec 60): a dimensão "member" do Budget virou "Responsável" e suas opções
  // vêm de `responsibleParty` (partyDisplayMap), NÃO dos account members. O seed cria os
  // membros via Prisma direto (sem passar pelo service que auto-cria as personal parties),
  // então sem esta linha a combobox "Responsável" ficaria vazia e não haveria o que
  // selecionar em planning-dimensions.spec.ts. `external` usa o próprio `name` como
  // display (sem resolução por User), garantindo um rótulo determinístico p/ o teste.
  await prisma.responsibleParty.create({
    data: { accountId, name: "Responsável E2E", kind: "external" },
  });
}

async function main() {
  assertSafeSeedTarget({ requireDbSuffix: "_e2e", label: "e2e (myaccountant_e2e)" });

  await reset();

  const owner = await createUser("owner@e2e.test", "E2E Owner");
  const editor = await createUser("editor@e2e.test", "E2E Editor");
  const viewer = await createUser("viewer@e2e.test", "E2E Viewer");
  const invitee = await createUser("invitee@e2e.test", "E2E Invitee");

  const main = await prisma.account.create({
    data: {
      name: "E2E Main",
      createdById: owner.id,
      settings: { create: { currency: "BRL", monthStartDay: 1, onboardingCompletedAt: new Date("2026-01-01") } },
      members: {
        create: [
          { userId: owner.id, role: "owner" },
          { userId: editor.id, role: "editor" },
          { userId: viewer.id, role: "viewer" },
        ],
      },
    },
    select: { id: true },
  });
  await seedConfig(main.id, owner.id);

  const invite = await prisma.account.create({
    data: {
      name: "E2E Invite",
      createdById: owner.id,
      settings: { create: { currency: "BRL", monthStartDay: 1, onboardingCompletedAt: new Date("2026-01-01") } },
      members: { create: [{ userId: owner.id, role: "owner" }] },
    },
    select: { id: true },
  });
  await seedConfig(invite.id, owner.id);

  // Conta-home do convidado: sem ela, o login do invitee (que não é membro de nenhuma
  // outra conta) não resolve uma conta no pós-login e trava em /login.
  const inviteeHome = await prisma.account.create({
    data: {
      name: "E2E Invitee Home",
      createdById: invitee.id,
      settings: { create: { currency: "BRL", monthStartDay: 1, onboardingCompletedAt: new Date("2026-01-01") } },
      members: { create: [{ userId: invitee.id, role: "owner" }] },
    },
    select: { id: true },
  });
  await seedConfig(inviteeHome.id, invitee.id);

  // Fixture read-only p/ o cenário viewer (viewer não pode criar dados):
  // mês 2099/12 na conta principal, com 1 tabela e 1 transação na seção "Saídas".
  const saidas = await prisma.section.findFirstOrThrow({
    where: { accountId: main.id, name: "Saídas" },
    select: { id: true },
  });
  const roMonth = await prisma.month.create({
    data: { accountId: main.id, year: 2099, month: 12, createdById: owner.id },
    select: { id: true },
  });
  const roTable = await prisma.financeTable.create({
    data: {
      accountId: main.id,
      monthId: roMonth.id,
      sectionId: saidas.id,
      name: "Contas fixas",
      createdById: owner.id,
    },
    select: { id: true },
  });
  await prisma.transaction.create({
    data: {
      accountId: main.id,
      monthId: roMonth.id,
      tableId: roTable.id,
      sectionId: saidas.id,
      occurredOn: new Date("2099-12-05"),
      amountCents: 12345n,
      description: "Aluguel",
      createdById: owner.id,
    },
  });

  const manifest = {
    users: {
      owner: "owner@e2e.test",
      editor: "editor@e2e.test",
      viewer: "viewer@e2e.test",
      invitee: "invitee@e2e.test",
    },
    mainAccountId: main.id,
    inviteAccountId: invite.id,
    roMonthId: roMonth.id,
    roSectionId: saidas.id,
  };
  mkdirSync(join(process.cwd(), "e2e/.auth"), { recursive: true });
  writeFileSync(join(process.cwd(), "e2e/.auth/seed-manifest.json"), JSON.stringify(manifest, null, 2));
  console.log("E2E seed OK:", manifest.mainAccountId);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
