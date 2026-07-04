import type {
  TransactionExpenseType,
  TransactionPaymentMethod,
  TransactionSource,
} from "@prisma/client";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Fonte única dos campos filtráveis de transação (Parte A — paridade de filtros).
//
// Por quê este módulo existe: as 3 superfícies de filtro (drawer do mês, widget
// filtered-transactions, widget analysis) divergiram porque cada uma declarava seus
// enums e campos isoladamente. Aqui centralizamos os VALORES de enum e o CONTRATO de
// campos filtráveis. O `where` Prisma e o predicado client-side continuam explícitos em
// cada superfície (diferença de execução essencial — ver specs/19), mas todos consomem
// os mesmos valores daqui.
//
// IMPORTANTE (client-safe): este módulo é importado por client components
// (TransactionFilterDrawer). NÃO pode ter dependência runtime de `@prisma/client`.
// Por isso os valores são literais; o `import type` + `satisfies` garante drift-safety
// em tempo de compilação (erra se um valor não existir mais no enum Prisma).
// ─────────────────────────────────────────────────────────────────────────────

export const EXPENSE_TYPE_VALUES = [
  "fixed",
  "variable",
  "one_time",
] as const satisfies readonly TransactionExpenseType[];

export const PAYMENT_METHOD_VALUES = [
  "pix",
  "cash",
  "credit_card",
  "debit_card",
  "bank_transfer",
  "boleto",
  "other",
] as const satisfies readonly TransactionPaymentMethod[];

export const SOURCE_VALUES = [
  "manual",
  "csv_import",
  "xlsx_import",
  "template",
  "auto_template",
  "duplicate",
] as const satisfies readonly TransactionSource[];

export type ExpenseTypeValue = (typeof EXPENSE_TYPE_VALUES)[number];
export type PaymentMethodValue = (typeof PAYMENT_METHOD_VALUES)[number];
export type SourceValue = (typeof SOURCE_VALUES)[number];

// Drift protection é em duas camadas:
//  • compile-time: o `satisfies readonly Transaction…[]` acima erra se um valor não existir
//    mais no enum Prisma (protege contra typo/valor removido);
//  • runtime: fields.test.ts compara cada array com `Object.values(<enum Prisma>)` — pega
//    valor faltando OU sobrando. Juntas impedem a assimetria de enums voltar.

// ─── Contrato de campos filtráveis (o conjunto-alvo de paridade) ─────────────────
// Consumido pelos testes de paridade (garante que cada superfície cobre todos os campos)
// e pela documentação. Os builders de `where`/predicado ficam em cada superfície.

export type FilterFieldKey =
  | "categories"
  | "institutions"
  | "responsible"
  | "pending"
  | "favorite"
  | "expenseTypes"
  | "sources"
  | "tags"
  | "paymentMethods";

export type FilterFieldKind = "enum" | "relation" | "boolean";
export type FilterOptionSource = "category" | "institution" | "tag" | "party";

export type FilterFieldDescriptor = {
  key: FilterFieldKey;
  kind: FilterFieldKind;
  /** kind === "enum": valores válidos (fonte única acima). */
  enumValues?: readonly string[];
  /** kind === "relation": de onde vêm as opções {id, name}. */
  optionSource?: FilterOptionSource;
  /** Coluna/relação Prisma em Transaction — usada por `where` e dimensões do sandbox. */
  prismaField: string;
};

export const TRANSACTION_FILTER_FIELDS: Record<FilterFieldKey, FilterFieldDescriptor> = {
  categories: {
    key: "categories",
    kind: "relation",
    optionSource: "category",
    prismaField: "categoryId",
  },
  institutions: {
    key: "institutions",
    kind: "relation",
    optionSource: "institution",
    prismaField: "institutionId",
  },
  responsible: {
    key: "responsible",
    kind: "relation",
    optionSource: "party",
    prismaField: "responsiblePartyId",
  },
  tags: { key: "tags", kind: "relation", optionSource: "tag", prismaField: "tags" },
  expenseTypes: {
    key: "expenseTypes",
    kind: "enum",
    enumValues: EXPENSE_TYPE_VALUES,
    prismaField: "expenseType",
  },
  sources: { key: "sources", kind: "enum", enumValues: SOURCE_VALUES, prismaField: "source" },
  paymentMethods: {
    key: "paymentMethods",
    kind: "enum",
    enumValues: PAYMENT_METHOD_VALUES,
    prismaField: "paymentMethod",
  },
  pending: { key: "pending", kind: "boolean", prismaField: "isPending" },
  favorite: { key: "favorite", kind: "boolean", prismaField: "isFavorite" },
};

export const TRANSACTION_FILTER_KEYS = Object.keys(TRANSACTION_FILTER_FIELDS) as FilterFieldKey[];

// ─── Builders de fragmento Zod (sugar reutilizável) ──────────────────────────────
// Mantém o SHAPE dos campos consistente entre os schemas (mesmo que os nomes dos campos
// difiram por superfície — ex.: `categories` no widget vs `filterCategoryIds` no sandbox).

/** Array de ids de relação (categoria/instituição/party/tag). */
export const idArrayField = () => z.array(z.string()).default([]);

/** Array de valores de enum de transação, restrito aos valores da fonte única. */
export const enumArrayField = <const T extends readonly [string, ...string[]]>(values: T) =>
  z.array(z.enum(values)).default([]);

/** Flag booleana de filtro (pending/favorite), default desligado. */
export const boolFilterField = () => z.boolean().default(false);
