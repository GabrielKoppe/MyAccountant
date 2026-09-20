import { describe, expect, it } from "vitest";

import {
  LOCKED_COLUMN_KEYS,
  PINNABLE_COLUMNS,
  TABLE_COLUMN_KEYS,
  hiddenColumnsFromVisible,
  isPinnableColumnKey,
  normalizeVisibleColumns,
  parseVisibleColumns,
  resolvePinnedColumns,
  visibleColumnsFromHidden,
} from "./table-columns";

describe("ordem canônica", () => {
  it("é a do frame (tela 05) e a mesma do backfill SQL", () => {
    expect([...TABLE_COLUMN_KEYS]).toEqual([
      "occurredOn",
      "description",
      "category",
      "subcategory",
      "institution",
      "paymentMethod",
      "responsibleUser",
      "isPending",
      "cardInstallment",
      "investmentType",
      "expenseType",
      "tags",
      "notes",
      "amount",
    ]);
  });

  it("as colunas estruturais são data, descrição e valor", () => {
    expect([...LOCKED_COLUMN_KEYS]).toEqual(["occurredOn", "description", "amount"]);
  });
});

describe("visibleColumnsFromHidden", () => {
  it("sem nada oculto devolve a ordem canônica inteira", () => {
    expect(visibleColumnsFromHidden({})).toEqual([...TABLE_COLUMN_KEYS]);
  });

  it("remove as marcadas como true e preserva a ordem canônica", () => {
    expect(visibleColumnsFromHidden({ subcategory: true, tags: true })).toEqual([
      "occurredOn",
      "description",
      "category",
      "institution",
      "paymentMethod",
      "responsibleUser",
      "isPending",
      "cardInstallment",
      "investmentType",
      "expenseType",
      "notes",
      "amount",
    ]);
  });

  it("`false` e ausência significam visível", () => {
    expect(visibleColumnsFromHidden({ notes: false })).toContain("notes");
  });

  it("null/undefined caem em 'nada oculto'", () => {
    expect(visibleColumnsFromHidden(null)).toEqual([...TABLE_COLUMN_KEYS]);
    expect(visibleColumnsFromHidden(undefined)).toEqual([...TABLE_COLUMN_KEYS]);
  });

  it("coluna locked nunca some, mesmo marcada como oculta no mapa", () => {
    const visible = visibleColumnsFromHidden({ amount: true, occurredOn: true } as Record<
      string,
      boolean
    >);
    expect(visible).toContain("amount");
    expect(visible).toContain("occurredOn");
  });
});

describe("hiddenColumnsFromVisible", () => {
  it("é o inverso exato de visibleColumnsFromHidden", () => {
    const hidden = { subcategory: true, tags: true };
    expect(hiddenColumnsFromVisible(visibleColumnsFromHidden(hidden))).toEqual(hidden);
  });

  it("só grava as ocultas (forma compacta), nunca `false`", () => {
    const map = hiddenColumnsFromVisible([...TABLE_COLUMN_KEYS]);
    expect(map).toEqual({});
  });

  it("nunca marca coluna locked como oculta", () => {
    const map = hiddenColumnsFromVisible(["category"]);
    expect(map).not.toHaveProperty("occurredOn");
    expect(map).not.toHaveProperty("description");
    expect(map).not.toHaveProperty("amount");
    expect(map).toHaveProperty("notes", true);
  });
});

describe("normalizeVisibleColumns", () => {
  it("preserva a ordem escolhida pelo usuário", () => {
    expect(
      normalizeVisibleColumns(["occurredOn", "description", "tags", "category", "amount"]),
    ).toEqual(["occurredOn", "description", "tags", "category", "amount"]);
  });

  it("descarta chave desconhecida", () => {
    expect(
      normalizeVisibleColumns(["occurredOn", "chaveInventada", "description", "amount"]),
    ).toEqual(["occurredOn", "description", "amount"]);
  });

  it("descarta valores que nem são string", () => {
    expect(normalizeVisibleColumns(["occurredOn", 42, null, { key: "amount" }])).toEqual([
      "occurredOn",
      "description",
      "amount",
    ]);
  });

  it("remove duplicatas mantendo a primeira ocorrência", () => {
    expect(
      normalizeVisibleColumns(["amount", "category", "amount", "category", "occurredOn"]),
    ).toEqual(["description", "amount", "category", "occurredOn"]);
  });

  it("reinsere as locked que faltarem, na posição canônica relativa", () => {
    expect(normalizeVisibleColumns(["category"])).toEqual([
      "occurredOn",
      "description",
      "category",
      "amount",
    ]);
  });

  it("não duplica locked já presente", () => {
    const result = normalizeVisibleColumns(["amount", "occurredOn", "description"]);
    expect(result.filter((k) => k === "amount")).toHaveLength(1);
    expect(result).toHaveLength(3);
  });

  it("entrada vazia vira só as três estruturais", () => {
    expect(normalizeVisibleColumns([])).toEqual(["occurredOn", "description", "amount"]);
  });

  it("entrada que não é array não explode", () => {
    expect(normalizeVisibleColumns(null)).toEqual(["occurredOn", "description", "amount"]);
    expect(normalizeVisibleColumns("occurredOn")).toEqual(["occurredOn", "description", "amount"]);
  });
});

describe("parseVisibleColumns", () => {
  it("array vazio no banco significa 'nunca configurado' e cai no hiddenColumns", () => {
    expect(parseVisibleColumns([], { tags: true })).toEqual(
      visibleColumnsFromHidden({ tags: true }),
    );
  });

  it("null no banco cai no hiddenColumns", () => {
    expect(parseVisibleColumns(null, { notes: true })).toEqual(
      visibleColumnsFromHidden({ notes: true }),
    );
  });

  it("array preenchido manda, normalizado", () => {
    expect(parseVisibleColumns(["category", "lixo"], { category: true })).toEqual([
      "occurredOn",
      "description",
      "category",
      "amount",
    ]);
  });
});

describe("colunas fixáveis (Spec 69 §16)", () => {
  it("são só as duas de identificação, e são chaves reais da tabela", () => {
    expect(PINNABLE_COLUMNS).toEqual(["occurredOn", "description"]);
    for (const key of PINNABLE_COLUMNS) {
      expect(TABLE_COLUMN_KEYS).toContain(key);
    }
  });

  it("são um PREFIXO da ordem canônica — é o que permite somar `left` sem medir", () => {
    expect(TABLE_COLUMN_KEYS.slice(0, PINNABLE_COLUMNS.length)).toEqual([...PINNABLE_COLUMNS]);
  });

  it("toda coluna fixável é `locked` — nunca some da tela por baixo do painel congelado", () => {
    for (const key of PINNABLE_COLUMNS) {
      expect(LOCKED_COLUMN_KEYS).toContain(key);
    }
  });

  it("isPinnableColumnKey só aceita as duas", () => {
    expect(isPinnableColumnKey("occurredOn")).toBe(true);
    expect(isPinnableColumnKey("description")).toBe(true);
    expect(isPinnableColumnKey("amount")).toBe(false);
    expect(isPinnableColumnKey(null)).toBe(false);
  });

  it("resolvePinnedColumns respeita a ordem das VISÍVEIS, não a do gravado", () => {
    const visible = visibleColumnsFromHidden({});
    expect(resolvePinnedColumns(["description", "occurredOn"], visible)).toEqual([
      "occurredOn",
      "description",
    ]);
    // ordem invertida nas visíveis → a presa segue a tela
    expect(
      resolvePinnedColumns(["occurredOn", "description"], ["description", "occurredOn"]),
    ).toEqual(["description", "occurredOn"]);
  });

  it("coluna fora das visíveis não é presa", () => {
    expect(resolvePinnedColumns(["occurredOn", "description"], ["occurredOn"])).toEqual([
      "occurredOn",
    ]);
  });
});
