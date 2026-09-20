import { describe, expect, it } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";
import { TEST_CTX } from "@/../tests/fixtures/account";
import { NotFoundError } from "@/server/api/errors";

import { createTableType, updateTableType } from "./table-type-service";

describe("createTableType", () => {
  it("grava rowLayout do input", async () => {
    prismaMock.tableType.findUnique.mockResolvedValue(null as any);
    prismaMock.tableType.create.mockResolvedValue({ id: "tt-new" } as any);

    await createTableType({ name: "Cartão", hiddenColumns: {}, rowLayout: "pills" }, TEST_CTX);

    expect(prismaMock.tableType.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ accountId: "acc-test-1", rowLayout: "pills" }),
      }),
    );
  });

  it("default 'columns' quando rowLayout é omitido", async () => {
    prismaMock.tableType.findUnique.mockResolvedValue(null as any);
    prismaMock.tableType.create.mockResolvedValue({ id: "tt-new" } as any);

    await createTableType({ name: "Simples", hiddenColumns: {} }, TEST_CTX);

    expect(prismaMock.tableType.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ rowLayout: "columns" }),
      }),
    );
  });

  it("Spec 69 — defaults de apresentação quando nada é informado", async () => {
    prismaMock.tableType.findUnique.mockResolvedValue(null as any);
    prismaMock.tableType.create.mockResolvedValue({ id: "tt-new" } as any);

    await createTableType({ name: "Simples", hiddenColumns: {} }, TEST_CTX);

    const { data } = prismaMock.tableType.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(data.density).toBe("default");
    // `desc` e linha-fantasma desligada: um tipo novo nasce reproduzindo o que a
    // tabela do mês já faz hoje — mais recente no topo, linha vazia só ao acionar
    // "Nova transação" (§16). Um default `asc`/`true` mudaria a tela de todo mundo
    // no dia em que os campos ganharam consumidor.
    expect(data.defaultSort).toEqual({ key: "occurredOn", dir: "desc" });
    expect(data.groupBy).toBeNull();
    expect(data.showFooterTotal).toBe(true);
    expect(data.showGroupSubtotal).toBe(false);
    expect(data.allowBulkEdit).toBe(true);
    expect(data.keepGhostRow).toBe(false);
    expect(data.pinnedColumns).toEqual([]);
    // NÃO é `[]`: um tipo novo tem que nascer reproduzindo o comportamento de
    // hoje da linha-fantasma, que sempre preservou a data (§16).
    expect(data.inheritOnNewRow).toEqual(["occurredOn"]);
    // Sem coluna escondida, `visibleColumns` nasce com a ordem canônica inteira.
    expect(data.visibleColumns).toEqual([
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

  it("Spec 69 — escrita dupla: hiddenColumns é derivado de visibleColumns", async () => {
    prismaMock.tableType.findUnique.mockResolvedValue(null as any);
    prismaMock.tableType.create.mockResolvedValue({ id: "tt-new" } as any);

    await createTableType(
      {
        name: "Cartão",
        hiddenColumns: {},
        visibleColumns: ["occurredOn", "description", "category", "amount"],
      },
      TEST_CTX,
    );

    const { data } = prismaMock.tableType.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(data.visibleColumns).toEqual(["occurredOn", "description", "category", "amount"]);
    expect(data.hiddenColumns).toEqual({
      subcategory: true,
      institution: true,
      paymentMethod: true,
      responsibleUser: true,
      isPending: true,
      cardInstallment: true,
      investmentType: true,
      expenseType: true,
      tags: true,
      notes: true,
    });
  });

  it("Spec 69 — chamador legado (só hiddenColumns) ganha visibleColumns derivado", async () => {
    prismaMock.tableType.findUnique.mockResolvedValue(null as any);
    prismaMock.tableType.create.mockResolvedValue({ id: "tt-new" } as any);

    await createTableType(
      { name: "Investimentos", hiddenColumns: { cardInstallment: true } },
      TEST_CTX,
    );

    const { data } = prismaMock.tableType.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(data.hiddenColumns).toEqual({ cardInstallment: true });
    expect(data.visibleColumns).not.toContain("cardInstallment");
    expect(data.visibleColumns).toContain("occurredOn");
    expect(data.visibleColumns).toContain("amount");
  });

  it("multi-tenancy: o accountId gravado é o do contexto, nunca o do input", async () => {
    prismaMock.tableType.findUnique.mockResolvedValue(null as any);
    prismaMock.tableType.create.mockResolvedValue({ id: "tt-new" } as any);

    await createTableType(
      { name: "Cartão", hiddenColumns: {}, accountId: "acc-alheia" } as any,
      TEST_CTX,
    );

    const { data } = prismaMock.tableType.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(data.accountId).toBe("acc-test-1");
  });
});

describe("updateTableType — rowLayout", () => {
  it("multi-tenancy: tipo de outra account → NotFoundError, sem update", async () => {
    prismaMock.tableType.findUnique.mockResolvedValue({
      accountId: "acc-outra",
      isDefault: false,
    } as any);

    await expect(
      updateTableType({ tableTypeId: "tt-alheio", rowLayout: "pills" }, TEST_CTX),
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(prismaMock.tableType.update).not.toHaveBeenCalled();
  });

  it("persiste rowLayout para tipo da mesma account (não-default)", async () => {
    prismaMock.tableType.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      isDefault: false,
    } as any);
    prismaMock.tableType.update.mockResolvedValue({} as any);

    await updateTableType({ tableTypeId: "tt-1", rowLayout: "pills" }, TEST_CTX);

    expect(prismaMock.tableType.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tt-1" },
        data: expect.objectContaining({ rowLayout: "pills" }),
      }),
    );
  });

  /**
   * Este teste falhava em HEAD porque afirmava o CONTRÁRIO do que o serviço faz de
   * propósito (e documenta em comentário desde a Spec 66): `rowLayout` é só
   * apresentação, não muda dado nenhum, e por isso é editável INCLUSIVE no tipo
   * padrão — senão quem nunca criou um tipo próprio não conseguiria trocar de
   * layout. O gate de `isDefault` existe para o CONJUNTO DE COLUNAS, que muda o
   * que a tabela mostra em toda a conta. A asserção antiga era a errada; o teste
   * abaixo fixa a invariante real, e o seguinte cobre o gate que de fato existe.
   */
  it("tipo padrão (isDefault) TAMBÉM aceita rowLayout — é só apresentação", async () => {
    prismaMock.tableType.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      isDefault: true,
    } as any);
    prismaMock.tableType.update.mockResolvedValue({} as any);

    await updateTableType({ tableTypeId: "tt-default", rowLayout: "pills" }, TEST_CTX);

    const call = prismaMock.tableType.update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(call.data.rowLayout).toBe("pills");
  });

  it("tipo padrão (isDefault) ignora o conjunto de colunas — o gate real", async () => {
    prismaMock.tableType.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      isDefault: true,
    } as any);
    prismaMock.tableType.update.mockResolvedValue({} as any);

    await updateTableType(
      {
        tableTypeId: "tt-default",
        hiddenColumns: { notes: true },
        visibleColumns: ["occurredOn", "description", "amount"],
      },
      TEST_CTX,
    );

    const call = prismaMock.tableType.update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(call.data).not.toHaveProperty("hiddenColumns");
    expect(call.data).not.toHaveProperty("visibleColumns");
  });
});

describe("updateTableType — Spec 69 (campos novos)", () => {
  function mockOwnNonDefaultType() {
    prismaMock.tableType.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      isDefault: false,
    } as any);
    prismaMock.tableType.update.mockResolvedValue({} as any);
  }

  it("REGRESSÃO §15 — update parcial (só name) não zera density nem visibleColumns", async () => {
    mockOwnNonDefaultType();

    await updateTableType({ tableTypeId: "tt-1", name: "Novo nome" }, TEST_CTX);

    const call = prismaMock.tableType.update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(call.data).toEqual({ name: "Novo nome" });
    for (const field of [
      "density",
      "visibleColumns",
      "hiddenColumns",
      "pinnedColumns",
      "inheritOnNewRow",
      "defaultSort",
      "groupBy",
      "showFooterTotal",
      "showGroupSubtotal",
      "allowBulkEdit",
      "keepGhostRow",
      "rowLayout",
    ]) {
      expect(call.data).not.toHaveProperty(field);
    }
  });

  it("groupBy: null é 'limpar' e é gravado; undefined é 'não mencionei' e some", async () => {
    mockOwnNonDefaultType();
    await updateTableType({ tableTypeId: "tt-1", groupBy: null }, TEST_CTX);
    const cleared = prismaMock.tableType.update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(cleared.data).toHaveProperty("groupBy", null);

    prismaMock.tableType.update.mockClear();
    mockOwnNonDefaultType();
    await updateTableType({ tableTypeId: "tt-1", showFooterTotal: false }, TEST_CTX);
    const untouched = prismaMock.tableType.update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(untouched.data).not.toHaveProperty("groupBy");
  });

  it("grava todos os campos de apresentação quando informados", async () => {
    mockOwnNonDefaultType();

    await updateTableType(
      {
        tableTypeId: "tt-1",
        density: "compact",
        pinnedColumns: ["occurredOn"],
        inheritOnNewRow: ["occurredOn", "category"],
        defaultSort: { key: "amount", dir: "desc" },
        groupBy: "category",
        showFooterTotal: false,
        showGroupSubtotal: true,
        allowBulkEdit: false,
        keepGhostRow: false,
      },
      TEST_CTX,
    );

    const call = prismaMock.tableType.update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(call.data).toEqual({
      density: "compact",
      pinnedColumns: ["occurredOn"],
      inheritOnNewRow: ["occurredOn", "category"],
      defaultSort: { key: "amount", dir: "desc" },
      groupBy: "category",
      showFooterTotal: false,
      showGroupSubtotal: true,
      allowBulkEdit: false,
      keepGhostRow: false,
    });
  });

  it("escrita dupla no update: visibleColumns manda e hiddenColumns acompanha", async () => {
    mockOwnNonDefaultType();

    await updateTableType(
      {
        tableTypeId: "tt-1",
        // Mapa legado deliberadamente INCOERENTE com a lista: a lista vence.
        hiddenColumns: { category: true },
        visibleColumns: ["description", "category", "occurredOn", "amount"],
      },
      TEST_CTX,
    );

    const call = prismaMock.tableType.update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    // Ordem escolhida pelo usuário preservada; `locked` faltante não há aqui.
    expect(call.data.visibleColumns).toEqual(["description", "category", "occurredOn", "amount"]);
    expect(call.data.hiddenColumns).not.toHaveProperty("category");
    expect(call.data.hiddenColumns).toHaveProperty("notes", true);
  });

  it("multi-tenancy: campos novos de outra account → NotFoundError, sem update", async () => {
    prismaMock.tableType.findUnique.mockResolvedValue({
      accountId: "acc-outra",
      isDefault: false,
    } as any);

    await expect(
      updateTableType({ tableTypeId: "tt-alheio", density: "comfortable" }, TEST_CTX),
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(prismaMock.tableType.update).not.toHaveBeenCalled();
  });
});
