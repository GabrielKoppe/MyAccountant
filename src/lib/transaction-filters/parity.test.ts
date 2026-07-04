import { describe, it, expect } from "vitest";
import type { z } from "zod";

import { EMPTY_FILTERS } from "@/components/months/MonthFilterContext";
import { sandboxConfigSchema } from "@/lib/schemas/sandbox";
import { filteredTransactionsConfigSchema } from "@/lib/schemas/widget-config";

import { TRANSACTION_FILTER_KEYS, type FilterFieldKey } from "./fields";

// ─────────────────────────────────────────────────────────────────────────────
// Teste de PARIDADE entre as 3 superfícies de filtro (o objetivo da Parte A).
//
// Cada superfície nomeia os campos de forma diferente (drawer usa `tagIds`, o sandbox usa
// `filterTagIds`, etc.), então mapeamos o campo canônico (TRANSACTION_FILTER_FIELDS) → o nome
// em cada superfície. Os mapas são `Record<FilterFieldKey, ...>`: adicionar um filtro novo ao
// descriptor QUEBRA A COMPILAÇÃO até ser mapeado nas 3 superfícies — é o que impede a
// assimetria (drawer 8/9, filtered 5/9, analysis 2/9) de voltar.
// ─────────────────────────────────────────────────────────────────────────────

const DRAWER_FIELD: Record<FilterFieldKey, keyof typeof EMPTY_FILTERS> = {
  categories: "categories",
  institutions: "institutions",
  responsible: "responsible",
  pending: "pending",
  favorite: "favorite",
  expenseTypes: "expenseTypes",
  sources: "sources",
  tags: "tagIds",
  paymentMethods: "paymentMethods",
};

const FILTERED_FIELD: Record<FilterFieldKey, string> = {
  categories: "categories",
  institutions: "institutions",
  responsible: "responsible",
  pending: "pending",
  favorite: "favorite",
  expenseTypes: "expenseTypes",
  sources: "sources",
  tags: "tags",
  paymentMethods: "paymentMethods",
};

const SANDBOX_FIELD: Record<FilterFieldKey, string> = {
  categories: "filterCategoryIds",
  institutions: "filterInstitutionIds",
  responsible: "filterMemberIds",
  pending: "filterPending",
  favorite: "filterFavorite",
  expenseTypes: "filterExpenseTypes",
  sources: "filterSources",
  tags: "filterTagIds",
  paymentMethods: "filterPaymentMethods",
};

const filteredShape = filteredTransactionsConfigSchema.shape;
// sandboxConfigSchema é um ZodEffects (tem .refine) → o objeto base fica em _def.schema.
const sandboxShape = (
  sandboxConfigSchema as unknown as { _def: { schema: z.ZodObject<z.ZodRawShape> } }
)._def.schema.shape;

describe("cross-surface filter parity (9-field target)", () => {
  it("descriptor exposes exactly the 9 target fields", () => {
    expect(TRANSACTION_FILTER_KEYS).toHaveLength(9);
  });

  it("month drawer state covers every canonical filter field", () => {
    for (const key of TRANSACTION_FILTER_KEYS) {
      expect(EMPTY_FILTERS).toHaveProperty(DRAWER_FIELD[key]);
    }
  });

  it("filtered-transactions config schema covers every canonical filter field", () => {
    for (const key of TRANSACTION_FILTER_KEYS) {
      expect(filteredShape).toHaveProperty(FILTERED_FIELD[key]);
    }
  });

  it("analysis/sandbox config schema covers every canonical filter field", () => {
    for (const key of TRANSACTION_FILTER_KEYS) {
      expect(sandboxShape).toHaveProperty(SANDBOX_FIELD[key]);
    }
  });
});
