import {
  TransactionExpenseType,
  TransactionPaymentMethod,
  TransactionSource,
} from "@prisma/client";
import { describe, it, expect } from "vitest";

import {
  EXPENSE_TYPE_VALUES,
  PAYMENT_METHOD_VALUES,
  SOURCE_VALUES,
  TRANSACTION_FILTER_FIELDS,
  TRANSACTION_FILTER_KEYS,
} from "./fields";

// Drift em runtime: complementa o guard de compile-time (satisfies + Exact) — falha se
// alguém adicionar/remover um valor no enum Prisma sem atualizar a fonte única.
describe("transaction filter single-source enums", () => {
  it("EXPENSE_TYPE_VALUES matches the Prisma enum exactly", () => {
    expect(new Set<string>(EXPENSE_TYPE_VALUES)).toEqual(
      new Set(Object.values(TransactionExpenseType)),
    );
  });
  it("PAYMENT_METHOD_VALUES matches the Prisma enum exactly", () => {
    expect(new Set<string>(PAYMENT_METHOD_VALUES)).toEqual(
      new Set(Object.values(TransactionPaymentMethod)),
    );
  });
  it("SOURCE_VALUES matches the Prisma enum exactly", () => {
    expect(new Set<string>(SOURCE_VALUES)).toEqual(new Set(Object.values(TransactionSource)));
  });
});

describe("TRANSACTION_FILTER_FIELDS descriptor", () => {
  it("covers the full 9-field parity target", () => {
    expect([...TRANSACTION_FILTER_KEYS].sort()).toEqual(
      [
        "categories",
        "expenseTypes",
        "favorite",
        "institutions",
        "paymentMethods",
        "pending",
        "responsible",
        "sources",
        "tags",
      ].sort(),
    );
  });

  it("enum fields carry values; relation fields carry an option source; all have a prismaField", () => {
    for (const f of Object.values(TRANSACTION_FILTER_FIELDS)) {
      expect(f.prismaField).toBeTruthy();
      if (f.kind === "enum") expect(f.enumValues?.length ?? 0).toBeGreaterThan(0);
      if (f.kind === "relation") expect(f.optionSource).toBeTruthy();
    }
  });
});
