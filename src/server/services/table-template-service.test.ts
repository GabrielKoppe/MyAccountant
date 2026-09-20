import { describe, expect, it } from "vitest";

import { AppError, ConflictError, NotFoundError } from "@/server/api/errors";

import { TEST_CTX } from "@/../tests/fixtures/account";
import { prismaMock } from "@/../tests/mocks/prisma";

import {
  addItem,
  createManual,
  deleteTemplate,
  importItemsFromTable,
  listTemplates,
  updateItem,
  updateTemplate,
} from "./table-template-service";

const TEMPLATE_STUB = {
  id: "tpl-1",
  accountId: "acc-test-1",
  name: "Gastos Fixos",
  autoApply: false,
  autoSectionId: null,
  autoTableTypeId: null,
  tableTypeId: null,
  countInMonth: true,
  description: null,
  createdById: "user-test-1",
  createdAt: new Date("2026-01-01"),
};

describe("listTemplates", () => {
  it("filtra templates pelo accountId informado", async () => {
    prismaMock.tableTemplate.findMany.mockResolvedValue([]);

    await listTemplates("acc-test-1");

    expect(prismaMock.tableTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { accountId: "acc-test-1" } }),
    );
  });

  it("retorna os templates encontrados", async () => {
    const templates = [TEMPLATE_STUB] as any[];
    prismaMock.tableTemplate.findMany.mockResolvedValue(templates);

    const result = await listTemplates("acc-test-1");

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Gastos Fixos");
  });
});

describe("createManual", () => {
  const INPUT = { name: "Gastos Fixos", countInMonth: true };

  it("cria template com accountId e createdById corretos", async () => {
    prismaMock.tableTemplate.findFirst.mockResolvedValue(null);
    prismaMock.tableTemplate.create.mockResolvedValue({
      id: "tpl-novo",
      name: "Gastos Fixos",
    } as any);

    await createManual(INPUT, TEST_CTX);

    expect(prismaMock.tableTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountId: "acc-test-1",
          createdById: "user-test-1",
          name: "Gastos Fixos",
        }),
      }),
    );
  });

  it("lança ConflictError quando nome já existe na account", async () => {
    prismaMock.tableTemplate.findFirst.mockResolvedValue(TEMPLATE_STUB as any);

    await expect(createManual(INPUT, TEST_CTX)).rejects.toThrow(ConflictError);
  });

  it("verifica duplicata filtrando por accountId E nome", async () => {
    prismaMock.tableTemplate.findFirst.mockResolvedValue(null);
    prismaMock.tableTemplate.create.mockResolvedValue({
      id: "tpl-novo",
      name: "Gastos Fixos",
    } as any);

    await createManual(INPUT, TEST_CTX);

    expect(prismaMock.tableTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { accountId: "acc-test-1", name: "Gastos Fixos" },
      }),
    );
  });
});

describe("updateTemplate", () => {
  const INPUT = { templateId: "tpl-1", name: "Gastos Fixos — Atualizado" };

  it("atualiza template quando encontrado na account", async () => {
    prismaMock.tableTemplate.findFirst.mockResolvedValue(TEMPLATE_STUB as any);
    prismaMock.tableTemplate.update.mockResolvedValue({ id: "tpl-1", name: INPUT.name } as any);

    await updateTemplate(INPUT, TEST_CTX);

    expect(prismaMock.tableTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tpl-1" },
        data: expect.objectContaining({ name: INPUT.name }),
      }),
    );
  });

  it("lança NotFoundError quando template pertence a outra account (multi-tenancy)", async () => {
    // findFirst com accountId filtrando já retorna null — simula isolamento
    prismaMock.tableTemplate.findFirst.mockResolvedValue(null);

    await expect(updateTemplate(INPUT, TEST_CTX)).rejects.toThrow(NotFoundError);
  });

  it("busca o template filtrando por templateId E accountId", async () => {
    prismaMock.tableTemplate.findFirst.mockResolvedValue(TEMPLATE_STUB as any);
    prismaMock.tableTemplate.update.mockResolvedValue({ id: "tpl-1", name: INPUT.name } as any);

    await updateTemplate(INPUT, TEST_CTX);

    expect(prismaMock.tableTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tpl-1", accountId: "acc-test-1" },
      }),
    );
  });

  it("lança AppError VALIDATION quando autoApply=true sem seção configurada", async () => {
    prismaMock.tableTemplate.findFirst.mockResolvedValue(TEMPLATE_STUB as any);

    await expect(
      updateTemplate({ templateId: "tpl-1", autoApply: true }, TEST_CTX),
    ).rejects.toThrow(AppError);
  });

  it("lança AppError VALIDATION quando autoApply=true sem tipo de tabela configurado", async () => {
    prismaMock.tableTemplate.findFirst.mockResolvedValue(TEMPLATE_STUB as any);

    await expect(
      updateTemplate({ templateId: "tpl-1", autoApply: true, autoSectionId: "sec-1" }, TEST_CTX),
    ).rejects.toThrow(AppError);
  });

  it("valida seção pertencente à account quando autoSectionId é fornecido", async () => {
    prismaMock.tableTemplate.findFirst.mockResolvedValue(TEMPLATE_STUB as any);
    prismaMock.section.findFirst.mockResolvedValue(null); // seção não encontrada
    prismaMock.tableType.findFirst.mockResolvedValue({ id: "tt-1" } as any);

    await expect(
      updateTemplate(
        {
          templateId: "tpl-1",
          autoApply: true,
          autoSectionId: "sec-OUTRA",
          autoTableTypeId: "tt-1",
        },
        TEST_CTX,
      ),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("updateTemplate — Spec 69 (D7, orderInSection)", () => {
  // Pacote P8: `month-service.applyAutoTemplates` passou a ler `tableTypeId`, então
  // o espelho em `autoTableTypeId` perdeu o único consumidor e DEIXOU de ser escrito.
  // A coluna continua no schema (FU-3), só que morta.
  it("D7/P8: gravar tableTypeId NÃO escreve mais o espelho autoTableTypeId", async () => {
    prismaMock.tableTemplate.findFirst.mockResolvedValue(TEMPLATE_STUB as any);
    prismaMock.tableType.findFirst.mockResolvedValue({ id: "tt-1" } as any);
    prismaMock.tableTemplate.update.mockResolvedValue({ id: "tpl-1", name: "x" } as any);

    await updateTemplate({ templateId: "tpl-1", tableTypeId: "tt-1" }, TEST_CTX);

    const { data } = prismaMock.tableTemplate.update.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(data.tableTypeId).toBe("tt-1");
    expect(data).not.toHaveProperty("autoTableTypeId");
  });

  it("D7: chamador legado que só manda autoTableTypeId preenche o tableTypeId", async () => {
    prismaMock.tableTemplate.findFirst.mockResolvedValue(TEMPLATE_STUB as any);
    prismaMock.tableType.findFirst.mockResolvedValue({ id: "tt-9" } as any);
    prismaMock.tableTemplate.update.mockResolvedValue({ id: "tpl-1", name: "x" } as any);

    await updateTemplate({ templateId: "tpl-1", autoTableTypeId: "tt-9" }, TEST_CTX);

    const { data } = prismaMock.tableTemplate.update.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(data.tableTypeId).toBe("tt-9");
    expect(data).not.toHaveProperty("autoTableTypeId");
  });

  it("D7: `tableTypeId` já gravado satisfaz a exigência da automação, sem tocar o espelho", async () => {
    prismaMock.tableTemplate.findFirst.mockResolvedValue({
      ...TEMPLATE_STUB,
      tableTypeId: "tt-1",
      autoTableTypeId: null,
    } as any);
    prismaMock.section.findFirst.mockResolvedValue({ id: "sec-1" } as any);
    prismaMock.tableType.findFirst.mockResolvedValue({ id: "tt-1" } as any);
    prismaMock.tableTemplate.update.mockResolvedValue({ id: "tpl-1", name: "x" } as any);

    await updateTemplate(
      { templateId: "tpl-1", autoApply: true, autoSectionId: "sec-1" },
      TEST_CTX,
    );

    const { data } = prismaMock.tableTemplate.update.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(data).toEqual({ autoApply: true, autoSectionId: "sec-1" });
  });

  it("D7: linha legada que só tem autoTableTypeId consolida o tableTypeId na 1ª escrita", async () => {
    prismaMock.tableTemplate.findFirst.mockResolvedValue({
      ...TEMPLATE_STUB,
      tableTypeId: null,
      autoTableTypeId: "tt-legado",
    } as any);
    prismaMock.tableType.findFirst.mockResolvedValue({ id: "tt-legado" } as any);
    prismaMock.tableTemplate.update.mockResolvedValue({ id: "tpl-1", name: "x" } as any);

    await updateTemplate({ templateId: "tpl-1", name: "Novo nome" }, TEST_CTX);

    const { data } = prismaMock.tableTemplate.update.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(data.tableTypeId).toBe("tt-legado");
    expect(data).not.toHaveProperty("autoTableTypeId");
  });

  it("REGRESSÃO §15 — update parcial (só name) não toca orderInSection nem tipo", async () => {
    prismaMock.tableTemplate.findFirst.mockResolvedValue(TEMPLATE_STUB as any);
    prismaMock.tableTemplate.update.mockResolvedValue({ id: "tpl-1", name: "x" } as any);

    await updateTemplate({ templateId: "tpl-1", name: "Novo" }, TEST_CTX);

    const { data } = prismaMock.tableTemplate.update.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(data).toEqual({ name: "Novo" });
  });

  it("orderInSection: null limpa, número grava", async () => {
    prismaMock.tableTemplate.findFirst.mockResolvedValue(TEMPLATE_STUB as any);
    prismaMock.tableTemplate.update.mockResolvedValue({ id: "tpl-1", name: "x" } as any);

    await updateTemplate({ templateId: "tpl-1", orderInSection: 2 }, TEST_CTX);
    expect(
      (prismaMock.tableTemplate.update.mock.calls[0]![0] as { data: Record<string, unknown> }).data
        .orderInSection,
    ).toBe(2);

    prismaMock.tableTemplate.update.mockClear();
    prismaMock.tableTemplate.findFirst.mockResolvedValue(TEMPLATE_STUB as any);
    await updateTemplate({ templateId: "tpl-1", orderInSection: null }, TEST_CTX);
    expect(
      (prismaMock.tableTemplate.update.mock.calls[0]![0] as { data: Record<string, unknown> }).data,
    ).toHaveProperty("orderInSection", null);
  });
});

describe("addItem / updateItem — Spec 69 (dayRule)", () => {
  const ITEM_STUB = {
    id: "item-1",
    accountId: "acc-test-1",
    templateId: "tpl-1",
    day: 7,
    dayRule: "7",
  };

  it("multi-tenancy: modelo de outra account → NotFoundError, sem create", async () => {
    prismaMock.tableTemplate.findFirst.mockResolvedValue(null);

    await expect(
      addItem({ templateId: "tpl-alheio", day: 5, amountCents: 100n }, TEST_CTX),
    ).rejects.toThrow(NotFoundError);

    expect(prismaMock.tableTemplateItem.create).not.toHaveBeenCalled();
  });

  it("dayRule ausente vira dia fixo derivado de `day`", async () => {
    prismaMock.tableTemplate.findFirst.mockResolvedValue(TEMPLATE_STUB as any);
    prismaMock.tableTemplateItem.aggregate.mockResolvedValue({ _max: { displayOrder: 2 } } as any);
    prismaMock.tableTemplateItem.create.mockResolvedValue({} as any);

    await addItem({ templateId: "tpl-1", day: 5, amountCents: 100n }, TEST_CTX);

    const { data } = prismaMock.tableTemplateItem.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(data.day).toBe(5);
    expect(data.dayRule).toBe("5");
    expect(data.accountId).toBe("acc-test-1");
  });

  it('dayRule "last" espelha day=31 (coluna legada ainda ordena)', async () => {
    prismaMock.tableTemplate.findFirst.mockResolvedValue(TEMPLATE_STUB as any);
    prismaMock.tableTemplateItem.aggregate.mockResolvedValue({ _max: { displayOrder: 0 } } as any);
    prismaMock.tableTemplateItem.create.mockResolvedValue({} as any);

    await addItem({ templateId: "tpl-1", dayRule: "last", amountCents: 0n }, TEST_CTX);

    const { data } = prismaMock.tableTemplateItem.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(data.dayRule).toBe("last");
    expect(data.day).toBe(31);
  });

  it("multi-tenancy: item de outra account → NotFoundError, sem update", async () => {
    prismaMock.tableTemplateItem.findFirst.mockResolvedValue(null);

    await expect(updateItem({ itemId: "item-alheio", dayRule: "last" }, TEST_CTX)).rejects.toThrow(
      NotFoundError,
    );

    expect(prismaMock.tableTemplateItem.update).not.toHaveBeenCalled();
  });

  it("REGRESSÃO §15 — update parcial (só descrição) não toca day nem dayRule", async () => {
    prismaMock.tableTemplateItem.findFirst.mockResolvedValue(ITEM_STUB as any);
    prismaMock.tableTemplateItem.update.mockResolvedValue({} as any);

    await updateItem({ itemId: "item-1", description: "Aluguel" }, TEST_CTX);

    const { data } = prismaMock.tableTemplateItem.update.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(data).toEqual({ description: "Aluguel" });
  });

  it("trocar só `day` reescreve dayRule como dia fixo novo", async () => {
    prismaMock.tableTemplateItem.findFirst.mockResolvedValue(ITEM_STUB as any);
    prismaMock.tableTemplateItem.update.mockResolvedValue({} as any);

    await updateItem({ itemId: "item-1", day: 12 }, TEST_CTX);

    const { data } = prismaMock.tableTemplateItem.update.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(data).toEqual({ day: 12, dayRule: "12" });
  });

  it("trocar para firstBusiness espelha day=1", async () => {
    prismaMock.tableTemplateItem.findFirst.mockResolvedValue(ITEM_STUB as any);
    prismaMock.tableTemplateItem.update.mockResolvedValue({} as any);

    await updateItem({ itemId: "item-1", dayRule: "firstBusiness" }, TEST_CTX);

    const { data } = prismaMock.tableTemplateItem.update.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(data).toEqual({ day: 1, dayRule: "firstBusiness" });
  });
});

describe("deleteTemplate", () => {
  const INPUT = { templateId: "tpl-1" };

  it("deleta template quando encontrado na account", async () => {
    prismaMock.tableTemplate.findFirst.mockResolvedValue(TEMPLATE_STUB as any);
    prismaMock.tableTemplate.delete.mockResolvedValue(TEMPLATE_STUB as any);

    await deleteTemplate(INPUT, TEST_CTX);

    expect(prismaMock.tableTemplate.delete).toHaveBeenCalledWith({
      where: { id: "tpl-1" },
    });
  });

  it("lança NotFoundError quando template pertence a outra account (multi-tenancy)", async () => {
    prismaMock.tableTemplate.findFirst.mockResolvedValue(null);

    await expect(deleteTemplate(INPUT, TEST_CTX)).rejects.toThrow(NotFoundError);
  });

  it("busca o template filtrando por templateId E accountId antes de deletar", async () => {
    prismaMock.tableTemplate.findFirst.mockResolvedValue(TEMPLATE_STUB as any);
    prismaMock.tableTemplate.delete.mockResolvedValue(TEMPLATE_STUB as any);

    await deleteTemplate(INPUT, TEST_CTX);

    expect(prismaMock.tableTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tpl-1", accountId: "acc-test-1" },
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Spec 69 P7 — reordenar, importar de um mês, e `notes`
// ═══════════════════════════════════════════════════════════════════════════════

describe("updateItem — displayOrder (arraste)", () => {
  const ITEM_STUB = {
    id: "item-1",
    accountId: "acc-test-1",
    templateId: "tpl-1",
    day: 7,
    dayRule: "7",
    displayOrder: 2,
    notes: "cobrança anual",
  };

  it("grava displayOrder quando o chamador o menciona", async () => {
    prismaMock.tableTemplateItem.findFirst.mockResolvedValue(ITEM_STUB as any);
    prismaMock.tableTemplateItem.update.mockResolvedValue({} as any);

    await updateItem({ itemId: "item-1", displayOrder: 0 }, TEST_CTX);

    const { data } = prismaMock.tableTemplateItem.update.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(data.displayOrder).toBe(0);
  });

  it("REGRESSÃO §15 — update que NÃO menciona displayOrder não reescreve a ordem", async () => {
    prismaMock.tableTemplateItem.findFirst.mockResolvedValue(ITEM_STUB as any);
    prismaMock.tableTemplateItem.update.mockResolvedValue({} as any);

    await updateItem({ itemId: "item-1", description: "Netflix 4K" }, TEST_CTX);

    const { data } = prismaMock.tableTemplateItem.update.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(data).not.toHaveProperty("displayOrder");
  });

  it("REGRESSÃO §15 — update que NÃO menciona notes não apaga a nota", async () => {
    prismaMock.tableTemplateItem.findFirst.mockResolvedValue(ITEM_STUB as any);
    prismaMock.tableTemplateItem.update.mockResolvedValue({} as any);

    await updateItem({ itemId: "item-1", displayOrder: 1 }, TEST_CTX);

    const { data } = prismaMock.tableTemplateItem.update.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(data).not.toHaveProperty("notes");
  });

  it("notes explicitamente null é limpeza pedida pelo usuário, e passa", async () => {
    prismaMock.tableTemplateItem.findFirst.mockResolvedValue(ITEM_STUB as any);
    prismaMock.tableTemplateItem.update.mockResolvedValue({} as any);

    await updateItem({ itemId: "item-1", notes: null }, TEST_CTX);

    const { data } = prismaMock.tableTemplateItem.update.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(data.notes).toBeNull();
  });
});

describe("importItemsFromTable — Spec 69 P7", () => {
  const TX = {
    occurredOn: new Date(Date.UTC(2026, 6, 18)),
    amountCents: -5590n,
    description: "Netflix",
    notes: null,
    isPending: false,
    categoryId: "cat-1",
    subcategoryId: null,
    institutionId: null,
    responsiblePartyId: null,
    cardInstallment: null,
    investmentType: null,
  };

  function mockTable(transactions: unknown[]) {
    prismaMock.financeTable.findFirst.mockResolvedValue({ id: "tbl-1", transactions } as any);
  }

  it("multi-tenancy: modelo de outra account → NotFoundError, sem createMany", async () => {
    prismaMock.tableTemplate.findFirst.mockResolvedValue(null);

    await expect(
      importItemsFromTable({ templateId: "tpl-alheio", tableId: "tbl-1" }, TEST_CTX),
    ).rejects.toThrow(NotFoundError);

    expect(prismaMock.tableTemplateItem.createMany).not.toHaveBeenCalled();
  });

  it("multi-tenancy: tabela de outra account → NotFoundError, sem createMany", async () => {
    prismaMock.tableTemplate.findFirst.mockResolvedValue({ id: "tpl-1" } as any);
    prismaMock.financeTable.findFirst.mockResolvedValue(null);

    await expect(
      importItemsFromTable({ templateId: "tpl-1", tableId: "tbl-alheia" }, TEST_CTX),
    ).rejects.toThrow(NotFoundError);

    expect(prismaMock.tableTemplateItem.createMany).not.toHaveBeenCalled();
  });

  it("multi-tenancy: as DUAS buscas filtram por accountId do contexto", async () => {
    prismaMock.tableTemplate.findFirst.mockResolvedValue({ id: "tpl-1" } as any);
    mockTable([TX]);
    prismaMock.tableTemplateItem.aggregate.mockResolvedValue({ _max: { displayOrder: 4 } } as any);
    prismaMock.tableTemplateItem.createMany.mockResolvedValue({ count: 1 } as any);
    prismaMock.tableTemplateItem.findMany.mockResolvedValue([]);

    await importItemsFromTable({ templateId: "tpl-1", tableId: "tbl-1" }, TEST_CTX);

    expect(prismaMock.tableTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "tpl-1", accountId: "acc-test-1" } }),
    );
    expect(prismaMock.financeTable.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "tbl-1", accountId: "acc-test-1" } }),
    );
  });

  it("é APPEND: não deleta nada e continua o displayOrder a partir do fim", async () => {
    prismaMock.tableTemplate.findFirst.mockResolvedValue({ id: "tpl-1" } as any);
    mockTable([TX, { ...TX, description: "Spotify" }]);
    // O modelo já tem itens até a posição 4.
    prismaMock.tableTemplateItem.aggregate.mockResolvedValue({ _max: { displayOrder: 4 } } as any);
    prismaMock.tableTemplateItem.createMany.mockResolvedValue({ count: 2 } as any);
    prismaMock.tableTemplateItem.findMany.mockResolvedValue([]);

    await importItemsFromTable({ templateId: "tpl-1", tableId: "tbl-1" }, TEST_CTX);

    // Nada é removido: as transações atuais do modelo continuam lá.
    expect(prismaMock.tableTemplateItem.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.tableTemplateItem.delete).not.toHaveBeenCalled();

    const { data } = prismaMock.tableTemplateItem.createMany.mock.calls[0]![0] as {
      data: Record<string, unknown>[];
    };
    expect(data.map((row) => row.displayOrder)).toEqual([5, 6]);
    expect(data.every((row) => row.templateId === "tpl-1")).toBe(true);
    expect(data.every((row) => row.accountId === "acc-test-1")).toBe(true);
  });

  it("modelo vazio começa a numeração em 0", async () => {
    prismaMock.tableTemplate.findFirst.mockResolvedValue({ id: "tpl-1" } as any);
    mockTable([TX]);
    prismaMock.tableTemplateItem.aggregate.mockResolvedValue({
      _max: { displayOrder: null },
    } as any);
    prismaMock.tableTemplateItem.createMany.mockResolvedValue({ count: 1 } as any);
    prismaMock.tableTemplateItem.findMany.mockResolvedValue([]);

    await importItemsFromTable({ templateId: "tpl-1", tableId: "tbl-1" }, TEST_CTX);

    const { data } = prismaMock.tableTemplateItem.createMany.mock.calls[0]![0] as {
      data: Record<string, unknown>[];
    };
    expect(data[0]!.displayOrder).toBe(0);
  });

  it("transação real vira dia FIXO (regra relativa é escolha explícita do usuário)", async () => {
    prismaMock.tableTemplate.findFirst.mockResolvedValue({ id: "tpl-1" } as any);
    mockTable([TX]);
    prismaMock.tableTemplateItem.aggregate.mockResolvedValue({
      _max: { displayOrder: null },
    } as any);
    prismaMock.tableTemplateItem.createMany.mockResolvedValue({ count: 1 } as any);
    prismaMock.tableTemplateItem.findMany.mockResolvedValue([]);

    await importItemsFromTable({ templateId: "tpl-1", tableId: "tbl-1" }, TEST_CTX);

    const { data } = prismaMock.tableTemplateItem.createMany.mock.calls[0]![0] as {
      data: Record<string, unknown>[];
    };
    expect(data[0]!.day).toBe(18);
    expect(data[0]!.dayRule).toBe("18");
  });

  it("tabela sem transações não escreve nada e reporta zero", async () => {
    prismaMock.tableTemplate.findFirst.mockResolvedValue({ id: "tpl-1" } as any);
    mockTable([]);
    prismaMock.tableTemplateItem.findMany.mockResolvedValue([]);

    const result = await importItemsFromTable({ templateId: "tpl-1", tableId: "tbl-1" }, TEST_CTX);

    expect(prismaMock.tableTemplateItem.createMany).not.toHaveBeenCalled();
    expect(result.imported).toBe(0);
  });

  it("devolve a lista INTEIRA do modelo, com amountCents já em string", async () => {
    prismaMock.tableTemplate.findFirst.mockResolvedValue({ id: "tpl-1" } as any);
    mockTable([TX]);
    prismaMock.tableTemplateItem.aggregate.mockResolvedValue({ _max: { displayOrder: 0 } } as any);
    prismaMock.tableTemplateItem.createMany.mockResolvedValue({ count: 1 } as any);
    prismaMock.tableTemplateItem.findMany.mockResolvedValue([
      { id: "antigo", amountCents: -1000n, displayOrder: 0 },
      { id: "novo", amountCents: -5590n, displayOrder: 1 },
    ] as any);

    const result = await importItemsFromTable({ templateId: "tpl-1", tableId: "tbl-1" }, TEST_CTX);

    // O item que já existia continua na lista, na frente do importado.
    expect(result.items.map((item) => item.id)).toEqual(["antigo", "novo"]);
    expect(result.items[0]!.amountCents).toBe("-1000");
    expect(typeof result.items[1]!.amountCents).toBe("string");
    // E a releitura também é filtrada por accountId.
    expect(prismaMock.tableTemplateItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { templateId: "tpl-1", accountId: "acc-test-1" } }),
    );
  });
});
