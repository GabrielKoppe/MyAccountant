import { type Mock, describe, expect, it } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";
import { NotFoundError } from "@/server/api/errors";

import { USAGE_COUNT_TTL_MS, countUsage } from "./settings-usage-service";

const ACCOUNT_ID = "acc-test-1";
const CATEGORY_ID = "ccategory0000000000000aa";
const NOW = new Date("2026-08-09T12:00:00.000Z");

/** Linha de cache com `countedAt` a `ageMs` do instante de referência. */
function cachedRow(ageMs: number, over: { transactions?: number; months?: number } = {}) {
  return {
    transactions: over.transactions ?? 42,
    months: over.months ?? 5,
    countedAt: new Date(NOW.getTime() - ageMs),
  };
}

/** Prepara a varredura: N transações espalhadas por `monthIds`. */
function mockScan(transactions: number, monthIds: string[]) {
  prismaMock.transaction.count.mockResolvedValue(transactions);
  // `groupBy` do Prisma tem assinatura genérica demais para o deep mock expor
  // `mockResolvedValue` — mesmo cast já usado em `cashflow-forecast.test.ts`.
  (prismaMock.transaction.groupBy as unknown as Mock).mockResolvedValue(
    monthIds.map((monthId) => ({ monthId })),
  );
  prismaMock.usageCount.upsert.mockResolvedValue({} as never);
}

describe("countUsage — cache de 24 h", () => {
  it("cache quente devolve fromCache=true e NÃO consulta Transaction", async () => {
    prismaMock.usageCount.findUnique.mockResolvedValue(cachedRow(60 * 60 * 1000) as never);

    const result = await countUsage({
      accountId: ACCOUNT_ID,
      entity: "category",
      entityId: CATEGORY_ID,
      now: NOW,
    });

    expect(result).toEqual({
      transactions: 42,
      months: 5,
      countedAt: new Date(NOW.getTime() - 60 * 60 * 1000),
      fromCache: true,
    });
    expect(prismaMock.transaction.count).not.toHaveBeenCalled();
    expect(prismaMock.transaction.groupBy).not.toHaveBeenCalled();
    expect(prismaMock.usageCount.upsert).not.toHaveBeenCalled();
    // Nem sequer confere a posse: a linha de cache já é escopada por accountId.
    expect(prismaMock.category.count).not.toHaveBeenCalled();
  });

  it("cache frio conta e faz upsert com fromCache=false", async () => {
    prismaMock.usageCount.findUnique.mockResolvedValue(null as never);
    prismaMock.category.count.mockResolvedValue(1);
    mockScan(7, ["m1", "m2", "m3"]);

    const result = await countUsage({
      accountId: ACCOUNT_ID,
      entity: "category",
      entityId: CATEGORY_ID,
      now: NOW,
    });

    expect(result).toEqual({ transactions: 7, months: 3, countedAt: NOW, fromCache: false });
    expect(prismaMock.usageCount.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          accountId_entity_entityId: {
            accountId: ACCOUNT_ID,
            entity: "category",
            entityId: CATEGORY_ID,
          },
        },
        create: expect.objectContaining({
          accountId: ACCOUNT_ID,
          entity: "category",
          entityId: CATEGORY_ID,
          transactions: 7,
          months: 3,
          countedAt: NOW,
        }),
        update: expect.objectContaining({ transactions: 7, months: 3, countedAt: NOW }),
      }),
    );
  });

  it("force ignora o cache quente e reconta", async () => {
    prismaMock.usageCount.findUnique.mockResolvedValue(cachedRow(60 * 1000) as never);
    prismaMock.category.count.mockResolvedValue(1);
    mockScan(9, ["m1"]);

    const result = await countUsage({
      accountId: ACCOUNT_ID,
      entity: "category",
      entityId: CATEGORY_ID,
      force: true,
      now: NOW,
    });

    expect(result).toEqual({ transactions: 9, months: 1, countedAt: NOW, fromCache: false });
    // Com force nem lê a linha: iria descartá-la de qualquer forma.
    expect(prismaMock.usageCount.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.transaction.count).toHaveBeenCalledTimes(1);
    expect(prismaMock.usageCount.upsert).toHaveBeenCalledTimes(1);
  });

  it("cache expirado (25 h) reconta", async () => {
    prismaMock.usageCount.findUnique.mockResolvedValue(cachedRow(25 * 60 * 60 * 1000) as never);
    prismaMock.category.count.mockResolvedValue(1);
    mockScan(3, ["m1", "m2"]);

    const result = await countUsage({
      accountId: ACCOUNT_ID,
      entity: "category",
      entityId: CATEGORY_ID,
      now: NOW,
    });

    expect(result).toEqual({ transactions: 3, months: 2, countedAt: NOW, fromCache: false });
    expect(prismaMock.transaction.count).toHaveBeenCalledTimes(1);
  });

  it("a borda do TTL é exatamente USAGE_COUNT_TTL_MS: no limite já reconta", async () => {
    prismaMock.usageCount.findUnique.mockResolvedValue(cachedRow(USAGE_COUNT_TTL_MS) as never);
    prismaMock.category.count.mockResolvedValue(1);
    mockScan(1, ["m1"]);

    const result = await countUsage({
      accountId: ACCOUNT_ID,
      entity: "category",
      entityId: CATEGORY_ID,
      now: NOW,
    });

    expect(result.fromCache).toBe(false);
  });

  it("contagem zero é cacheada igual — não reconta a cada abertura do modal", async () => {
    prismaMock.usageCount.findUnique.mockResolvedValue(null as never);
    prismaMock.category.count.mockResolvedValue(1);
    mockScan(0, []);

    const first = await countUsage({
      accountId: ACCOUNT_ID,
      entity: "category",
      entityId: CATEGORY_ID,
      now: NOW,
    });

    expect(first).toEqual({ transactions: 0, months: 0, countedAt: NOW, fromCache: false });
    expect(prismaMock.usageCount.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ transactions: 0, months: 0 }),
      }),
    );

    // Segunda abertura, com a linha zerada já em cache: serve do cache.
    prismaMock.usageCount.findUnique.mockResolvedValue(
      cachedRow(1000, { transactions: 0, months: 0 }) as never,
    );
    prismaMock.transaction.count.mockClear();

    const second = await countUsage({
      accountId: ACCOUNT_ID,
      entity: "category",
      entityId: CATEGORY_ID,
      now: NOW,
    });

    expect(second.fromCache).toBe(true);
    expect(second.transactions).toBe(0);
    expect(prismaMock.transaction.count).not.toHaveBeenCalled();
  });
});

describe("countUsage — multi-tenancy", () => {
  it("objeto de outra conta não é contado nem cacheado (NotFoundError)", async () => {
    prismaMock.usageCount.findUnique.mockResolvedValue(null as never);
    // A categoria existe no banco, mas não nesta conta → count com accountId = 0.
    prismaMock.category.count.mockResolvedValue(0);

    await expect(
      countUsage({
        accountId: ACCOUNT_ID,
        entity: "category",
        entityId: CATEGORY_ID,
        now: NOW,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(prismaMock.category.count).toHaveBeenCalledWith({
      where: { id: CATEGORY_ID, accountId: ACCOUNT_ID },
    });
    expect(prismaMock.transaction.count).not.toHaveBeenCalled();
    expect(prismaMock.transaction.groupBy).not.toHaveBeenCalled();
    expect(prismaMock.usageCount.upsert).not.toHaveBeenCalled();
  });

  it("a leitura do cache é escopada por accountId", async () => {
    prismaMock.usageCount.findUnique.mockResolvedValue(cachedRow(1000) as never);

    await countUsage({
      accountId: ACCOUNT_ID,
      entity: "category",
      entityId: CATEGORY_ID,
      now: NOW,
    });

    expect(prismaMock.usageCount.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          accountId_entity_entityId: {
            accountId: ACCOUNT_ID,
            entity: "category",
            entityId: CATEGORY_ID,
          },
        },
      }),
    );
  });

  it("a varredura de Transaction sempre filtra por accountId", async () => {
    prismaMock.usageCount.findUnique.mockResolvedValue(null as never);
    prismaMock.section.count.mockResolvedValue(1);
    mockScan(4, ["m1"]);

    await countUsage({
      accountId: ACCOUNT_ID,
      entity: "section",
      entityId: "csection000000000000000a",
      now: NOW,
    });

    expect(prismaMock.transaction.count).toHaveBeenCalledWith({
      where: { accountId: ACCOUNT_ID, sectionId: "csection000000000000000a" },
    });
    expect(prismaMock.transaction.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ["monthId"],
        where: { accountId: ACCOUNT_ID, sectionId: "csection000000000000000a" },
      }),
    );
  });
});

describe("countUsage — mapa de entidades", () => {
  it("tableType conta pela tabela da transação (vínculo indireto)", async () => {
    prismaMock.usageCount.findUnique.mockResolvedValue(null as never);
    prismaMock.tableType.count.mockResolvedValue(1);
    mockScan(11, ["m1", "m2"]);

    await countUsage({
      accountId: ACCOUNT_ID,
      entity: "tableType",
      entityId: "ctabletype00000000000aaa",
      now: NOW,
    });

    expect(prismaMock.transaction.count).toHaveBeenCalledWith({
      where: { accountId: ACCOUNT_ID, table: { tableTypeId: "ctabletype00000000000aaa" } },
    });
  });

  it("responsibleParty conta pela FK direta", async () => {
    prismaMock.usageCount.findUnique.mockResolvedValue(null as never);
    prismaMock.responsibleParty.count.mockResolvedValue(1);
    mockScan(2, ["m1"]);

    await countUsage({
      accountId: ACCOUNT_ID,
      entity: "responsibleParty",
      entityId: "cresponsible0000000000aa",
      now: NOW,
    });

    expect(prismaMock.transaction.count).toHaveBeenCalledWith({
      where: { accountId: ACCOUNT_ID, responsiblePartyId: "cresponsible0000000000aa" },
    });
  });

  it("months é a quantidade de meses DISTINTOS, não a de transações", async () => {
    prismaMock.usageCount.findUnique.mockResolvedValue(null as never);
    prismaMock.institution.count.mockResolvedValue(1);
    mockScan(30, ["m1", "m2"]);

    const result = await countUsage({
      accountId: ACCOUNT_ID,
      entity: "institution",
      entityId: "cinstitution000000000aaa",
      now: NOW,
    });

    expect(result.transactions).toBe(30);
    expect(result.months).toBe(2);
  });
});
