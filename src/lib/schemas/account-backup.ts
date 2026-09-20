import {
  BalanceAccountKind,
  DashboardLayoutContext,
  ResponsiblePartyKind,
  SectionCountType,
  TableSourceMethod,
  TransactionExpenseType,
  TransactionLinkType,
  TransactionPaymentMethod,
  TransactionSource,
} from "@prisma/client";
import { z } from "zod";

// Schema Zod do snapshot de backup de uma Account (spec 64, Fase 0).
//
// Serialização (spec 64 §7): BigInt -> string (decode via z.coerce.bigint()),
// Decimal -> string, DateTime/@db.Date -> string (ISO ou "YYYY-MM-DD",
// decodificado depois pelo service). IDs de origem ficam como z.string() puro
// (não `cuid()`) — servem só para reconstruir o mapa de remap no import, não
// para validar formato.
//
// Colunas Json (`hiddenColumns`, `mapping`, `metadata`, `widgets`) ficam como
// z.unknown() aqui — o deep-remap/validação de conteúdo é responsabilidade do
// account-backup-remap.ts (Fase 2).

// ─── Account settings (sub-objeto `account.settings`) ─────────────

export const accountSettingsSnapshotSchema = z.object({
  currency: z.string(),
  monthStartDay: z.number().int(),
  invertSignOnMoveByDefault: z.boolean(),
  onboardingCompletedAt: z.string().nullable(),
  defaultResponsiblePartyId: z.string().nullable(),
});

export type AccountSettingsSnapshot = z.infer<typeof accountSettingsSnapshotSchema>;

// ─── Responsáveis ──────────────────────────────────────────────────

export const responsiblePartyRowSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  name: z.string(),
  kind: z.nativeEnum(ResponsiblePartyKind),
  icon: z.string().nullable(),
  color: z.string().nullable(),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ResponsiblePartyRow = z.infer<typeof responsiblePartyRowSchema>;

export const responsiblePartyMemberRowSchema = z.object({
  partyId: z.string(),
  userId: z.string(),
});
export type ResponsiblePartyMemberRow = z.infer<typeof responsiblePartyMemberRowSchema>;

// ─── Tipos de tabela ────────────────────────────────────────────────

/**
 * Spec 69 — o tipo de tabela deixou de ser "nome + colunas ocultas": carrega
 * layout da linha, densidade e 9 outros campos de apresentação. Fora do backup,
 * restaurar um snapshot devolvia todo tipo aos defaults do Prisma **em silêncio**
 * — o usuário perdia a configuração inteira sem nenhum aviso.
 *
 * Todos com `.default(...)` / `z.unknown()`: um backup **antigo** (anterior a
 * estas colunas) não tem os campos e tem que restaurar no default, não estourar.
 * Os defaults abaixo são os mesmos do `schema.prisma`.
 */
export const tableTypeRowSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  name: z.string(),
  isDefault: z.boolean(),
  hiddenColumns: z.unknown(),
  // "columns" | "pills" (Spec 66/69 D4)
  rowLayout: z.string().default("columns"),
  // "compact" | "default" | "comfortable"
  density: z.string().default("default"),
  // Colunas Json — validadas de verdade só na leitura da tela (schemas de
  // `settings.ts`); aqui vale a mesma regra de `hiddenColumns`/`mapping`.
  visibleColumns: z.unknown(),
  pinnedColumns: z.unknown(),
  inheritOnNewRow: z.unknown(),
  defaultSort: z.unknown(),
  // null | "date" | "category" | "responsible" | "installment"
  groupBy: z.string().nullable().default(null),
  showFooterTotal: z.boolean().default(true),
  showGroupSubtotal: z.boolean().default(false),
  allowBulkEdit: z.boolean().default(true),
  // `false`, como o `@default` do Prisma: um backup anterior à Spec 69 saiu de um
  // app onde a linha vazia só aparecia ao clicar em "Nova transação".
  keepGhostRow: z.boolean().default(false),
  createdAt: z.string(),
});
export type TableTypeRow = z.infer<typeof tableTypeRowSchema>;

// ─── Seções ─────────────────────────────────────────────────────────

export const sectionRowSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  name: z.string(),
  countType: z.nativeEnum(SectionCountType),
  order: z.number().int(),
  isActive: z.boolean(),
  createdAt: z.string(),
});
export type SectionRow = z.infer<typeof sectionRowSchema>;

// ─── Categorias / Subcategorias ─────────────────────────────────────

export const categoryRowSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  name: z.string(),
  createdById: z.string(),
  createdAt: z.string(),
});
export type CategoryRow = z.infer<typeof categoryRowSchema>;

export const subcategoryRowSchema = z.object({
  id: z.string(),
  categoryId: z.string(),
  accountId: z.string(),
  name: z.string(),
  createdAt: z.string(),
});
export type SubcategoryRow = z.infer<typeof subcategoryRowSchema>;

// ─── Instituições ────────────────────────────────────────────────────

export const institutionRowSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  name: z.string(),
  createdById: z.string(),
  createdAt: z.string(),
});
export type InstitutionRow = z.infer<typeof institutionRowSchema>;

// ─── Tags ────────────────────────────────────────────────────────────

export const tagRowSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  createdAt: z.string(),
});
export type TagRow = z.infer<typeof tagRowSchema>;

// ─── Modelos de importação CSV ──────────────────────────────────────

export const csvTemplateRowSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  name: z.string(),
  mapping: z.unknown(),
  createdById: z.string(),
  createdAt: z.string(),
});
export type CsvTemplateRow = z.infer<typeof csvTemplateRowSchema>;

// ─── Meses ───────────────────────────────────────────────────────────

export const monthRowSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  year: z.number().int(),
  month: z.number().int(),
  createdById: z.string(),
  createdAt: z.string(),
});
export type MonthRow = z.infer<typeof monthRowSchema>;

// ─── Modelos de tabela ───────────────────────────────────────────────

export const tableTemplateRowSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  tableTypeId: z.string().nullable(),
  countInMonth: z.boolean(),
  autoApply: z.boolean(),
  autoSectionId: z.string().nullable(),
  autoTableTypeId: z.string().nullable(),
  createdById: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TableTemplateRow = z.infer<typeof tableTemplateRowSchema>;

export const tableTemplateItemRowSchema = z.object({
  id: z.string(),
  templateId: z.string(),
  accountId: z.string(),
  day: z.number().int(),
  amountCents: z.coerce.bigint(),
  description: z.string().nullable(),
  notes: z.string().nullable(),
  isPending: z.boolean(),
  categoryId: z.string().nullable(),
  subcategoryId: z.string().nullable(),
  institutionId: z.string().nullable(),
  responsiblePartyId: z.string().nullable(),
  cardInstallment: z.string().nullable(),
  investmentType: z.string().nullable(),
  expenseType: z.nativeEnum(TransactionExpenseType).nullable(),
  displayOrder: z.number().int(),
  createdAt: z.string(),
});
export type TableTemplateItemRow = z.infer<typeof tableTemplateItemRowSchema>;

// ─── Parcelamentos ───────────────────────────────────────────────────

export const installmentGroupRowSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  description: z.string(),
  totalCents: z.coerce.bigint(),
  installmentCount: z.number().int(),
  downPaymentCents: z.coerce.bigint().nullable(),
  startDate: z.string(),
  sectionId: z.string(),
  tableTypeId: z.string().nullable(),
  createdAt: z.string(),
  // Spec 73 §2.4 — backup antigo (sem o campo) restaura com o default do schema.
  autoCreateOnNewMonth: z.boolean().default(true),
});
export type InstallmentGroupRow = z.infer<typeof installmentGroupRowSchema>;

export const pendingInstallmentRowSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  installmentGroupId: z.string(),
  installmentNumber: z.number().int(),
  amountCents: z.coerce.bigint(),
  expectedDate: z.string(),
  description: z.string().nullable(),
  categoryId: z.string().nullable(),
  subcategoryId: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  // Spec 73 §2.5 — backup antigo (sem o campo) restaura como não-paga.
  settledAt: z.string().nullable().default(null),
});
export type PendingInstallmentRow = z.infer<typeof pendingInstallmentRowSchema>;

// ─── Tabelas dos meses ───────────────────────────────────────────────

export const financeTableRowSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  monthId: z.string(),
  sectionId: z.string(),
  tableTypeId: z.string().nullable(),
  name: z.string(),
  countInMonth: z.boolean(),
  groupByDate: z.boolean(),
  sourceMethod: z.nativeEnum(TableSourceMethod),
  sourceTableId: z.string().nullable(),
  displayOrder: z.number().int(),
  createdById: z.string(),
  createdAt: z.string(),
  updatedById: z.string().nullable(),
  updatedAt: z.string(),
});
export type FinanceTableRow = z.infer<typeof financeTableRowSchema>;

// ─── Transações ──────────────────────────────────────────────────────

export const transactionRowSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  monthId: z.string(),
  tableId: z.string(),
  sectionId: z.string(),
  occurredOn: z.string(),
  amountCents: z.coerce.bigint(),
  description: z.string().nullable(),
  notes: z.string().nullable(),
  isPending: z.boolean(),
  isFavorite: z.boolean(),
  categoryId: z.string().nullable(),
  subcategoryId: z.string().nullable(),
  institutionId: z.string().nullable(),
  institutionText: z.string().nullable(),
  responsiblePartyId: z.string().nullable(),
  cardInstallment: z.string().nullable(),
  investmentType: z.string().nullable(),
  expenseType: z.nativeEnum(TransactionExpenseType).nullable(),
  paymentMethod: z.nativeEnum(TransactionPaymentMethod).nullable(),
  source: z.nativeEnum(TransactionSource),
  installmentGroupId: z.string().nullable(),
  installmentNumber: z.number().int().nullable(),
  originalAmountCents: z.coerce.bigint().nullable(),
  originalCurrency: z.string().nullable(),
  exchangeRate: z.string().nullable(),
  metadata: z.unknown(),
  createdById: z.string(),
  createdAt: z.string(),
  updatedById: z.string().nullable(),
  updatedAt: z.string(),
});
export type TransactionRow = z.infer<typeof transactionRowSchema>;

export const transactionTagRowSchema = z.object({
  transactionId: z.string(),
  tagId: z.string(),
});
export type TransactionTagRow = z.infer<typeof transactionTagRowSchema>;

export const transactionLinkRowSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  sourceId: z.string(),
  targetId: z.string(),
  type: z.nativeEnum(TransactionLinkType),
  notes: z.string().nullable(),
  createdAt: z.string(),
});
export type TransactionLinkRow = z.infer<typeof transactionLinkRowSchema>;

// ─── Apelidos ────────────────────────────────────────────────────────

export const transactionAliasRowSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  trigger: z.string(),
  triggerNormalized: z.string(),
  description: z.string().nullable(),
  notes: z.string().nullable(),
  amountCents: z.coerce.bigint().nullable(),
  categoryId: z.string().nullable(),
  subcategoryId: z.string().nullable(),
  institutionId: z.string().nullable(),
  institutionText: z.string().nullable(),
  responsiblePartyId: z.string().nullable(),
  expenseType: z.nativeEnum(TransactionExpenseType).nullable(),
  paymentMethod: z.nativeEnum(TransactionPaymentMethod).nullable(),
  investmentType: z.string().nullable(),
  cardInstallment: z.string().nullable(),
  isPending: z.boolean().nullable(),
  isFavorite: z.boolean().nullable(),
  originalCurrency: z.string().nullable(),
  originalAmountCents: z.coerce.bigint().nullable(),
  exchangeRate: z.string().nullable(),
  archivedAt: z.string().nullable(),
  createdById: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TransactionAliasRow = z.infer<typeof transactionAliasRowSchema>;

export const transactionAliasTagRowSchema = z.object({
  aliasId: z.string(),
  tagId: z.string(),
});
export type TransactionAliasTagRow = z.infer<typeof transactionAliasTagRowSchema>;

// ─── Metas ───────────────────────────────────────────────────────────

// Retrocompat (Spec 25): backups antigos gravavam as 5 dimensões como FKs ESCALARES
// (sectionId/categoryId/memberUserId/institutionId/tableTypeId). O formato novo grava
// ARRAYS (sectionIds/...). Este `preprocess` normaliza escalar → array de 1 (ou [] se
// null/ausente) ANTES de validar, então o schema canônico abaixo só conhece os arrays.
// Se o array novo já estiver presente, ele vence.
function legacyDimToArray(scalar: unknown, array: unknown): string[] {
  if (Array.isArray(array)) return array.filter((v): v is string => typeof v === "string");
  return typeof scalar === "string" ? [scalar] : [];
}

export const budgetRowSchema = z.preprocess(
  (val) => {
    if (!val || typeof val !== "object" || Array.isArray(val)) return val;
    const b = val as Record<string, unknown>;
    return {
      ...b,
      sectionIds: legacyDimToArray(b.sectionId, b.sectionIds),
      categoryIds: legacyDimToArray(b.categoryId, b.categoryIds),
      memberUserIds: legacyDimToArray(b.memberUserId, b.memberUserIds),
      institutionIds: legacyDimToArray(b.institutionId, b.institutionIds),
      tableTypeIds: legacyDimToArray(b.tableTypeId, b.tableTypeIds),
    };
  },
  z.object({
    id: z.string(),
    accountId: z.string(),
    name: z.string().nullable(),
    sectionIds: z.array(z.string()),
    categoryIds: z.array(z.string()),
    memberUserIds: z.array(z.string()),
    institutionIds: z.array(z.string()),
    tableTypeIds: z.array(z.string()),
    amountCents: z.coerce.bigint(),
    alertThresholdPercent: z.number().int(),
    isRecurring: z.boolean(),
    showInSummary: z.boolean(),
    year: z.number().int().nullable(),
    month: z.number().int().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
);
export type BudgetRow = z.infer<typeof budgetRowSchema>;

// ─── Visualizações (dashboards) ─────────────────────────────────────

export const dashboardLayoutRowSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  context: z.nativeEnum(DashboardLayoutContext),
  widgets: z.unknown(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type DashboardLayoutRow = z.infer<typeof dashboardLayoutRowSchema>;

// ─── Checklist mensal ────────────────────────────────────────────────

export const checklistItemRowSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  label: z.string(),
  position: z.number().int(),
  createdById: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ChecklistItemRow = z.infer<typeof checklistItemRowSchema>;

export const checklistCompletionRowSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  itemId: z.string(),
  monthId: z.string(),
  completedById: z.string(),
  transactionId: z.string().nullable(),
  createdAt: z.string(),
});
export type ChecklistCompletionRow = z.infer<typeof checklistCompletionRowSchema>;

// ─── Patrimônio (net worth) ──────────────────────────────────────────

export const balanceAccountRowSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  kind: z.nativeEnum(BalanceAccountKind),
  name: z.string(),
  institutionId: z.string().nullable(),
  archivedAt: z.string().nullable(),
  createdById: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type BalanceAccountRow = z.infer<typeof balanceAccountRowSchema>;

export const balanceSnapshotRowSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  balanceAccountId: z.string(),
  balanceCents: z.coerce.bigint(),
  capturedOn: z.string(),
  createdById: z.string(),
  createdAt: z.string(),
});
export type BalanceSnapshotRow = z.infer<typeof balanceSnapshotRowSchema>;

// ─── Snapshot completo ───────────────────────────────────────────────

export const accountSnapshotDataSchema = z.object({
  responsibleParties: z.array(responsiblePartyRowSchema),
  responsiblePartyMembers: z.array(responsiblePartyMemberRowSchema),
  tableTypes: z.array(tableTypeRowSchema),
  sections: z.array(sectionRowSchema),
  categories: z.array(categoryRowSchema),
  subcategories: z.array(subcategoryRowSchema),
  institutions: z.array(institutionRowSchema),
  tags: z.array(tagRowSchema),
  csvTemplates: z.array(csvTemplateRowSchema),
  months: z.array(monthRowSchema),
  tableTemplates: z.array(tableTemplateRowSchema),
  tableTemplateItems: z.array(tableTemplateItemRowSchema),
  installmentGroups: z.array(installmentGroupRowSchema),
  pendingInstallments: z.array(pendingInstallmentRowSchema),
  financeTables: z.array(financeTableRowSchema),
  transactions: z.array(transactionRowSchema),
  transactionTags: z.array(transactionTagRowSchema),
  transactionLinks: z.array(transactionLinkRowSchema),
  transactionAliases: z.array(transactionAliasRowSchema),
  transactionAliasTags: z.array(transactionAliasTagRowSchema),
  budgets: z.array(budgetRowSchema),
  dashboardLayouts: z.array(dashboardLayoutRowSchema),
  checklistItems: z.array(checklistItemRowSchema),
  checklistCompletions: z.array(checklistCompletionRowSchema),
  balanceAccounts: z.array(balanceAccountRowSchema),
  balanceSnapshots: z.array(balanceSnapshotRowSchema),
});
export type AccountSnapshotData = z.infer<typeof accountSnapshotDataSchema>;

export const accountSnapshotSchema = z.object({
  formatVersion: z.literal(1),
  app: z.literal("myaccountant"),
  exportedAt: z.string(),
  account: z.object({
    name: z.string(),
    settings: accountSettingsSnapshotSchema,
  }),
  data: accountSnapshotDataSchema,
});

export type AccountSnapshot = z.infer<typeof accountSnapshotSchema>;
