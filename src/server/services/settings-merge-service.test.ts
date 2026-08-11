import { type Mock, beforeEach, describe, expect, it } from "vitest";

import { ConflictError, NotFoundError } from "@/server/api/errors";

import { TEST_CTX } from "@/../tests/fixtures/account";
import { prismaMock } from "@/../tests/mocks/prisma";

import { mergeEntity } from "./settings-merge-service";

const ABSORBED = "cabsorbed00000000000000a";
const KEPT = "ckept000000000000000000a";

/**
 * `$transaction(callback)` roda o callback com o cliente da transação. No mock, o
 * cliente É o próprio `prismaMock` — assim as asserções valem para o que aconteceu
 * dentro da transação sem precisar de um segundo mock.
 */
function runTransactionInline() {
  (prismaMock.$transaction as unknown as Mock).mockImplementation(
    async (cb: (tx: unknown) => unknown) => cb(prismaMock),
  );
}

/** Os dois objetos existem na conta do contexto. */
function pairExists(
  model: "category" | "subcategory" | "institution" | "responsibleParty",
  extra: Record<string, unknown> = {},
) {
  prismaMock[model].findMany.mockResolvedValue([
    { id: ABSORBED, name: "Restaurantes", ...extra },
    { id: KEPT, name: "Restaurante", ...extra },
  ] as never);
}

/** Zera tudo o que a mesclagem toca; cada teste liga só o que exercita. */
function setupEmptyMoves() {
  prismaMock.transaction.updateMany.mockResolvedValue({ count: 0 } as never);
  prismaMock.transactionAlias.updateMany.mockResolvedValue({ count: 0 } as never);
  prismaMock.tableTemplateItem.updateMany.mockResolvedValue({ count: 0 } as never);
  prismaMock.subcategory.findMany.mockResolvedValue([] as never);
  prismaMock.csvTemplate.findMany.mockResolvedValue([] as never);
  prismaMock.dashboardLayout.findMany.mockResolvedValue([] as never);
  prismaMock.accountSettings.updateMany.mockResolvedValue({ count: 0 } as never);
  prismaMock.category.delete.mockResolvedValue({} as never);
  prismaMock.subcategory.delete.mockResolvedValue({} as never);
  prismaMock.institution.delete.mockResolvedValue({} as never);
  prismaMock.responsibleParty.delete.mockResolvedValue({} as never);
  prismaMock.auditLog.create.mockResolvedValue({} as never);
}

beforeEach(() => {
  runTransactionInline();
  setupEmptyMoves();
});

describe("mergeEntity — guardas", () => {
  it("recusa mesclar um objeto nele mesmo", async () => {
    // Mover tudo para o objeto e depois excluí-lo apagaria os dados.
    await expect(
      mergeEntity({ entity: "category", absorbedId: KEPT, keptId: KEPT }, TEST_CTX),
    ).rejects.toThrow(ConflictError);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("recusa quando um dos objetos não é desta conta (multi-tenancy)", async () => {
    // O findMany é escopado por accountId: o objeto alheio simplesmente não vem.
    prismaMock.category.findMany.mockResolvedValue([{ id: KEPT, name: "Restaurante" }] as never);

    await expect(
      mergeEntity({ entity: "category", absorbedId: ABSORBED, keptId: KEPT }, TEST_CTX),
    ).rejects.toThrow(NotFoundError);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("procura o par filtrando accountId", async () => {
    pairExists("category");

    await mergeEntity({ entity: "category", absorbedId: ABSORBED, keptId: KEPT }, TEST_CTX);

    expect(prismaMock.category.findMany.mock.calls[0]?.[0]?.where).toMatchObject({
      accountId: TEST_CTX.accountId,
    });
  });
});

describe("mergeEntity — guardas de integridade do objeto", () => {
  it("recusa mesclar responsável PESSOAL — ele é automático de um membro", async () => {
    // `deleteResponsibleParty` já bloqueia excluir o pessoal; mesclar é outro caminho
    // para o mesmo fim (o absorvido some), e a action é alcançável direto, sem passar
    // pelos filtros que a tela aplica às opções do select.
    prismaMock.responsibleParty.findMany.mockResolvedValue([
      { id: ABSORBED, name: "Gabriel", kind: "personal" },
      { id: KEPT, name: "Compartilhado", kind: "group" },
    ] as never);

    await expect(
      mergeEntity({ entity: "responsibleParty", absorbedId: ABSORBED, keptId: KEPT }, TEST_CTX),
    ).rejects.toThrow(ConflictError);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("recusa mesclar o pessoal também quando ele é o MANTIDO", async () => {
    prismaMock.responsibleParty.findMany.mockResolvedValue([
      { id: ABSORBED, name: "Compartilhado", kind: "group" },
      { id: KEPT, name: "Gabriel", kind: "personal" },
    ] as never);

    await expect(
      mergeEntity({ entity: "responsibleParty", absorbedId: ABSORBED, keptId: KEPT }, TEST_CTX),
    ).rejects.toThrow(ConflictError);
  });

  it("recusa mesclar subcategorias de categorias PAI diferentes", async () => {
    // Sobreviveria uma transação com `categoryId` de uma categoria e `subcategoryId`
    // que passou a viver em outra — par incoerente que nenhuma tela sabe exibir.
    prismaMock.subcategory.findMany.mockResolvedValue([
      { id: ABSORBED, name: "Mercado", categoryId: "cat-alimentacao" },
      { id: KEPT, name: "Mercado", categoryId: "cat-moradia" },
    ] as never);

    await expect(
      mergeEntity({ entity: "subcategory", absorbedId: ABSORBED, keptId: KEPT }, TEST_CTX),
    ).rejects.toThrow(ConflictError);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("aceita subcategorias do MESMO pai", async () => {
    pairExists("subcategory", { categoryId: "cat-mesma" });

    await expect(
      mergeEntity({ entity: "subcategory", absorbedId: ABSORBED, keptId: KEPT }, TEST_CTX),
    ).resolves.toBeDefined();
  });
});

describe("mergeEntity — move as referências", () => {
  it("move transações, apelidos e itens de modelo com accountId no where", async () => {
    pairExists("category");
    prismaMock.transaction.updateMany.mockResolvedValue({ count: 31 } as never);
    prismaMock.transactionAlias.updateMany.mockResolvedValue({ count: 2 } as never);
    prismaMock.tableTemplateItem.updateMany.mockResolvedValue({ count: 3 } as never);

    const result = await mergeEntity(
      { entity: "category", absorbedId: ABSORBED, keptId: KEPT },
      TEST_CTX,
    );

    expect(result.transactions).toBe(31);
    expect(result.aliases).toBe(2);
    expect(result.templateItems).toBe(3);

    expect(prismaMock.transaction.updateMany).toHaveBeenCalledWith({
      where: { accountId: TEST_CTX.accountId, categoryId: ABSORBED },
      data: { categoryId: KEPT },
    });
  });

  it("instituição migra os DOIS papéis do apelido (valor aplicado e condição)", async () => {
    pairExists("institution");
    prismaMock.transactionAlias.updateMany
      .mockResolvedValueOnce({ count: 4 } as never)
      .mockResolvedValueOnce({ count: 1 } as never);

    const result = await mergeEntity(
      { entity: "institution", absorbedId: ABSORBED, keptId: KEPT },
      TEST_CTX,
    );

    // Migrar só `institutionId` deixaria apelidos filtrando por uma instituição
    // excluída — eles nunca mais casariam, em silêncio.
    expect(result.aliases).toBe(5);
    expect(prismaMock.transactionAlias.updateMany).toHaveBeenCalledWith({
      where: { accountId: TEST_CTX.accountId, conditionInstitutionId: ABSORBED },
      data: { conditionInstitutionId: KEPT },
    });
  });

  it("reescreve o de-para do template de importação", async () => {
    pairExists("category");
    prismaMock.csvTemplate.findMany.mockResolvedValue([
      { id: "t1", mapping: { defaultCategoryId: ABSORBED, dateFormat: "DD/MM/YYYY" } },
      { id: "t2", mapping: { defaultCategoryId: "outra" } },
    ] as never);
    prismaMock.csvTemplate.update.mockResolvedValue({} as never);

    const result = await mergeEntity(
      { entity: "category", absorbedId: ABSORBED, keptId: KEPT },
      TEST_CTX,
    );

    expect(result.templateDefaults).toBe(1);
    expect(prismaMock.csvTemplate.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.csvTemplate.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      // Preserva o resto do mapeamento — só o id muda.
      data: { mapping: { defaultCategoryId: KEPT, dateFormat: "DD/MM/YYYY" } },
    });
  });

  it("reescreve o id em qualquer profundidade da config do widget", async () => {
    pairExists("category");
    prismaMock.dashboardLayout.findMany.mockResolvedValue([
      { id: "l1", widgets: [{ instanceId: "w1", config: { filters: { categoryIds: [ABSORBED] } } }] },
      { id: "l2", widgets: [{ instanceId: "w2", config: { categoryId: "outra" } }] },
    ] as never);
    prismaMock.dashboardLayout.update.mockResolvedValue({} as never);

    const result = await mergeEntity(
      { entity: "category", absorbedId: ABSORBED, keptId: KEPT },
      TEST_CTX,
    );

    expect(result.widgetFilters).toBe(1);
    expect(prismaMock.dashboardLayout.update).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { widgets: [{ instanceId: "w1", config: { filters: { categoryIds: [KEPT] } } }] },
    });
  });

  it("responsável migra o default da conta", async () => {
    pairExists("responsibleParty", { kind: "group" });

    await mergeEntity(
      { entity: "responsibleParty", absorbedId: ABSORBED, keptId: KEPT },
      TEST_CTX,
    );

    expect(prismaMock.accountSettings.updateMany).toHaveBeenCalledWith({
      where: { accountId: TEST_CTX.accountId, defaultResponsiblePartyId: ABSORBED },
      data: { defaultResponsiblePartyId: KEPT },
    });
  });
});

describe("mergeEntity — subcategorias da categoria absorvida", () => {
  it("move as que não colidem", async () => {
    pairExists("category");
    prismaMock.subcategory.findMany
      .mockResolvedValueOnce([{ id: "s1", name: "Delivery" }] as never)
      .mockResolvedValueOnce([{ id: "s9", name: "Mercado" }] as never);
    prismaMock.subcategory.update.mockResolvedValue({} as never);

    const result = await mergeEntity(
      { entity: "category", absorbedId: ABSORBED, keptId: KEPT },
      TEST_CTX,
    );

    expect(result.subcategories).toBe(1);
    expect(prismaMock.subcategory.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { categoryId: KEPT },
    });
    expect(prismaMock.subcategory.delete).not.toHaveBeenCalled();
  });

  it("em colisão de nome, funde na homônima em vez de violar a unique", async () => {
    // `Subcategory` tem @@unique([categoryId, name]): mover às cegas derrubaria a
    // transação inteira quando as duas categorias têm uma "Mercado".
    pairExists("category");
    prismaMock.subcategory.findMany
      .mockResolvedValueOnce([{ id: "s-dup", name: "Mercado" }] as never)
      .mockResolvedValueOnce([{ id: "s-viva", name: "Mercado" }] as never);

    const result = await mergeEntity(
      { entity: "category", absorbedId: ABSORBED, keptId: KEPT },
      TEST_CTX,
    );

    expect(result.subcategories).toBe(1);
    expect(prismaMock.transaction.updateMany).toHaveBeenCalledWith({
      where: { accountId: TEST_CTX.accountId, subcategoryId: "s-dup" },
      data: { subcategoryId: "s-viva" },
    });
    expect(prismaMock.subcategory.delete).toHaveBeenCalledWith({ where: { id: "s-dup" } });
    expect(prismaMock.subcategory.update).not.toHaveBeenCalled();
  });
});

describe("mergeEntity — o objeto absorvido some e o evento fica", () => {
  it("exclui a absorvida, nunca a mantida", async () => {
    pairExists("category");

    await mergeEntity({ entity: "category", absorbedId: ABSORBED, keptId: KEPT }, TEST_CTX);

    expect(prismaMock.category.delete).toHaveBeenCalledWith({ where: { id: ABSORBED } });
    expect(prismaMock.category.delete).toHaveBeenCalledTimes(1);
  });

  it("grava auditoria com nomes e contagens — é o ÚNICO registro, já que não há undo (D5)", async () => {
    pairExists("category");
    prismaMock.transaction.updateMany.mockResolvedValue({ count: 31 } as never);

    await mergeEntity({ entity: "category", absorbedId: ABSORBED, keptId: KEPT }, TEST_CTX);

    const call = prismaMock.auditLog.create.mock.calls[0]?.[0] as {
      data: { action: string; targetId: string; metadata: Record<string, unknown> };
    };

    expect(call.data.action).toBe("settings.merge");
    expect(call.data.targetId).toBe(KEPT);
    expect(call.data.metadata).toMatchObject({
      absorbedId: ABSORBED,
      absorbedName: "Restaurantes",
      keptId: KEPT,
      keptName: "Restaurante",
    });
    // Sem as contagens, a trilha diria que algo foi mesclado sem dizer o tamanho.
    expect((call.data.metadata.counts as { transactions: number }).transactions).toBe(31);
  });

  it("tudo acontece dentro de uma única transação", async () => {
    pairExists("category");

    await mergeEntity({ entity: "category", absorbedId: ABSORBED, keptId: KEPT }, TEST_CTX);

    // Falhar no meio deixaria transações apontando para uma categoria já excluída —
    // pior que não ter mesclado.
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });
});
