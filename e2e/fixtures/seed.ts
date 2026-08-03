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

// Títulos das notificações semeadas (Spec 65 P5). Mantidos como literais estáveis para o
// e2e localizar os itens — se mudar aqui, atualize e2e/notifications-menu.spec.ts.
const NOTIF_LINKED_TITLE = "E2E Editor adicionou 1 transação em Dezembro 2099";
const NOTIF_UNLINKED_TITLE = "E2E Editor entrou na conta como editor";

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

/**
 * Spec 66 P8 — fixtures do modal de detalhe da transação (e2e/transaction-detail.spec.ts):
 * (a) transação simples com nota; (b) duas transações vinculadas por `TransactionLink`;
 * (c) um `InstallmentGroup` com a 1ª parcela já lançada + parcelas pendentes.
 *
 * Mês DEDICADO ISOLADO (2099/11) — não é o `roMonth` (2099/12) usado por outros
 * cenários, para não colidir com forecast/dashboards nem com dados de outros specs.
 * Reusa a seção "Saídas" (já existe via `seedConfig`; seção é config compartilhada,
 * não month-scoped — mesmo padrão do `roMonth`).
 */
async function seedSpec66Fixtures(accountId: string, ownerId: string) {
  const section = await prisma.section.findFirstOrThrow({
    where: { accountId, name: "Saídas" },
    select: { id: true },
  });
  // Seção diferente p/ o alvo do vínculo (mesmo mês isolado) — dá ao "abrir" da aba
  // "Parcelas e vínculos" uma navegação real (?tab= muda), em vez de um push para a
  // URL já aberta.
  const entradasSection = await prisma.section.findFirstOrThrow({
    where: { accountId, name: "Entradas" },
    select: { id: true },
  });

  const spec66Month = await prisma.month.create({
    data: { accountId, year: 2099, month: 11, createdById: ownerId },
    select: { id: true },
  });
  const spec66Table = await prisma.financeTable.create({
    data: {
      accountId,
      monthId: spec66Month.id,
      sectionId: section.id,
      name: "Spec 66",
      createdById: ownerId,
    },
    select: { id: true },
  });
  const spec66TableEntradas = await prisma.financeTable.create({
    data: {
      accountId,
      monthId: spec66Month.id,
      sectionId: entradasSection.id,
      name: "Spec 66 — Entradas",
      createdById: ownerId,
    },
    select: { id: true },
  });

  // (a) Transação simples — sem grupo/links/tags; nota preenchida exercita o bloco
  // read-only da aba "Resumo" (§8). `isFavorite` dá ao cabeçalho um StatusBadge real
  // p/ o e2e checar "StatusBadge, nunca Chip".
  const simpleTx = await prisma.transaction.create({
    data: {
      accountId,
      monthId: spec66Month.id,
      tableId: spec66Table.id,
      sectionId: section.id,
      occurredOn: new Date("2099-11-05"),
      amountCents: 45000n,
      description: "Spec 66 — transação simples",
      notes: "Nota de exemplo para a aba Resumo.",
      isFavorite: true,
      createdById: ownerId,
    },
    select: { id: true },
  });

  // (b) Vínculo — duas transações ligadas por TransactionLink (cenário §8: aba
  // "Parcelas e vínculos" lista o vínculo e a ação "abrir" navega ao alvo, inclusive
  // como viewer). Alvo numa seção diferente (mesmo mês) p/ a navegação ser observável.
  const linkSourceTx = await prisma.transaction.create({
    data: {
      accountId,
      monthId: spec66Month.id,
      tableId: spec66Table.id,
      sectionId: section.id,
      occurredOn: new Date("2099-11-08"),
      amountCents: 20000n,
      description: "Spec 66 — despesa original",
      createdById: ownerId,
    },
    select: { id: true },
  });
  const linkTargetTx = await prisma.transaction.create({
    data: {
      accountId,
      monthId: spec66Month.id,
      tableId: spec66TableEntradas.id,
      sectionId: entradasSection.id,
      occurredOn: new Date("2099-11-09"),
      amountCents: 20000n,
      description: "Spec 66 — reembolso",
      createdById: ownerId,
    },
    select: { id: true },
  });
  await prisma.transactionLink.create({
    data: {
      accountId,
      sourceId: linkSourceTx.id,
      targetId: linkTargetTx.id,
      type: "reimbursed_by",
    },
  });

  // (c) Grupo de parcelamento — 1ª parcela já lançada (transação normal) + parcelas
  // pendentes (cenário §8: badge → painel lateral com rodapé de 3 ações + "Criar
  // neste mês" por item).
  const installmentGroup = await prisma.installmentGroup.create({
    data: {
      accountId,
      description: "Spec 66 — notebook parcelado",
      totalCents: 90000n,
      installmentCount: 3,
      startDate: new Date("2099-11-10"),
      sectionId: section.id,
    },
    select: { id: true },
  });
  const installmentTx = await prisma.transaction.create({
    data: {
      accountId,
      monthId: spec66Month.id,
      tableId: spec66Table.id,
      sectionId: section.id,
      occurredOn: new Date("2099-11-10"),
      amountCents: 30000n,
      description: "Spec 66 — notebook parcelado",
      createdById: ownerId,
      installmentGroupId: installmentGroup.id,
      installmentNumber: 1,
    },
    select: { id: true },
  });
  await prisma.pendingInstallment.createMany({
    data: [
      {
        accountId,
        installmentGroupId: installmentGroup.id,
        installmentNumber: 2,
        amountCents: 30000n,
        // Cai no mês já semeado (2099/12 — `roMonth`) → `getInstallmentGroupPanelData`
        // resolve `existingMonthId` → InstallmentSchedule mostra "Criar neste mês"
        // (chip clicável) para este item.
        expectedDate: new Date("2099-12-10"),
      },
      {
        accountId,
        installmentGroupId: installmentGroup.id,
        installmentNumber: 3,
        amountCents: 30000n,
        // Mês ainda não existe na conta → permanece "Aguardando mês".
        expectedDate: new Date("2100-01-10"),
      },
    ],
  });

  return {
    spec66MonthId: spec66Month.id,
    simpleTxId: simpleTx.id,
    linkSourceTxId: linkSourceTx.id,
    linkTargetTxId: linkTargetTx.id,
    installmentGroupId: installmentGroup.id,
    installmentTxId: installmentTx.id,
  };
}

/**
 * Spec 73 §2.1/§2.3 — fixtures do import de fatura com parcelamento
 * (e2e/installment-import-link.spec.ts). Reproduz o cenário real do bug: um
 * parcelamento de 3x cuja parcela 2 já foi importada na fatura de junho/2098, e a
 * parcela 3 chega na fatura de julho/2098.
 *
 * Meses DEDICADOS (2098/06 e 2098/07) na conta principal — não colidem com os
 * meses criados por `solo-flow` (2098/01) nem por `csv-import` (2098/02), e as
 * `expectedDate` das pendências (2098-05/2098-07) ficam fora desses meses para
 * que a criação de mês daqueles specs continue sem passo de Automações.
 *
 * O grupo nasce `autoCreateOnNewMonth: false` (origem import) e a transação
 * lançada carrega `occurredOn` = data da COMPRA (2098-05-04), repetida pelo
 * extrato em toda parcela — é ela que o casamento por data usa como sinal.
 */
async function seedSpec73Fixtures(accountId: string, ownerId: string) {
  const saidas = await prisma.section.findFirstOrThrow({
    where: { accountId, name: "Saídas" },
    select: { id: true },
  });

  const invoiceMonth = await prisma.month.create({
    data: { accountId, year: 2098, month: 6, createdById: ownerId },
    select: { id: true },
  });
  // Destino do import: existe e está vazio (criado aqui para o teste não depender
  // do dialog de novo mês).
  const importMonth = await prisma.month.create({
    data: { accountId, year: 2098, month: 7, createdById: ownerId },
    select: { id: true },
  });

  const invoiceTable = await prisma.financeTable.create({
    data: {
      accountId,
      monthId: invoiceMonth.id,
      sectionId: saidas.id,
      name: "Fatura junho E2E",
      sourceMethod: "import",
      createdById: ownerId,
    },
    select: { id: true },
  });

  const group = await prisma.installmentGroup.create({
    data: {
      accountId,
      description: "Cyan Shoes E2E",
      totalCents: 47349n, // 3 × 157,83
      installmentCount: 3,
      // Competência da parcela 1 (maio/2098), não a data retroagida da compra.
      startDate: new Date("2098-05-04"),
      sectionId: saidas.id,
      autoCreateOnNewMonth: false,
    },
    select: { id: true },
  });

  await prisma.transaction.create({
    data: {
      accountId,
      monthId: invoiceMonth.id,
      tableId: invoiceTable.id,
      sectionId: saidas.id,
      occurredOn: new Date("2098-05-04"),
      amountCents: 15783n,
      description: "Cyan Shoes E2E",
      source: "csv_import",
      installmentGroupId: group.id,
      installmentNumber: 2,
      createdById: ownerId,
    },
  });

  await prisma.pendingInstallment.createMany({
    data: [
      {
        accountId,
        installmentGroupId: group.id,
        installmentNumber: 1,
        amountCents: 15783n,
        // Competência maio/2098 — mês não existe na conta.
        expectedDate: new Date("2098-05-04"),
        description: "Cyan Shoes E2E",
      },
      {
        accountId,
        installmentGroupId: group.id,
        installmentNumber: 3,
        amountCents: 15783n,
        // Competência julho/2098 — é esta que o import deve consumir.
        expectedDate: new Date("2098-07-04"),
        description: "Cyan Shoes E2E",
      },
    ],
  });

  return {
    spec73InvoiceMonthId: invoiceMonth.id,
    spec73ImportMonthId: importMonth.id,
    spec73GroupId: group.id,
  };
}

/**
 * Spec 73 §2.4 — conta DEDICADA para o passo "Automações"
 * (e2e/month-automations.spec.ts).
 *
 * Precisa ser uma conta separada: `TableTemplate.autoApply` é account-wide, então
 * semear um modelo automático na conta principal faria o passo 2 aparecer em TODA
 * criação de mês — quebrando `solo-flow` e `csv-import`, que clicam "Criar" e
 * esperam o dialog fechar.
 *
 * Conteúdo: 1 modelo bem configurado (2 itens) · 1 modelo sem seção (item
 * bloqueado com motivo) · 1 parcela de grupo manual (pré-marcada) · 1 parcela de
 * grupo de import (desmarcada). Todas as pendências caem em 2098/09, o mês que o
 * teste cria pela UI.
 */
async function seedSpec73AutomationsAccount(ownerId: string) {
  const account = await prisma.account.create({
    data: {
      name: "E2E Automations",
      createdById: ownerId,
      settings: {
        create: {
          currency: "BRL",
          monthStartDay: 1,
          onboardingCompletedAt: new Date("2026-01-01"),
        },
      },
      members: { create: [{ userId: ownerId, role: "owner" }] },
    },
    select: { id: true },
  });
  await seedConfig(account.id, ownerId);

  const [saidas, manualType] = await Promise.all([
    prisma.section.findFirstOrThrow({
      where: { accountId: account.id, name: "Saídas" },
      select: { id: true },
    }),
    prisma.tableType.findFirstOrThrow({
      where: { accountId: account.id, name: "Manual" },
      select: { id: true },
    }),
  ]);

  // Mês de aterrissagem: a página de mês é onde vive o botão "Novo mês".
  const landingMonth = await prisma.month.create({
    data: { accountId: account.id, year: 2098, month: 8, createdById: ownerId },
    select: { id: true },
  });

  const template = await prisma.tableTemplate.create({
    data: {
      accountId: account.id,
      name: "Contas fixas E2E",
      autoApply: true,
      autoSectionId: saidas.id,
      autoTableTypeId: manualType.id,
      countInMonth: true,
      createdById: ownerId,
      items: {
        create: [
          {
            accountId: account.id,
            day: 5,
            amountCents: 100000n,
            description: "Aluguel E2E",
            displayOrder: 0,
          },
          {
            accountId: account.id,
            day: 10,
            amountCents: 20000n,
            description: "Internet E2E",
            displayOrder: 1,
          },
        ],
      },
    },
    select: { id: true },
  });

  // autoApply ligado mas sem seção destino → passo 2 mostra desmarcado + motivo,
  // em vez de falhar silenciosamente no snackbar depois de criar o mês.
  const brokenTemplate = await prisma.tableTemplate.create({
    data: {
      accountId: account.id,
      name: "Modelo quebrado E2E",
      autoApply: true,
      autoSectionId: null,
      autoTableTypeId: manualType.id,
      createdById: ownerId,
    },
    select: { id: true },
  });

  const manualGroup = await prisma.installmentGroup.create({
    data: {
      accountId: account.id,
      description: "Curso manual E2E",
      totalCents: 60000n,
      installmentCount: 3,
      startDate: new Date("2098-08-15"),
      sectionId: saidas.id,
      tableTypeId: manualType.id,
      autoCreateOnNewMonth: true,
    },
    select: { id: true },
  });
  const manualPending = await prisma.pendingInstallment.create({
    data: {
      accountId: account.id,
      installmentGroupId: manualGroup.id,
      installmentNumber: 2,
      amountCents: 20000n,
      expectedDate: new Date("2098-09-15"),
      description: "Curso manual E2E",
    },
    select: { id: true },
  });

  const importGroup = await prisma.installmentGroup.create({
    data: {
      accountId: account.id,
      description: "Fatura import E2E",
      totalCents: 45000n,
      installmentCount: 3,
      startDate: new Date("2098-08-20"),
      sectionId: saidas.id,
      tableTypeId: manualType.id,
      autoCreateOnNewMonth: false,
    },
    select: { id: true },
  });
  const importPending = await prisma.pendingInstallment.create({
    data: {
      accountId: account.id,
      installmentGroupId: importGroup.id,
      installmentNumber: 2,
      amountCents: 15000n,
      expectedDate: new Date("2098-09-20"),
      description: "Fatura import E2E",
    },
    select: { id: true },
  });

  return {
    automationsAccountId: account.id,
    automationsMonthId: landingMonth.id,
    automationsTemplateId: template.id,
    automationsBrokenTemplateId: brokenTemplate.id,
    automationsManualGroupId: manualGroup.id,
    automationsManualPendingId: manualPending.id,
    automationsImportPendingId: importPending.id,
  };
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
      settings: {
        create: {
          currency: "BRL",
          monthStartDay: 1,
          onboardingCompletedAt: new Date("2026-01-01"),
        },
      },
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
      settings: {
        create: {
          currency: "BRL",
          monthStartDay: 1,
          onboardingCompletedAt: new Date("2026-01-01"),
        },
      },
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
      settings: {
        create: {
          currency: "BRL",
          monthStartDay: 1,
          onboardingCompletedAt: new Date("2026-01-01"),
        },
      },
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

  // Fixtures do modal de detalhe (Spec 66 P8) — mês dedicado isolado 2099/11.
  const spec66 = await seedSpec66Fixtures(main.id, owner.id);

  // Fixtures da Spec 73 — import de fatura com parcelamento (meses 2098/06 e 2098/07
  // na conta principal) e conta dedicada para o passo "Automações".
  const spec73 = await seedSpec73Fixtures(main.id, owner.id);
  const automations = await seedSpec73AutomationsAccount(owner.id);

  // Notificações não lidas p/ o cenário NAV-02b (Spec 65 P5): sem elas os e2e de
  // badge/lista/navegação não têm dados. Destinatário = owner (tem storageState),
  // ator = editor. Uma COM link (link É o monthId → navega p/ /months/{roMonth})
  // e uma SEM link (invite_accepted). `isRead:false` alimenta getUnreadCount=2.
  await prisma.notification.createMany({
    data: [
      {
        userId: owner.id,
        accountId: main.id,
        actorId: editor.id,
        type: "transactions_added",
        title: NOTIF_LINKED_TITLE,
        link: roMonth.id,
        count: 1,
        isRead: false,
      },
      {
        userId: owner.id,
        accountId: main.id,
        actorId: editor.id,
        type: "invite_accepted",
        title: NOTIF_UNLINKED_TITLE,
        link: null,
        count: 1,
        isRead: false,
      },
    ],
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
    spec66MonthId: spec66.spec66MonthId,
    simpleTxId: spec66.simpleTxId,
    linkSourceTxId: spec66.linkSourceTxId,
    linkTargetTxId: spec66.linkTargetTxId,
    installmentGroupId: spec66.installmentGroupId,
    installmentTxId: spec66.installmentTxId,
    ...spec73,
    ...automations,
  };
  mkdirSync(join(process.cwd(), "e2e/.auth"), { recursive: true });
  writeFileSync(
    join(process.cwd(), "e2e/.auth/seed-manifest.json"),
    JSON.stringify(manifest, null, 2),
  );
  console.log("E2E seed OK:", manifest.mainAccountId);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
