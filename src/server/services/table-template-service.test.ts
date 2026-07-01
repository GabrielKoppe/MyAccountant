import { describe, expect, it } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";
import { TEST_CTX } from "@/../tests/fixtures/account";
import { AppError, ConflictError, NotFoundError } from "@/server/api/errors";

import {
  createManual,
  deleteTemplate,
  listTemplates,
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
