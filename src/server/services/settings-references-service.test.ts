import { beforeEach, describe, expect, it } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";

import { getConfigReferences } from "./settings-references-service";

const ACCOUNT_ID = "acc-test-1";
const CATEGORY_ID = "ccategory0000000000000aa";

/** Tudo zerado; cada teste liga só a referência que está exercitando. */
function setupEmpty() {
  prismaMock.transactionAlias.count.mockResolvedValue(0);
  prismaMock.tableTemplateItem.count.mockResolvedValue(0);
  prismaMock.csvTemplate.findMany.mockResolvedValue([] as never);
  prismaMock.dashboardLayout.findMany.mockResolvedValue([] as never);
  prismaMock.accountSettings.count.mockResolvedValue(0);
}

function countOf(groups: Array<{ kind: string; count: number }>, kind: string) {
  return groups.find((g) => g.kind === kind)?.count;
}

beforeEach(setupEmpty);

describe("getConfigReferences — multi-tenancy", () => {
  it("filtra accountId em toda contagem", async () => {
    await getConfigReferences(ACCOUNT_ID, "category", CATEGORY_ID);

    expect(prismaMock.transactionAlias.count.mock.calls[0]?.[0]?.where).toMatchObject({
      accountId: ACCOUNT_ID,
    });
    expect(prismaMock.tableTemplateItem.count.mock.calls[0]?.[0]?.where).toMatchObject({
      accountId: ACCOUNT_ID,
    });
    expect(prismaMock.csvTemplate.findMany.mock.calls[0]?.[0]?.where).toMatchObject({
      accountId: ACCOUNT_ID,
    });
    expect(prismaMock.dashboardLayout.findMany.mock.calls[0]?.[0]?.where).toMatchObject({
      accountId: ACCOUNT_ID,
    });
  });

  it("nunca toca Transaction — isso é o settings-usage-service, sob demanda", async () => {
    await getConfigReferences(ACCOUNT_ID, "category", CATEGORY_ID);

    expect(prismaMock.transaction.count).not.toHaveBeenCalled();
    expect(prismaMock.transaction.groupBy).not.toHaveBeenCalled();
    expect(prismaMock.transaction.findMany).not.toHaveBeenCalled();
  });
});

describe("getConfigReferences — apelidos", () => {
  it("categoria casa por categoryId", async () => {
    prismaMock.transactionAlias.count.mockResolvedValue(8);

    const result = await getConfigReferences(ACCOUNT_ID, "category", CATEGORY_ID);

    expect(countOf(result.groups, "aliases")).toBe(8);
    expect(prismaMock.transactionAlias.count.mock.calls[0]?.[0]?.where).toMatchObject({
      categoryId: CATEGORY_ID,
    });
  });

  it("instituição casa nos DOIS papéis: valor aplicado e condição de correspondência", async () => {
    // Contar só `institutionId` deixaria excluir uma instituição que ainda filtra
    // apelidos — que a partir daí nunca mais casariam, sem aviso nenhum.
    await getConfigReferences(ACCOUNT_ID, "institution", "cinst00000000000000000aa");

    expect(prismaMock.transactionAlias.count.mock.calls[0]?.[0]?.where).toMatchObject({
      OR: [
        { institutionId: "cinst00000000000000000aa" },
        { conditionInstitutionId: "cinst00000000000000000aa" },
      ],
    });
  });
});

describe("getConfigReferences — de-para de templates (varredura de Json)", () => {
  it("conta o template cujo defaultCategoryId aponta para a categoria", async () => {
    prismaMock.csvTemplate.findMany.mockResolvedValue([
      { mapping: { defaultCategoryId: CATEGORY_ID } },
      { mapping: { defaultCategoryId: "outra" } },
      { mapping: { defaultCategoryId: null } },
      { mapping: null },
    ] as never);

    const result = await getConfigReferences(ACCOUNT_ID, "category", CATEGORY_ID);

    expect(countOf(result.groups, "templateDefaults")).toBe(1);
  });

  it("usa defaultInstitutionId quando a entidade é instituição", async () => {
    prismaMock.csvTemplate.findMany.mockResolvedValue([
      { mapping: { defaultInstitutionId: "cinst00000000000000000aa" } },
    ] as never);

    const result = await getConfigReferences(ACCOUNT_ID, "institution", "cinst00000000000000000aa");

    expect(countOf(result.groups, "templateDefaults")).toBe(1);
  });

  it("subcategoria e responsável não têm de-para: nem consulta os templates", async () => {
    await getConfigReferences(ACCOUNT_ID, "subcategory", "csub000000000000000000aa");

    expect(prismaMock.csvTemplate.findMany).not.toHaveBeenCalled();
  });
});

describe("getConfigReferences — filtros de widget", () => {
  it("acha o id em qualquer profundidade da config do widget", async () => {
    // O formato de `config` muda por widget; enumerar os campos aqui garantiria que o
    // próximo widget passasse despercebido.
    prismaMock.dashboardLayout.findMany.mockResolvedValue([
      {
        widgets: [
          { instanceId: "w1", config: { filters: { categoryIds: [CATEGORY_ID] } } },
          { instanceId: "w2", config: { categoryId: "outra" } },
          { instanceId: "w3" },
        ],
      },
      { widgets: [{ instanceId: "w4", config: { nested: { deep: { id: CATEGORY_ID } } } }] },
    ] as never);

    const result = await getConfigReferences(ACCOUNT_ID, "category", CATEGORY_ID);

    expect(countOf(result.groups, "widgetFilters")).toBe(2);
  });

  it("layout com widgets em formato inesperado não quebra a contagem", async () => {
    prismaMock.dashboardLayout.findMany.mockResolvedValue([
      { widgets: null },
      { widgets: "lixo" },
      { widgets: [] },
    ] as never);

    const result = await getConfigReferences(ACCOUNT_ID, "category", CATEGORY_ID);

    expect(countOf(result.groups, "widgetFilters")).toBe(0);
  });
});

describe("getConfigReferences — default da conta", () => {
  it("só o responsável tem default no nível da conta", async () => {
    prismaMock.accountSettings.count.mockResolvedValue(1);

    const asParty = await getConfigReferences(ACCOUNT_ID, "responsibleParty", "cparty0000000000000000a");
    expect(countOf(asParty.groups, "accountDefault")).toBe(1);

    prismaMock.accountSettings.count.mockClear();
    const asCategory = await getConfigReferences(ACCOUNT_ID, "category", CATEGORY_ID);
    expect(countOf(asCategory.groups, "accountDefault")).toBe(0);
    expect(prismaMock.accountSettings.count).not.toHaveBeenCalled();
  });
});

describe("getConfigReferences — total e grupos vazios", () => {
  it("soma todas as referências no total", async () => {
    prismaMock.transactionAlias.count.mockResolvedValue(8);
    prismaMock.tableTemplateItem.count.mockResolvedValue(3);
    prismaMock.csvTemplate.findMany.mockResolvedValue([
      { mapping: { defaultCategoryId: CATEGORY_ID } },
      { mapping: { defaultCategoryId: CATEGORY_ID } },
    ] as never);
    prismaMock.dashboardLayout.findMany.mockResolvedValue([
      { widgets: [{ instanceId: "w1", config: { categoryId: CATEGORY_ID } }] },
    ] as never);

    const result = await getConfigReferences(ACCOUNT_ID, "category", CATEGORY_ID);

    expect(result.total).toBe(8 + 3 + 2 + 1);
  });

  it("devolve os grupos com zero — 'verificamos e não há' ≠ 'não verificamos'", async () => {
    const result = await getConfigReferences(ACCOUNT_ID, "category", CATEGORY_ID);

    expect(result.total).toBe(0);
    // O M5 mostra "0 widgets" de propósito; suprimir o grupo esconderia a verificação.
    expect(result.groups.map((g) => g.kind)).toEqual([
      "aliases",
      "templateDefaults",
      "templateItems",
      "widgetFilters",
      "accountDefault",
    ]);
  });
});
