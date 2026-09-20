// Spec 69 §2.1 — `TableType.groupBy` + `showGroupSubtotal` ganharam consumidor.
// O que se prova aqui é a REGRA: quem decide a dimensão (a precedência com o
// `groupByDate` da tabela), como os blocos são montados, onde cai quem não tem
// valor na dimensão, e que o subtotal soma em `BigInt`.
import { describe, expect, it } from "vitest";

import { m } from "@/lib/messages";

import { groupRows, resolveGrouping, type GroupLookups } from "./group-rows";
import type { TransactionRow as TxRow } from "./types";

function tx(overrides: Partial<TxRow> & { id: string }): TxRow {
  return {
    monthId: "month-1",
    occurredOn: "2026-03-10",
    amountCents: "1000",
    description: null,
    notes: null,
    isPending: false,
    isFavorite: false,
    categoryId: null,
    subcategoryId: null,
    institutionId: null,
    institutionText: null,
    responsiblePartyId: null,
    cardInstallment: null,
    investmentType: null,
    expenseType: null,
    paymentMethod: null,
    source: "manual",
    installmentGroupId: null,
    installmentNumber: null,
    installmentGroupCount: null,
    originalAmountCents: null,
    originalCurrency: null,
    exchangeRate: null,
    tags: [],
    linkCount: 0,
    createdById: "user-1",
    createdAt: "2026-03-10T00:00:00.000Z",
    updatedById: null,
    updatedAt: "2026-03-10T00:00:00.000Z",
    ...overrides,
  };
}

const LOOKUPS: GroupLookups = {
  categoryById: new Map([
    ["cat-1", "Alimentação"],
    ["cat-2", "Moradia"],
  ]),
  partyById: new Map([
    ["party-1", "Gabriel"],
    ["party-2", "Ana"],
  ]),
};

describe("resolveGrouping — precedência entre o tipo e o toggle da tabela", () => {
  it("o toggle ⋮ da tabela manda no eixo DATA, mesmo com o tipo em outra dimensão", () => {
    expect(resolveGrouping("category", true, "occurredOn")).toBe("date");
  });

  it("tipo em `date` + toggle desligado = a tabela não agrupa (o usuário desagrupou ESTA)", () => {
    expect(resolveGrouping("date", false, "occurredOn")).toBeNull();
  });

  it("toggle desligado não veta as OUTRAS dimensões — ele só fala de data", () => {
    expect(resolveGrouping("category", false, "occurredOn")).toBe("category");
    expect(resolveGrouping("responsible", false, "amount")).toBe("responsible");
    expect(resolveGrouping("installment", false, "description")).toBe("installment");
  });

  it("sem tipo e sem toggle, não há blocos", () => {
    expect(resolveGrouping(null, false, "occurredOn")).toBeNull();
  });

  it("agrupar por DATA continua suspenso quando a ordenação não é por data (regra de antes)", () => {
    expect(resolveGrouping(null, true, "amount")).toBeNull();
    expect(resolveGrouping(null, true, "occurredOn")).toBe("date");
  });
});

describe("groupRows — blocos por data (o agrupamento que já existia)", () => {
  it("um bloco por data, na ordem em que as linhas chegam, sem reordenar nada", () => {
    const rows = [
      tx({ id: "a", occurredOn: "2026-03-20" }),
      tx({ id: "b", occurredOn: "2026-03-20" }),
      tx({ id: "c", occurredOn: "2026-03-01" }),
    ];

    const groups = groupRows(rows, "date", LOOKUPS);

    expect(groups).toHaveLength(2);
    expect(groups[0].key).toBe("2026-03-20");
    expect(groups[0].label).toBe("20 de março");
    expect(groups[0].rows.map((r) => r.id)).toEqual(["a", "b"]);
    expect(groups[1].key).toBe("2026-03-01");
    expect(groups[1].rows.map((r) => r.id)).toEqual(["c"]);
    // Não existe "sem data": toda transação tem data.
    expect(groups.some((g) => g.isEmptyBucket)).toBe(false);
  });
});

describe("groupRows — blocos por categoria", () => {
  const rows = [
    tx({ id: "a", categoryId: "cat-1" }),
    tx({ id: "sem-1" }),
    tx({ id: "b", categoryId: "cat-2" }),
    tx({ id: "c", categoryId: "cat-1" }),
    tx({ id: "sem-2", categoryId: "cat-apagada" }),
  ];

  it("N blocos com o nome da categoria e o bloco 'sem' no FIM", () => {
    const groups = groupRows(rows, "category", LOOKUPS);

    expect(groups.map((g) => g.label)).toEqual(["Alimentação", "Moradia", "Sem categoria"]);
    expect(groups[0].rows.map((r) => r.id)).toEqual(["a", "c"]);
    expect(groups[1].rows.map((r) => r.id)).toEqual(["b"]);
    // Categoria apagada (id que não resolve para nome) cai no mesmo bloco de quem
    // não tem categoria — não vira um bloco fantasma com id cru no cabeçalho.
    expect(groups[2].rows.map((r) => r.id)).toEqual(["sem-1", "sem-2"]);
    expect(groups[2].isEmptyBucket).toBe(true);
    expect(groups[2].label).toBe(m.dashboards.members.uncategorized);
  });

  it("sem linhas órfãs, o bloco 'sem' não é criado", () => {
    const groups = groupRows([tx({ id: "a", categoryId: "cat-1" })], "category", LOOKUPS);
    expect(groups).toHaveLength(1);
    expect(groups.some((g) => g.isEmptyBucket)).toBe(false);
  });
});

describe("groupRows — blocos por responsável e por parcela", () => {
  it("responsável: nome da persona, e 'Sem responsável' no fim", () => {
    const groups = groupRows(
      [tx({ id: "a" }), tx({ id: "b", responsiblePartyId: "party-2" })],
      "responsible",
      LOOKUPS,
    );
    expect(groups.map((g) => g.label)).toEqual(["Ana", m.dashboards.members.unassigned]);
    expect(groups[1].rows.map((r) => r.id)).toEqual(["a"]);
  });

  it("parcela: agrupa pelo rótulo que a coluna Parcela exibe", () => {
    const groups = groupRows(
      [
        tx({
          id: "a",
          installmentGroupId: "g1",
          installmentNumber: 3,
          installmentGroupCount: 12,
        }),
        tx({ id: "b" }),
        tx({
          id: "c",
          installmentGroupId: "g2",
          installmentNumber: 3,
          installmentGroupCount: 12,
        }),
      ],
      "installment",
      LOOKUPS,
    );
    expect(groups.map((g) => g.label)).toEqual(["3/12", m.common.none]);
    expect(groups[0].rows.map((r) => r.id)).toEqual(["a", "c"]);
    expect(groups[1].rows.map((r) => r.id)).toEqual(["b"]);
  });
});

describe("groupRows — subtotal do bloco", () => {
  it("soma em BigInt, com positivos e negativos misturados", () => {
    const groups = groupRows(
      [
        tx({ id: "a", categoryId: "cat-1", amountCents: "-15050" }),
        tx({ id: "b", categoryId: "cat-1", amountCents: "20000" }),
        tx({ id: "c", categoryId: "cat-1", amountCents: "-4950" }),
        tx({ id: "d", categoryId: "cat-2", amountCents: "700" }),
      ],
      "category",
      LOOKUPS,
    );

    // -150,50 + 200,00 - 49,50 = 0,00 — o caso que uma soma em float erra.
    expect(groups[0].subtotalCents).toBe(0n);
    expect(groups[1].subtotalCents).toBe(700n);
  });

  it("soma valores acima do inteiro seguro de Number sem perder centavo", () => {
    const groups = groupRows(
      [
        tx({ id: "a", categoryId: "cat-1", amountCents: "9007199254740993" }),
        tx({ id: "b", categoryId: "cat-1", amountCents: "1" }),
      ],
      "category",
      LOOKUPS,
    );
    expect(groups[0].subtotalCents).toBe(9007199254740994n);
  });
});
