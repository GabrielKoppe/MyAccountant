import { randomUUID } from "node:crypto";

import type { Prisma } from "@prisma/client";

import type { AccountSnapshot, AccountSnapshotData } from "@/lib/schemas/account-backup";
import { AppError, NotFoundError } from "@/server/api/errors";
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";
import {
  remapCsvMapping,
  remapTransactionMetadata,
  remapWidgetConfig,
  type IdMaps,
} from "@/server/services/account-backup-remap";
import { createBareAccount } from "@/server/services/account-service";

// Service de backup de Account (spec 64).
//
// Fase 1: buildAccountSnapshot — export.
// Fase 2b (implementada aqui): planImport (puro) + importSnapshot (executor tx) — import + deep-remap.

const log = logger.child({ module: "account-backup-service" });

// ─── Serialização (spec 64 §7) ──────────────────────────────────────
// BigInt -> string · Decimal -> string · @db.Date -> "YYYY-MM-DD" ·
// demais DateTime -> ISO string. Nunca emitir BigInt cru no JSON.

// `AccountSnapshot` (Fase 0) usa `z.coerce.bigint()` para dinheiro: o tipo
// estático do zod para esses campos é `bigint` tanto no input quanto no
// output (limitação de schemas `coerce` — não há par input=string/output=bigint
// como em `z.string().transform(...)`). Esse tipo serve para o lado de
// *decode* (import, Fase 2), depois do `.parse()`.
//
// O que `buildAccountSnapshot` produz aqui é a forma "wire" — o objeto que
// vai para `JSON.stringify` (BigInt não serializa nativo). `Moneyed` reflete
// essa forma substituindo `bigint`/`bigint | null` por `string`/`string | null`
// campo a campo, mantendo os demais campos (já `string`/`unknown` no schema)
// inalterados — não precisa duplicar a lista de campos por modelo.
type Moneyed<T> = {
  [K in keyof T]: T[K] extends bigint
    ? string
    : T[K] extends bigint | null
      ? string | null
      : T[K];
};

type AccountSnapshotJsonData = {
  [K in keyof AccountSnapshotData]: Moneyed<AccountSnapshotData[K][number]>[];
};

export type AccountSnapshotJson = Omit<AccountSnapshot, "data"> & {
  data: AccountSnapshotJsonData;
};

function ts(date: Date): string {
  return date.toISOString();
}

function tsNullable(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function money(value: bigint): string {
  return value.toString();
}

function moneyNullable(value: bigint | null): string | null {
  return value === null ? null : value.toString();
}

function decimalNullable(value: { toString(): string } | null): string | null {
  return value === null ? null : value.toString();
}

/**
 * Monta o snapshot completo de uma Account (spec 64 §2.1/§4 — export, BKP-01).
 *
 * Lê os 26 modelos account-scoped (todos filtrados por `accountId` — multi-
 * tenancy, nunca vaza dados de outra account) + nome da conta + AccountSettings.
 *
 * Modelos excluídos (spec 64 §2.1): Account/AccountMember/AccountInvite,
 * User/UserSettings, OAuth/Session/VerificationToken, MCP*, PasswordResetToken,
 * Notification, AuditLog.
 *
 * `ResponsiblePartyMember`, `TransactionTag` e `TransactionAliasTag` não têm
 * coluna `accountId` própria (tabelas de junção) — o filtro de tenant é feito
 * via relação (`party.accountId` / `transaction.accountId` / `alias.accountId`).
 */
export async function buildAccountSnapshot(accountId: string): Promise<AccountSnapshotJson> {
  const [
    account,
    settings,
    responsibleParties,
    responsiblePartyMembers,
    tableTypes,
    sections,
    categories,
    subcategories,
    institutions,
    tags,
    csvTemplates,
    months,
    tableTemplates,
    tableTemplateItems,
    installmentGroups,
    pendingInstallments,
    financeTables,
    transactions,
    transactionTags,
    transactionLinks,
    transactionAliases,
    transactionAliasTags,
    budgets,
    dashboardLayouts,
    checklistItems,
    checklistCompletions,
    balanceAccounts,
    balanceSnapshots,
  ] = await Promise.all([
    prisma.account.findUnique({ where: { id: accountId }, select: { name: true } }),
    prisma.accountSettings.findUnique({ where: { accountId } }),
    prisma.responsibleParty.findMany({ where: { accountId } }),
    prisma.responsiblePartyMember.findMany({ where: { party: { accountId } } }),
    prisma.tableType.findMany({ where: { accountId } }),
    prisma.section.findMany({ where: { accountId } }),
    prisma.category.findMany({ where: { accountId } }),
    prisma.subcategory.findMany({ where: { accountId } }),
    prisma.institution.findMany({ where: { accountId } }),
    prisma.tag.findMany({ where: { accountId } }),
    prisma.csvTemplate.findMany({ where: { accountId } }),
    prisma.month.findMany({ where: { accountId } }),
    prisma.tableTemplate.findMany({ where: { accountId } }),
    prisma.tableTemplateItem.findMany({ where: { accountId } }),
    prisma.installmentGroup.findMany({ where: { accountId } }),
    prisma.pendingInstallment.findMany({ where: { accountId } }),
    prisma.financeTable.findMany({ where: { accountId } }),
    prisma.transaction.findMany({ where: { accountId } }),
    prisma.transactionTag.findMany({ where: { transaction: { accountId } } }),
    prisma.transactionLink.findMany({ where: { accountId } }),
    prisma.transactionAlias.findMany({ where: { accountId } }),
    prisma.transactionAliasTag.findMany({ where: { alias: { accountId } } }),
    prisma.budget.findMany({ where: { accountId } }),
    prisma.dashboardLayout.findMany({ where: { accountId } }),
    prisma.checklistItem.findMany({ where: { accountId } }),
    prisma.checklistCompletion.findMany({ where: { accountId } }),
    prisma.balanceAccount.findMany({ where: { accountId } }),
    prisma.balanceSnapshot.findMany({ where: { accountId } }),
  ]);

  if (!account) throw new NotFoundError("Account", accountId);
  if (!settings) throw new NotFoundError("AccountSettings", accountId);

  return {
    formatVersion: 1,
    app: "myaccountant",
    exportedAt: new Date().toISOString(),
    account: {
      name: account.name,
      settings: {
        currency: settings.currency,
        monthStartDay: settings.monthStartDay,
        invertSignOnMoveByDefault: settings.invertSignOnMoveByDefault,
        onboardingCompletedAt: tsNullable(settings.onboardingCompletedAt),
        defaultResponsiblePartyId: settings.defaultResponsiblePartyId,
      },
    },
    data: {
      responsibleParties: responsibleParties.map((r) => ({
        id: r.id,
        accountId: r.accountId,
        name: r.name,
        kind: r.kind,
        icon: r.icon,
        color: r.color,
        archivedAt: tsNullable(r.archivedAt),
        createdAt: ts(r.createdAt),
        updatedAt: ts(r.updatedAt),
      })),
      responsiblePartyMembers: responsiblePartyMembers.map((m) => ({
        partyId: m.partyId,
        userId: m.userId,
      })),
      tableTypes: tableTypes.map((t) => ({
        id: t.id,
        accountId: t.accountId,
        name: t.name,
        isDefault: t.isDefault,
        hiddenColumns: t.hiddenColumns,
        createdAt: ts(t.createdAt),
      })),
      sections: sections.map((s) => ({
        id: s.id,
        accountId: s.accountId,
        name: s.name,
        countType: s.countType,
        order: s.order,
        isActive: s.isActive,
        createdAt: ts(s.createdAt),
      })),
      categories: categories.map((c) => ({
        id: c.id,
        accountId: c.accountId,
        name: c.name,
        createdById: c.createdById,
        createdAt: ts(c.createdAt),
      })),
      subcategories: subcategories.map((s) => ({
        id: s.id,
        categoryId: s.categoryId,
        accountId: s.accountId,
        name: s.name,
        createdAt: ts(s.createdAt),
      })),
      institutions: institutions.map((i) => ({
        id: i.id,
        accountId: i.accountId,
        name: i.name,
        createdById: i.createdById,
        createdAt: ts(i.createdAt),
      })),
      tags: tags.map((t) => ({
        id: t.id,
        accountId: t.accountId,
        name: t.name,
        color: t.color,
        createdAt: ts(t.createdAt),
      })),
      csvTemplates: csvTemplates.map((c) => ({
        id: c.id,
        accountId: c.accountId,
        name: c.name,
        mapping: c.mapping,
        createdById: c.createdById,
        createdAt: ts(c.createdAt),
      })),
      months: months.map((mo) => ({
        id: mo.id,
        accountId: mo.accountId,
        year: mo.year,
        month: mo.month,
        createdById: mo.createdById,
        createdAt: ts(mo.createdAt),
      })),
      tableTemplates: tableTemplates.map((t) => ({
        id: t.id,
        accountId: t.accountId,
        name: t.name,
        description: t.description,
        tableTypeId: t.tableTypeId,
        countInMonth: t.countInMonth,
        autoApply: t.autoApply,
        autoSectionId: t.autoSectionId,
        autoTableTypeId: t.autoTableTypeId,
        createdById: t.createdById,
        createdAt: ts(t.createdAt),
        updatedAt: ts(t.updatedAt),
      })),
      tableTemplateItems: tableTemplateItems.map((i) => ({
        id: i.id,
        templateId: i.templateId,
        accountId: i.accountId,
        day: i.day,
        amountCents: money(i.amountCents),
        description: i.description,
        notes: i.notes,
        isPending: i.isPending,
        categoryId: i.categoryId,
        subcategoryId: i.subcategoryId,
        institutionId: i.institutionId,
        responsiblePartyId: i.responsiblePartyId,
        cardInstallment: i.cardInstallment,
        investmentType: i.investmentType,
        expenseType: i.expenseType,
        displayOrder: i.displayOrder,
        createdAt: ts(i.createdAt),
      })),
      installmentGroups: installmentGroups.map((g) => ({
        id: g.id,
        accountId: g.accountId,
        description: g.description,
        totalCents: money(g.totalCents),
        installmentCount: g.installmentCount,
        downPaymentCents: moneyNullable(g.downPaymentCents),
        startDate: dateOnly(g.startDate),
        sectionId: g.sectionId,
        tableTypeId: g.tableTypeId,
        createdAt: ts(g.createdAt),
      })),
      pendingInstallments: pendingInstallments.map((p) => ({
        id: p.id,
        accountId: p.accountId,
        installmentGroupId: p.installmentGroupId,
        installmentNumber: p.installmentNumber,
        amountCents: money(p.amountCents),
        expectedDate: dateOnly(p.expectedDate),
        description: p.description,
        categoryId: p.categoryId,
        subcategoryId: p.subcategoryId,
        notes: p.notes,
        createdAt: ts(p.createdAt),
      })),
      financeTables: financeTables.map((f) => ({
        id: f.id,
        accountId: f.accountId,
        monthId: f.monthId,
        sectionId: f.sectionId,
        tableTypeId: f.tableTypeId,
        name: f.name,
        countInMonth: f.countInMonth,
        groupByDate: f.groupByDate,
        sourceMethod: f.sourceMethod,
        sourceTableId: f.sourceTableId,
        displayOrder: f.displayOrder,
        createdById: f.createdById,
        createdAt: ts(f.createdAt),
        updatedById: f.updatedById,
        updatedAt: ts(f.updatedAt),
      })),
      transactions: transactions.map((t) => ({
        id: t.id,
        accountId: t.accountId,
        monthId: t.monthId,
        tableId: t.tableId,
        sectionId: t.sectionId,
        occurredOn: dateOnly(t.occurredOn),
        amountCents: money(t.amountCents),
        description: t.description,
        notes: t.notes,
        isPending: t.isPending,
        isFavorite: t.isFavorite,
        categoryId: t.categoryId,
        subcategoryId: t.subcategoryId,
        institutionId: t.institutionId,
        institutionText: t.institutionText,
        responsiblePartyId: t.responsiblePartyId,
        cardInstallment: t.cardInstallment,
        investmentType: t.investmentType,
        expenseType: t.expenseType,
        paymentMethod: t.paymentMethod,
        source: t.source,
        installmentGroupId: t.installmentGroupId,
        installmentNumber: t.installmentNumber,
        originalAmountCents: moneyNullable(t.originalAmountCents),
        originalCurrency: t.originalCurrency,
        exchangeRate: decimalNullable(t.exchangeRate),
        metadata: t.metadata,
        createdById: t.createdById,
        createdAt: ts(t.createdAt),
        updatedById: t.updatedById,
        updatedAt: ts(t.updatedAt),
      })),
      transactionTags: transactionTags.map((t) => ({
        transactionId: t.transactionId,
        tagId: t.tagId,
      })),
      transactionLinks: transactionLinks.map((l) => ({
        id: l.id,
        accountId: l.accountId,
        sourceId: l.sourceId,
        targetId: l.targetId,
        type: l.type,
        notes: l.notes,
        createdAt: ts(l.createdAt),
      })),
      transactionAliases: transactionAliases.map((a) => ({
        id: a.id,
        accountId: a.accountId,
        trigger: a.trigger,
        triggerNormalized: a.triggerNormalized,
        description: a.description,
        notes: a.notes,
        amountCents: moneyNullable(a.amountCents),
        categoryId: a.categoryId,
        subcategoryId: a.subcategoryId,
        institutionId: a.institutionId,
        institutionText: a.institutionText,
        responsiblePartyId: a.responsiblePartyId,
        expenseType: a.expenseType,
        paymentMethod: a.paymentMethod,
        investmentType: a.investmentType,
        cardInstallment: a.cardInstallment,
        isPending: a.isPending,
        isFavorite: a.isFavorite,
        originalCurrency: a.originalCurrency,
        originalAmountCents: moneyNullable(a.originalAmountCents),
        exchangeRate: decimalNullable(a.exchangeRate),
        archivedAt: tsNullable(a.archivedAt),
        createdById: a.createdById,
        createdAt: ts(a.createdAt),
        updatedAt: ts(a.updatedAt),
      })),
      transactionAliasTags: transactionAliasTags.map((t) => ({
        aliasId: t.aliasId,
        tagId: t.tagId,
      })),
      budgets: budgets.map((b) => ({
        id: b.id,
        accountId: b.accountId,
        name: b.name,
        sectionId: b.sectionId,
        categoryId: b.categoryId,
        memberUserId: b.memberUserId,
        institutionId: b.institutionId,
        tableTypeId: b.tableTypeId,
        amountCents: money(b.amountCents),
        alertThresholdPercent: b.alertThresholdPercent,
        isRecurring: b.isRecurring,
        showInSummary: b.showInSummary,
        year: b.year,
        month: b.month,
        createdAt: ts(b.createdAt),
        updatedAt: ts(b.updatedAt),
      })),
      dashboardLayouts: dashboardLayouts.map((d) => ({
        id: d.id,
        accountId: d.accountId,
        context: d.context,
        widgets: d.widgets,
        createdAt: ts(d.createdAt),
        updatedAt: ts(d.updatedAt),
      })),
      checklistItems: checklistItems.map((c) => ({
        id: c.id,
        accountId: c.accountId,
        label: c.label,
        position: c.position,
        createdById: c.createdById,
        createdAt: ts(c.createdAt),
        updatedAt: ts(c.updatedAt),
      })),
      checklistCompletions: checklistCompletions.map((c) => ({
        id: c.id,
        accountId: c.accountId,
        itemId: c.itemId,
        monthId: c.monthId,
        completedById: c.completedById,
        transactionId: c.transactionId,
        createdAt: ts(c.createdAt),
      })),
      balanceAccounts: balanceAccounts.map((b) => ({
        id: b.id,
        accountId: b.accountId,
        kind: b.kind,
        name: b.name,
        institutionId: b.institutionId,
        archivedAt: tsNullable(b.archivedAt),
        createdById: b.createdById,
        createdAt: ts(b.createdAt),
        updatedAt: ts(b.updatedAt),
      })),
      balanceSnapshots: balanceSnapshots.map((b) => ({
        id: b.id,
        accountId: b.accountId,
        balanceAccountId: b.balanceAccountId,
        balanceCents: money(b.balanceCents),
        capturedOn: dateOnly(b.capturedOn),
        createdById: b.createdById,
        createdAt: ts(b.createdAt),
      })),
    },
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// IMPORT (spec 64 §2.2 / §4 BKP-02 / §6 DD-05/06/10/11/12/13/14/16 / §7)
//
// Estrutura: um PLANNER puro (`planImport`) — testável sem DB — + um EXECUTOR fino
// (`importSnapshot`) que roda o plano numa única `prisma.$transaction` (atômico, DD-05).
// ═════════════════════════════════════════════════════════════════════════════

// ─── Geração de novos IDs (DD-06) ────────────────────────────────────────────
// Cada linha de todo modelo recebe um ID NOVO antes do insert, para que as FKs
// possam ser remapeadas de `oldId -> newId`. Escolha do gerador: nem
// `@paralleldrive/cuid2` nem `cuid` são dependências (verificado no package.json),
// então usamos `crypto.randomUUID()`. O formato do ID não importa para as FKs
// (todas as colunas de id são `String`); só precisa ser único e estável dentro
// de um mesmo `planImport`.
const newId = (): string => randomUUID();

type ModelKey = keyof AccountSnapshotData;
type Tx = Prisma.TransactionClient;

/** Payloads de insert prontos (forma `createMany`) por modelo, na ordem topológica. */
type Inserts = {
  responsibleParties: Prisma.ResponsiblePartyCreateManyInput[];
  responsiblePartyMembers: Prisma.ResponsiblePartyMemberCreateManyInput[];
  tableTypes: Prisma.TableTypeCreateManyInput[];
  sections: Prisma.SectionCreateManyInput[];
  categories: Prisma.CategoryCreateManyInput[];
  subcategories: Prisma.SubcategoryCreateManyInput[];
  institutions: Prisma.InstitutionCreateManyInput[];
  tags: Prisma.TagCreateManyInput[];
  csvTemplates: Prisma.CsvTemplateCreateManyInput[];
  months: Prisma.MonthCreateManyInput[];
  tableTemplates: Prisma.TableTemplateCreateManyInput[];
  tableTemplateItems: Prisma.TableTemplateItemCreateManyInput[];
  installmentGroups: Prisma.InstallmentGroupCreateManyInput[];
  pendingInstallments: Prisma.PendingInstallmentCreateManyInput[];
  financeTables: Prisma.FinanceTableCreateManyInput[];
  transactions: Prisma.TransactionCreateManyInput[];
  transactionTags: Prisma.TransactionTagCreateManyInput[];
  transactionLinks: Prisma.TransactionLinkCreateManyInput[];
  transactionAliases: Prisma.TransactionAliasCreateManyInput[];
  transactionAliasTags: Prisma.TransactionAliasTagCreateManyInput[];
  budgets: Prisma.BudgetCreateManyInput[];
  dashboardLayouts: Prisma.DashboardLayoutCreateManyInput[];
  checklistItems: Prisma.ChecklistItemCreateManyInput[];
  checklistCompletions: Prisma.ChecklistCompletionCreateManyInput[];
  balanceAccounts: Prisma.BalanceAccountCreateManyInput[];
  balanceSnapshots: Prisma.BalanceSnapshotCreateManyInput[];
};

export type ImportPlan = {
  /** oldId -> newId por modelo (só modelos com coluna `id`; join tables ficam vazios). */
  idMap: Record<ModelKey, Map<string, string>>;
  /** Linhas prontas para `createMany`, por modelo. */
  inserts: Inserts;
  /** 2ª passada da self-relation `FinanceTable.sourceTableId` (§7 item 3). */
  secondPass: { id: string; sourceTableId: string }[];
  /** Restauração de nome + AccountSettings da conta (DD-12), já remapeada. */
  accountUpdate: {
    name: string;
    settings: {
      currency: string;
      monthStartDay: number;
      invertSignOnMoveByDefault: boolean;
      onboardingCompletedAt: Date | null;
      defaultResponsiblePartyId: string | null;
    };
  };
};

// ─── Descritor de modelo (fonte única insert + delete, DD-14) ────────────────
// Uma única lista ordenada topologicamente (§7) dirige o insert (nesta ordem) e o
// delete do modo `overwrite` (ordem REVERSA). Cada descritor fecha sobre o delegate
// Prisma correto, garantindo que insert e delete nunca fiquem fora de sincronia.
type ModelDescriptor = {
  key: ModelKey;
  createMany: (tx: Tx, rows: readonly unknown[]) => Promise<{ count: number }>;
  deleteMany: (tx: Tx, accountId: string) => Promise<unknown>;
};

const MODEL_ORDER: ModelDescriptor[] = [
  {
    key: "responsibleParties",
    createMany: (tx, rows) =>
      tx.responsibleParty.createMany({ data: rows as Prisma.ResponsiblePartyCreateManyInput[] }),
    deleteMany: (tx, accountId) => tx.responsibleParty.deleteMany({ where: { accountId } }),
  },
  {
    key: "tableTypes",
    createMany: (tx, rows) =>
      tx.tableType.createMany({ data: rows as Prisma.TableTypeCreateManyInput[] }),
    deleteMany: (tx, accountId) => tx.tableType.deleteMany({ where: { accountId } }),
  },
  {
    key: "sections",
    createMany: (tx, rows) =>
      tx.section.createMany({ data: rows as Prisma.SectionCreateManyInput[] }),
    deleteMany: (tx, accountId) => tx.section.deleteMany({ where: { accountId } }),
  },
  {
    key: "categories",
    createMany: (tx, rows) =>
      tx.category.createMany({ data: rows as Prisma.CategoryCreateManyInput[] }),
    deleteMany: (tx, accountId) => tx.category.deleteMany({ where: { accountId } }),
  },
  {
    key: "subcategories",
    createMany: (tx, rows) =>
      tx.subcategory.createMany({ data: rows as Prisma.SubcategoryCreateManyInput[] }),
    deleteMany: (tx, accountId) => tx.subcategory.deleteMany({ where: { accountId } }),
  },
  {
    key: "institutions",
    createMany: (tx, rows) =>
      tx.institution.createMany({ data: rows as Prisma.InstitutionCreateManyInput[] }),
    deleteMany: (tx, accountId) => tx.institution.deleteMany({ where: { accountId } }),
  },
  {
    key: "tags",
    createMany: (tx, rows) => tx.tag.createMany({ data: rows as Prisma.TagCreateManyInput[] }),
    deleteMany: (tx, accountId) => tx.tag.deleteMany({ where: { accountId } }),
  },
  {
    key: "csvTemplates",
    createMany: (tx, rows) =>
      tx.csvTemplate.createMany({ data: rows as Prisma.CsvTemplateCreateManyInput[] }),
    deleteMany: (tx, accountId) => tx.csvTemplate.deleteMany({ where: { accountId } }),
  },
  {
    key: "months",
    createMany: (tx, rows) => tx.month.createMany({ data: rows as Prisma.MonthCreateManyInput[] }),
    deleteMany: (tx, accountId) => tx.month.deleteMany({ where: { accountId } }),
  },
  {
    key: "tableTemplates",
    createMany: (tx, rows) =>
      tx.tableTemplate.createMany({ data: rows as Prisma.TableTemplateCreateManyInput[] }),
    deleteMany: (tx, accountId) => tx.tableTemplate.deleteMany({ where: { accountId } }),
  },
  {
    key: "tableTemplateItems",
    createMany: (tx, rows) =>
      tx.tableTemplateItem.createMany({ data: rows as Prisma.TableTemplateItemCreateManyInput[] }),
    deleteMany: (tx, accountId) => tx.tableTemplateItem.deleteMany({ where: { accountId } }),
  },
  {
    key: "installmentGroups",
    createMany: (tx, rows) =>
      tx.installmentGroup.createMany({ data: rows as Prisma.InstallmentGroupCreateManyInput[] }),
    deleteMany: (tx, accountId) => tx.installmentGroup.deleteMany({ where: { accountId } }),
  },
  {
    key: "financeTables",
    createMany: (tx, rows) =>
      tx.financeTable.createMany({ data: rows as Prisma.FinanceTableCreateManyInput[] }),
    deleteMany: (tx, accountId) => tx.financeTable.deleteMany({ where: { accountId } }),
  },
  {
    key: "transactions",
    createMany: (tx, rows) =>
      tx.transaction.createMany({ data: rows as Prisma.TransactionCreateManyInput[] }),
    deleteMany: (tx, accountId) => tx.transaction.deleteMany({ where: { accountId } }),
  },
  {
    key: "transactionTags",
    createMany: (tx, rows) =>
      tx.transactionTag.createMany({ data: rows as Prisma.TransactionTagCreateManyInput[] }),
    // Sem `accountId` próprio (join table) — filtra via relação, como o export (§ buildAccountSnapshot).
    deleteMany: (tx, accountId) =>
      tx.transactionTag.deleteMany({ where: { transaction: { accountId } } }),
  },
  {
    key: "transactionLinks",
    createMany: (tx, rows) =>
      tx.transactionLink.createMany({ data: rows as Prisma.TransactionLinkCreateManyInput[] }),
    deleteMany: (tx, accountId) => tx.transactionLink.deleteMany({ where: { accountId } }),
  },
  {
    key: "transactionAliases",
    createMany: (tx, rows) =>
      tx.transactionAlias.createMany({ data: rows as Prisma.TransactionAliasCreateManyInput[] }),
    deleteMany: (tx, accountId) => tx.transactionAlias.deleteMany({ where: { accountId } }),
  },
  {
    key: "transactionAliasTags",
    createMany: (tx, rows) =>
      tx.transactionAliasTag.createMany({
        data: rows as Prisma.TransactionAliasTagCreateManyInput[],
      }),
    deleteMany: (tx, accountId) =>
      tx.transactionAliasTag.deleteMany({ where: { alias: { accountId } } }),
  },
  {
    key: "pendingInstallments",
    createMany: (tx, rows) =>
      tx.pendingInstallment.createMany({ data: rows as Prisma.PendingInstallmentCreateManyInput[] }),
    deleteMany: (tx, accountId) => tx.pendingInstallment.deleteMany({ where: { accountId } }),
  },
  {
    key: "responsiblePartyMembers",
    // Sempre vazio no insert (DD-10: dropados) — presente aqui só para o delete do `overwrite`.
    createMany: (tx, rows) =>
      tx.responsiblePartyMember.createMany({
        data: rows as Prisma.ResponsiblePartyMemberCreateManyInput[],
      }),
    deleteMany: (tx, accountId) =>
      tx.responsiblePartyMember.deleteMany({ where: { party: { accountId } } }),
  },
  {
    key: "budgets",
    createMany: (tx, rows) => tx.budget.createMany({ data: rows as Prisma.BudgetCreateManyInput[] }),
    deleteMany: (tx, accountId) => tx.budget.deleteMany({ where: { accountId } }),
  },
  {
    key: "dashboardLayouts",
    createMany: (tx, rows) =>
      tx.dashboardLayout.createMany({ data: rows as Prisma.DashboardLayoutCreateManyInput[] }),
    deleteMany: (tx, accountId) => tx.dashboardLayout.deleteMany({ where: { accountId } }),
  },
  {
    key: "checklistItems",
    createMany: (tx, rows) =>
      tx.checklistItem.createMany({ data: rows as Prisma.ChecklistItemCreateManyInput[] }),
    deleteMany: (tx, accountId) => tx.checklistItem.deleteMany({ where: { accountId } }),
  },
  {
    key: "checklistCompletions",
    createMany: (tx, rows) =>
      tx.checklistCompletion.createMany({
        data: rows as Prisma.ChecklistCompletionCreateManyInput[],
      }),
    deleteMany: (tx, accountId) => tx.checklistCompletion.deleteMany({ where: { accountId } }),
  },
  {
    key: "balanceAccounts",
    createMany: (tx, rows) =>
      tx.balanceAccount.createMany({ data: rows as Prisma.BalanceAccountCreateManyInput[] }),
    deleteMany: (tx, accountId) => tx.balanceAccount.deleteMany({ where: { accountId } }),
  },
  {
    key: "balanceSnapshots",
    createMany: (tx, rows) =>
      tx.balanceSnapshot.createMany({ data: rows as Prisma.BalanceSnapshotCreateManyInput[] }),
    deleteMany: (tx, accountId) => tx.balanceSnapshot.deleteMany({ where: { accountId } }),
  },
];

// ─── Helpers de decode ────────────────────────────────────────────────────────
// Dinheiro já vem `bigint` do `.parse()` (z.coerce.bigint) — passado direto ao Prisma.
// `exchangeRate` fica string (Prisma aceita string para Decimal). Datas são strings
// no snapshot: `new Date(...)` decodifica tanto DateTime (ISO) quanto @db.Date
// ("YYYY-MM-DD", interpretado como UTC — espelha o encode `toISOString().slice(0,10)`).

function date(value: string): Date {
  return new Date(value);
}

function dateNull(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}

function toJsonInput(value: unknown, fallback: Prisma.InputJsonValue): Prisma.InputJsonValue {
  return (value === null || value === undefined ? fallback : value) as Prisma.InputJsonValue;
}

function buildIdMap(rows: readonly unknown[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    if (row && typeof row === "object" && "id" in row) {
      const id = (row as { id?: unknown }).id;
      if (typeof id === "string") map.set(id, newId());
    }
  }
  return map;
}

/** FK obrigatória (NOT NULL): o alvo SEMPRE existe no snapshot; ausência = backup corrompido. */
function reqId(map: Map<string, string>, oldId: string): string {
  const mapped = map.get(oldId);
  if (mapped === undefined) {
    throw new AppError("VALIDATION", `Referência inválida no backup (id não encontrado): ${oldId}`);
  }
  return mapped;
}

/** FK opcional / soft-ref: null -> null; presente -> remapeado (ou null se órfão). */
function optId(map: Map<string, string>, oldId: string | null): string | null {
  if (oldId === null) return null;
  return map.get(oldId) ?? null;
}

/**
 * Deep-remap dos widgets de um DashboardLayout: itera o array e delega o `config`
 * de cada widget a `remapWidgetConfig` (registro central no módulo de remap, DD-11/16).
 * A iteração vive aqui (service); o registro de campos-id vive no módulo puro.
 */
function remapWidgets(widgets: unknown, maps: IdMaps): unknown {
  if (!Array.isArray(widgets)) return widgets;
  return widgets.map((w) => {
    if (!w || typeof w !== "object" || Array.isArray(w)) return w;
    const widget = w as Record<string, unknown>;
    const widgetId = typeof widget.widgetId === "string" ? widget.widgetId : "";
    return { ...widget, config: remapWidgetConfig(widgetId, widget.config, maps) };
  });
}

/**
 * PLANNER puro (spec 64 §2.2): consome um `AccountSnapshot` já parseado e produz um
 * `ImportPlan` totalmente remapeado, SEM tocar no banco (testável isoladamente).
 *
 * - Gera um id novo por linha (DD-06) e monta `idMap[modelo]` = oldId->newId.
 * - Reescreve TODAS as referências: FKs reais + soft-refs (§7 "Nota — soft-refs") +
 *   ids em blobs JSON (dashboard/mapping/metadata, via módulo de remap) + self-relation
 *   `FinanceTable.sourceTableId` (2ª passada).
 * - Re-carimba `createdById/updatedById/completedById` para `userId` (DD-10).
 * - Dropa `ResponsiblePartyMember` (DD-10) e zera `Budget.memberUserId` (DD-10).
 */
export function planImport(
  snapshot: AccountSnapshot,
  targetAccountId: string,
  userId: string,
): ImportPlan {
  const data = snapshot.data;
  const accountId = targetAccountId;

  // 1) idMap por modelo (todos os 26; join tables sem `id` ficam com mapa vazio).
  const idMap = {
    responsibleParties: buildIdMap(data.responsibleParties),
    responsiblePartyMembers: buildIdMap(data.responsiblePartyMembers),
    tableTypes: buildIdMap(data.tableTypes),
    sections: buildIdMap(data.sections),
    categories: buildIdMap(data.categories),
    subcategories: buildIdMap(data.subcategories),
    institutions: buildIdMap(data.institutions),
    tags: buildIdMap(data.tags),
    csvTemplates: buildIdMap(data.csvTemplates),
    months: buildIdMap(data.months),
    tableTemplates: buildIdMap(data.tableTemplates),
    tableTemplateItems: buildIdMap(data.tableTemplateItems),
    installmentGroups: buildIdMap(data.installmentGroups),
    pendingInstallments: buildIdMap(data.pendingInstallments),
    financeTables: buildIdMap(data.financeTables),
    transactions: buildIdMap(data.transactions),
    transactionTags: buildIdMap(data.transactionTags),
    transactionLinks: buildIdMap(data.transactionLinks),
    transactionAliases: buildIdMap(data.transactionAliases),
    transactionAliasTags: buildIdMap(data.transactionAliasTags),
    budgets: buildIdMap(data.budgets),
    dashboardLayouts: buildIdMap(data.dashboardLayouts),
    checklistItems: buildIdMap(data.checklistItems),
    checklistCompletions: buildIdMap(data.checklistCompletions),
    balanceAccounts: buildIdMap(data.balanceAccounts),
    balanceSnapshots: buildIdMap(data.balanceSnapshots),
  } satisfies Record<ModelKey, Map<string, string>>;

  // Subconjunto usado pelo deep-remap de JSON (chaves EntityMapKey do módulo de remap).
  const jsonMaps: IdMaps = {
    section: idMap.sections,
    category: idMap.categories,
    subcategory: idMap.subcategories,
    institution: idMap.institutions,
    tag: idMap.tags,
    responsibleParty: idMap.responsibleParties,
    month: idMap.months,
    transactionAlias: idMap.transactionAliases,
  };

  const secondPass: { id: string; sourceTableId: string }[] = [];

  const inserts: Inserts = {
    responsibleParties: data.responsibleParties.map((r) => ({
      id: reqId(idMap.responsibleParties, r.id),
      accountId,
      name: r.name,
      kind: r.kind,
      icon: r.icon,
      color: r.color,
      archivedAt: dateNull(r.archivedAt),
      createdAt: date(r.createdAt),
      updatedAt: date(r.updatedAt),
    })),

    // DD-10: membros de responsáveis são dropados (usuários não atravessam contas).
    responsiblePartyMembers: [],

    tableTypes: data.tableTypes.map((t) => ({
      id: reqId(idMap.tableTypes, t.id),
      accountId,
      name: t.name,
      isDefault: t.isDefault,
      hiddenColumns: toJsonInput(t.hiddenColumns, {}),
      createdAt: date(t.createdAt),
    })),

    sections: data.sections.map((s) => ({
      id: reqId(idMap.sections, s.id),
      accountId,
      name: s.name,
      countType: s.countType,
      order: s.order,
      isActive: s.isActive,
      createdAt: date(s.createdAt),
    })),

    categories: data.categories.map((c) => ({
      id: reqId(idMap.categories, c.id),
      accountId,
      name: c.name,
      createdById: userId,
      createdAt: date(c.createdAt),
    })),

    subcategories: data.subcategories.map((s) => ({
      id: reqId(idMap.subcategories, s.id),
      categoryId: reqId(idMap.categories, s.categoryId),
      accountId,
      name: s.name,
      createdAt: date(s.createdAt),
    })),

    institutions: data.institutions.map((i) => ({
      id: reqId(idMap.institutions, i.id),
      accountId,
      name: i.name,
      createdById: userId,
      createdAt: date(i.createdAt),
    })),

    tags: data.tags.map((t) => ({
      id: reqId(idMap.tags, t.id),
      accountId,
      name: t.name,
      color: t.color,
      createdAt: date(t.createdAt),
    })),

    csvTemplates: data.csvTemplates.map((c) => ({
      id: reqId(idMap.csvTemplates, c.id),
      accountId,
      name: c.name,
      mapping: toJsonInput(remapCsvMapping(c.mapping, jsonMaps), {}),
      createdById: userId,
      createdAt: date(c.createdAt),
    })),

    months: data.months.map((m) => ({
      id: reqId(idMap.months, m.id),
      accountId,
      year: m.year,
      month: m.month,
      createdById: userId,
      createdAt: date(m.createdAt),
    })),

    tableTemplates: data.tableTemplates.map((t) => ({
      id: reqId(idMap.tableTemplates, t.id),
      accountId,
      name: t.name,
      description: t.description,
      tableTypeId: optId(idMap.tableTypes, t.tableTypeId),
      countInMonth: t.countInMonth,
      autoApply: t.autoApply,
      // Soft-refs (§7): colunas String sem relação Prisma — precisam de remap explícito.
      autoSectionId: optId(idMap.sections, t.autoSectionId),
      autoTableTypeId: optId(idMap.tableTypes, t.autoTableTypeId),
      createdById: userId,
      createdAt: date(t.createdAt),
      updatedAt: date(t.updatedAt),
    })),

    tableTemplateItems: data.tableTemplateItems.map((i) => ({
      id: reqId(idMap.tableTemplateItems, i.id),
      templateId: reqId(idMap.tableTemplates, i.templateId),
      accountId,
      day: i.day,
      amountCents: i.amountCents,
      description: i.description,
      notes: i.notes,
      isPending: i.isPending,
      // Soft-refs (§7).
      categoryId: optId(idMap.categories, i.categoryId),
      subcategoryId: optId(idMap.subcategories, i.subcategoryId),
      institutionId: optId(idMap.institutions, i.institutionId),
      // FK real (relação declarada).
      responsiblePartyId: optId(idMap.responsibleParties, i.responsiblePartyId),
      cardInstallment: i.cardInstallment,
      investmentType: i.investmentType,
      expenseType: i.expenseType,
      displayOrder: i.displayOrder,
      createdAt: date(i.createdAt),
    })),

    installmentGroups: data.installmentGroups.map((g) => ({
      id: reqId(idMap.installmentGroups, g.id),
      accountId,
      description: g.description,
      totalCents: g.totalCents,
      installmentCount: g.installmentCount,
      downPaymentCents: g.downPaymentCents,
      startDate: date(g.startDate),
      sectionId: reqId(idMap.sections, g.sectionId),
      tableTypeId: optId(idMap.tableTypes, g.tableTypeId),
      createdAt: date(g.createdAt),
    })),

    pendingInstallments: data.pendingInstallments.map((p) => ({
      id: reqId(idMap.pendingInstallments, p.id),
      accountId,
      installmentGroupId: reqId(idMap.installmentGroups, p.installmentGroupId),
      installmentNumber: p.installmentNumber,
      amountCents: p.amountCents,
      expectedDate: date(p.expectedDate),
      description: p.description,
      // Soft-refs (§7).
      categoryId: optId(idMap.categories, p.categoryId),
      subcategoryId: optId(idMap.subcategories, p.subcategoryId),
      notes: p.notes,
      createdAt: date(p.createdAt),
    })),

    financeTables: data.financeTables.map((f) => {
      const id = reqId(idMap.financeTables, f.id);
      // Self-relation (§7 item 3): insere com null; 2ª passada seta o id remapeado.
      if (f.sourceTableId !== null) {
        const remapped = idMap.financeTables.get(f.sourceTableId);
        if (remapped) secondPass.push({ id, sourceTableId: remapped });
      }
      return {
        id,
        accountId,
        monthId: reqId(idMap.months, f.monthId),
        sectionId: reqId(idMap.sections, f.sectionId),
        tableTypeId: optId(idMap.tableTypes, f.tableTypeId),
        name: f.name,
        countInMonth: f.countInMonth,
        groupByDate: f.groupByDate,
        sourceMethod: f.sourceMethod,
        sourceTableId: null,
        displayOrder: f.displayOrder,
        createdById: userId,
        createdAt: date(f.createdAt),
        updatedById: f.updatedById === null ? null : userId,
        updatedAt: date(f.updatedAt),
      };
    }),

    transactions: data.transactions.map((t) => ({
      id: reqId(idMap.transactions, t.id),
      accountId,
      monthId: reqId(idMap.months, t.monthId),
      tableId: reqId(idMap.financeTables, t.tableId),
      sectionId: reqId(idMap.sections, t.sectionId),
      occurredOn: date(t.occurredOn),
      amountCents: t.amountCents,
      description: t.description,
      notes: t.notes,
      isPending: t.isPending,
      isFavorite: t.isFavorite,
      categoryId: optId(idMap.categories, t.categoryId),
      subcategoryId: optId(idMap.subcategories, t.subcategoryId),
      institutionId: optId(idMap.institutions, t.institutionId),
      institutionText: t.institutionText,
      responsiblePartyId: optId(idMap.responsibleParties, t.responsiblePartyId),
      cardInstallment: t.cardInstallment,
      investmentType: t.investmentType,
      expenseType: t.expenseType,
      paymentMethod: t.paymentMethod,
      source: t.source,
      installmentGroupId: optId(idMap.installmentGroups, t.installmentGroupId),
      installmentNumber: t.installmentNumber,
      originalAmountCents: t.originalAmountCents,
      originalCurrency: t.originalCurrency,
      exchangeRate: t.exchangeRate,
      // Deep-remap JSON (§7): metadata.appliedAliasId -> alias remapeado.
      metadata: toJsonInput(remapTransactionMetadata(t.metadata, jsonMaps), {}),
      createdById: userId,
      createdAt: date(t.createdAt),
      updatedById: t.updatedById === null ? null : userId,
      updatedAt: date(t.updatedAt),
    })),

    transactionTags: data.transactionTags.map((t) => ({
      transactionId: reqId(idMap.transactions, t.transactionId),
      tagId: reqId(idMap.tags, t.tagId),
    })),

    transactionLinks: data.transactionLinks.map((l) => ({
      id: reqId(idMap.transactionLinks, l.id),
      accountId,
      sourceId: reqId(idMap.transactions, l.sourceId),
      targetId: reqId(idMap.transactions, l.targetId),
      type: l.type,
      notes: l.notes,
      createdAt: date(l.createdAt),
    })),

    transactionAliases: data.transactionAliases.map((a) => ({
      id: reqId(idMap.transactionAliases, a.id),
      accountId,
      trigger: a.trigger,
      triggerNormalized: a.triggerNormalized,
      description: a.description,
      notes: a.notes,
      amountCents: a.amountCents,
      categoryId: optId(idMap.categories, a.categoryId),
      subcategoryId: optId(idMap.subcategories, a.subcategoryId),
      institutionId: optId(idMap.institutions, a.institutionId),
      institutionText: a.institutionText,
      responsiblePartyId: optId(idMap.responsibleParties, a.responsiblePartyId),
      expenseType: a.expenseType,
      paymentMethod: a.paymentMethod,
      investmentType: a.investmentType,
      cardInstallment: a.cardInstallment,
      isPending: a.isPending,
      isFavorite: a.isFavorite,
      originalCurrency: a.originalCurrency,
      originalAmountCents: a.originalAmountCents,
      exchangeRate: a.exchangeRate,
      archivedAt: dateNull(a.archivedAt),
      createdById: userId,
      createdAt: date(a.createdAt),
      updatedAt: date(a.updatedAt),
    })),

    transactionAliasTags: data.transactionAliasTags.map((t) => ({
      aliasId: reqId(idMap.transactionAliases, t.aliasId),
      tagId: reqId(idMap.tags, t.tagId),
    })),

    budgets: data.budgets.map((b) => ({
      id: reqId(idMap.budgets, b.id),
      accountId,
      name: b.name,
      sectionId: optId(idMap.sections, b.sectionId),
      categoryId: optId(idMap.categories, b.categoryId),
      // DD-10: referência a usuário-membro é zerada (usuário não atravessa contas).
      memberUserId: null,
      institutionId: optId(idMap.institutions, b.institutionId),
      tableTypeId: optId(idMap.tableTypes, b.tableTypeId),
      amountCents: b.amountCents,
      alertThresholdPercent: b.alertThresholdPercent,
      isRecurring: b.isRecurring,
      showInSummary: b.showInSummary,
      year: b.year,
      month: b.month,
      createdAt: date(b.createdAt),
      updatedAt: date(b.updatedAt),
    })),

    dashboardLayouts: data.dashboardLayouts.map((d) => ({
      id: reqId(idMap.dashboardLayouts, d.id),
      accountId,
      context: d.context,
      // Deep-remap JSON (§7): ids dentro de widgets[].config.
      widgets: toJsonInput(remapWidgets(d.widgets, jsonMaps), []),
      createdAt: date(d.createdAt),
      updatedAt: date(d.updatedAt),
    })),

    checklistItems: data.checklistItems.map((c) => ({
      id: reqId(idMap.checklistItems, c.id),
      accountId,
      label: c.label,
      position: c.position,
      createdById: userId,
      createdAt: date(c.createdAt),
      updatedAt: date(c.updatedAt),
    })),

    checklistCompletions: data.checklistCompletions.map((c) => ({
      id: reqId(idMap.checklistCompletions, c.id),
      accountId,
      itemId: reqId(idMap.checklistItems, c.itemId),
      monthId: reqId(idMap.months, c.monthId),
      completedById: userId,
      transactionId: optId(idMap.transactions, c.transactionId),
      createdAt: date(c.createdAt),
    })),

    balanceAccounts: data.balanceAccounts.map((b) => ({
      id: reqId(idMap.balanceAccounts, b.id),
      accountId,
      kind: b.kind,
      name: b.name,
      institutionId: optId(idMap.institutions, b.institutionId),
      archivedAt: dateNull(b.archivedAt),
      createdById: userId,
      createdAt: date(b.createdAt),
      updatedAt: date(b.updatedAt),
    })),

    balanceSnapshots: data.balanceSnapshots.map((b) => ({
      id: reqId(idMap.balanceSnapshots, b.id),
      accountId,
      balanceAccountId: reqId(idMap.balanceAccounts, b.balanceAccountId),
      balanceCents: b.balanceCents,
      capturedOn: date(b.capturedOn),
      createdById: userId,
      createdAt: date(b.createdAt),
    })),
  };

  return {
    idMap,
    inserts,
    secondPass,
    accountUpdate: {
      name: snapshot.account.name,
      settings: {
        currency: snapshot.account.settings.currency,
        monthStartDay: snapshot.account.settings.monthStartDay,
        invertSignOnMoveByDefault: snapshot.account.settings.invertSignOnMoveByDefault,
        onboardingCompletedAt: dateNull(snapshot.account.settings.onboardingCompletedAt),
        // FK real -> remapeada (null se ausente/órfã).
        defaultResponsiblePartyId: optId(
          idMap.responsibleParties,
          snapshot.account.settings.defaultResponsiblePartyId,
        ),
      },
    },
  };
}

/**
 * EXECUTOR (spec 64 §4 BKP-02): valida a versão, cria a conta destino (modo `new`)
 * e roda o `ImportPlan` numa única `prisma.$transaction` (atômico, DD-05).
 *
 * - `new`: cria uma conta vazia (`createBareAccount`) e insere o snapshot nela.
 * - `overwrite`: apaga os dados account-scoped da conta ATUAL em ordem REVERSA
 *   (mesma lista de modelos, DD-14) e restaura nome + AccountSettings (DD-12),
 *   preservando Account/membros/convites.
 */
export async function importSnapshot(
  snapshot: AccountSnapshot,
  opts: { mode: "new" | "overwrite"; targetAccountId: string; userId: string },
): Promise<{ accountId: string; counts: Record<string, number> }> {
  // DD-08: só formatVersion 1; qualquer outro é rejeitado antes de gravar nada.
  if (snapshot.formatVersion !== 1) {
    throw new AppError(
      "VALIDATION",
      `Versão de backup incompatível (esperado formatVersion 1, recebido ${String(snapshot.formatVersion)}).`,
    );
  }

  const { mode, userId } = opts;
  let targetAccountId = opts.targetAccountId;

  // Modo `new`: cria a conta destino ANTES da transação de insert (DD-02).
  if (mode === "new") {
    const bare = await createBareAccount(userId, snapshot.account.name);
    targetAccountId = bare.id;
  }

  const plan = planImport(snapshot, targetAccountId, userId);

  const counts = await prisma.$transaction(
    async (tx) => {
      // `overwrite`: apaga os children account-scoped em ordem REVERSA do insert (DD-14),
      // satisfazendo as FKs Restrict (transações/tabelas/installmentGroups antes de sections).
      if (mode === "overwrite") {
        for (const desc of [...MODEL_ORDER].reverse()) {
          await desc.deleteMany(tx, targetAccountId);
        }
        // DD-12: restaura o nome da conta a partir do snapshot (o modo `new` mantém
        // o nome já resolvido/deduplicado por `createBareAccount`).
        await tx.account.update({
          where: { id: targetAccountId },
          data: { name: plan.accountUpdate.name },
        });
      }

      // Insert em ordem topológica (§7). Pula modelos sem linhas.
      const c: Record<string, number> = {};
      for (const desc of MODEL_ORDER) {
        const rows = plan.inserts[desc.key];
        if (rows.length === 0) {
          c[desc.key] = 0;
          continue;
        }
        const res = await desc.createMany(tx, rows);
        c[desc.key] = res.count;
      }

      // AccountSettings: restaurado depois de inserir responsibleParties (§7 passo 10),
      // para que a FK `defaultResponsiblePartyId` (já remapeada) seja válida.
      await tx.accountSettings.update({
        where: { accountId: targetAccountId },
        data: {
          currency: plan.accountUpdate.settings.currency,
          monthStartDay: plan.accountUpdate.settings.monthStartDay,
          invertSignOnMoveByDefault: plan.accountUpdate.settings.invertSignOnMoveByDefault,
          onboardingCompletedAt: plan.accountUpdate.settings.onboardingCompletedAt,
          defaultResponsiblePartyId: plan.accountUpdate.settings.defaultResponsiblePartyId,
        },
      });

      // 2ª passada: self-relation FinanceTable.sourceTableId (§7 item 3).
      for (const { id, sourceTableId } of plan.secondPass) {
        await tx.financeTable.update({ where: { id }, data: { sourceTableId } });
      }

      return c;
    },
    { timeout: 120_000, maxWait: 15_000 },
  );

  log.info(
    { accountId: targetAccountId, mode, userId, counts },
    "Account snapshot imported",
  );
  return { accountId: targetAccountId, counts };
}
