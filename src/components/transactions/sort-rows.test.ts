// Spec 69 §2.1 — `TableType.defaultSort` ganhou consumidor: a tabela do mês
// abre na ordenação do tipo, e o ciclo do cabeçalho volta para ELA (não mais
// para um `occurredOn/desc` escrito no código).
import { describe, expect, it } from "vitest";

import {
  FALLBACK_SORT,
  installmentLabel,
  isCustomSort,
  nextSortState,
  sortRows,
  type SortLookups,
} from "./sort-rows";
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

const LOOKUPS: SortLookups = {
  categoryById: new Map([
    ["cat-1", "Alimentação"],
    ["cat-2", "Moradia"],
  ]),
  subcategoryById: new Map([["sub-1", "Mercado"]]),
  institutionById: new Map([["inst-1", "Nubank"]]),
  partyById: new Map([
    ["party-1", "Gabriel"],
    ["party-2", "Ana"],
  ]),
};

const ids = (rows: TxRow[]) => rows.map((r) => r.id);

describe("sortRows — ordenação inicial vinda do tipo de tabela", () => {
  const rows = [
    tx({ id: "a", occurredOn: "2026-03-01", amountCents: "300" }),
    tx({ id: "b", occurredOn: "2026-03-20", amountCents: "-100" }),
    tx({ id: "c", occurredOn: "2026-03-10", amountCents: "200" }),
  ];

  it("data crescente e decrescente são ordens opostas de verdade", () => {
    expect(ids(sortRows(rows, { key: "occurredOn", dir: "asc" }, LOOKUPS))).toEqual([
      "a",
      "c",
      "b",
    ]);
    expect(ids(sortRows(rows, { key: "occurredOn", dir: "desc" }, LOOKUPS))).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("valor compara em BigInt — negativo antes de positivo, sem passar por Number", () => {
    expect(ids(sortRows(rows, { key: "amount", dir: "asc" }, LOOKUPS))).toEqual(["b", "c", "a"]);
  });

  it("valor gigante (fora do alcance seguro de Number) ainda ordena certo", () => {
    const big = [
      tx({ id: "hi", amountCents: "9007199254740993" }),
      tx({ id: "lo", amountCents: "9007199254740992" }),
    ];
    expect(ids(sortRows(big, { key: "amount", dir: "asc" }, LOOKUPS))).toEqual(["lo", "hi"]);
  });

  it("colunas por rótulo (categoria, responsável) ordenam pelo NOME, não pelo id", () => {
    const byName = [
      tx({ id: "moradia", categoryId: "cat-2", responsiblePartyId: "party-1" }),
      tx({ id: "alimentacao", categoryId: "cat-1", responsiblePartyId: "party-2" }),
    ];
    expect(ids(sortRows(byName, { key: "category", dir: "asc" }, LOOKUPS))).toEqual([
      "alimentacao",
      "moradia",
    ]);
    // Ana < Gabriel — se ordenasse por id, "party-1" viria primeiro.
    expect(ids(sortRows(byName, { key: "responsibleUser", dir: "asc" }, LOOKUPS))).toEqual([
      "alimentacao",
      "moradia",
    ]);
  });

  it("não muta o array de entrada", () => {
    const original = [...rows];
    sortRows(rows, { key: "amount", dir: "desc" }, LOOKUPS);
    expect(rows).toEqual(original);
  });

  it("é estável: empate preserva a ordem que veio do servidor", () => {
    const tied = [
      tx({ id: "primeiro", occurredOn: "2026-03-05" }),
      tx({ id: "segundo", occurredOn: "2026-03-05" }),
      tx({ id: "terceiro", occurredOn: "2026-03-05" }),
    ];
    expect(ids(sortRows(tied, { key: "occurredOn", dir: "asc" }, LOOKUPS))).toEqual([
      "primeiro",
      "segundo",
      "terceiro",
    ]);
  });
});

describe("nextSortState — o clique no cabeçalho volta ao padrão DO TIPO", () => {
  const typeDefault = { key: "amount", dir: "desc" } as const;

  it("coluna nova entra em crescente", () => {
    expect(nextSortState(typeDefault, "description", typeDefault)).toEqual({
      key: "description",
      dir: "asc",
    });
  });

  it("crescente → decrescente → padrão do tipo", () => {
    const asc = nextSortState(typeDefault, "description", typeDefault);
    const desc = nextSortState(asc, "description", typeDefault);
    expect(desc).toEqual({ key: "description", dir: "desc" });
    expect(nextSortState(desc, "description", typeDefault)).toEqual(typeDefault);
  });

  it("clicar na coluna que JÁ é o padrão decrescente nunca é um clique morto", () => {
    // O 3º passo devolveria o próprio estado atual; o ciclo recomeça em vez de
    // deixar o cabeçalho parecendo quebrado.
    expect(nextSortState(typeDefault, "amount", typeDefault)).toEqual({
      key: "amount",
      dir: "asc",
    });
  });
});

describe("isCustomSort — habilita o botão 'voltar à visualização padrão'", () => {
  const typeDefault = { key: "occurredOn", dir: "asc" } as const;

  it("igual ao tipo não é personalizado", () => {
    expect(isCustomSort({ key: "occurredOn", dir: "asc" }, typeDefault)).toBe(false);
  });

  it("mesma coluna em direção oposta JÁ é personalizado", () => {
    expect(isCustomSort({ key: "occurredOn", dir: "desc" }, typeDefault)).toBe(true);
  });
});

describe("FALLBACK_SORT — piso de quem não tem tipo de tabela", () => {
  it("é o comportamento de sempre: mais recente no topo", () => {
    expect(FALLBACK_SORT).toEqual({ key: "occurredOn", dir: "desc" });
  });
});

describe("installmentLabel", () => {
  it("grupo de parcelamento vira o badge n/total", () => {
    expect(
      installmentLabel(
        tx({ id: "x", installmentGroupId: "g1", installmentNumber: 3, installmentGroupCount: 12 }),
      ),
    ).toBe("3/12");
  });

  it("sem grupo, vale o texto livre legado", () => {
    expect(installmentLabel(tx({ id: "x", cardInstallment: "2/6" }))).toBe("2/6");
  });

  it("sem nenhum dos dois, não há parcela", () => {
    expect(installmentLabel(tx({ id: "x" }))).toBeNull();
  });
});
