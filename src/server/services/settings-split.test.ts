import { describe, expect, it } from "vitest";

import { ConflictError, ForbiddenError, NotFoundError } from "@/server/api/errors";

import { TEST_CTX } from "@/../tests/fixtures/account";
import { prismaMock } from "@/../tests/mocks/prisma";

import { createCategory, deleteCategory, updateCategory } from "./category-service";
import { createInstitution, deleteInstitution, updateInstitution } from "./institution-service";
import { createSection, deleteSection, updateSection } from "./section-service";
import { deleteTableType, updateTableType } from "./table-type-service";

// ─── Sections ────────────────────────────────────────────────────

describe("createSection", () => {
  it("deve criar seção com ordem max+1", async () => {
    prismaMock.section.aggregate.mockResolvedValue({ _max: { order: 2 } } as any);
    prismaMock.section.findUnique.mockResolvedValue(null);
    prismaMock.section.create.mockResolvedValue({ id: "sec-nova", name: "Nova" } as any);

    const result = await createSection(
      { name: "Nova", countType: "add", isActive: true },
      TEST_CTX,
    );

    expect(result.sectionId).toBe("sec-nova");
    expect(prismaMock.section.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          order: 3, // max(2) + 1
          accountId: "acc-test-1",
          name: "Nova",
        }),
      }),
    );
  });

  it("deve usar ordem 0 quando não há seções", async () => {
    prismaMock.section.aggregate.mockResolvedValue({ _max: { order: null } } as any);
    prismaMock.section.findUnique.mockResolvedValue(null);
    prismaMock.section.create.mockResolvedValue({ id: "sec-1", name: "Primeira" } as any);

    await createSection({ name: "Primeira", countType: "add", isActive: true }, TEST_CTX);

    expect(prismaMock.section.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ order: 0 }),
      }),
    );
  });

  it("deve lançar ConflictError se nome já existe na account", async () => {
    prismaMock.section.aggregate.mockResolvedValue({ _max: { order: 0 } } as any);
    prismaMock.section.findUnique.mockResolvedValue({ id: "sec-existente" } as any);

    await expect(
      createSection({ name: "Existente", countType: "add", isActive: true }, TEST_CTX),
    ).rejects.toThrow(ConflictError);
  });
});

describe("updateSection", () => {
  it("deve atualizar seção com sucesso", async () => {
    prismaMock.section.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.section.findFirst.mockResolvedValue(null); // sem conflito de nome
    prismaMock.section.update.mockResolvedValue({} as any);

    await updateSection(
      { sectionId: "sec-1", name: "Novo Nome", countType: "subtract", isActive: true },
      TEST_CTX,
    );

    expect(prismaMock.section.update).toHaveBeenCalled();
  });

  it("não deve atualizar seção de outra account (segurança multi-tenancy)", async () => {
    prismaMock.section.findUnique.mockResolvedValue({ accountId: "acc-OUTRA" } as any);

    await expect(
      updateSection(
        { sectionId: "sec-1", name: "Novo Nome", countType: "subtract", isActive: true },
        TEST_CTX,
      ),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("deleteSection", () => {
  it("deve deletar seção sem tabelas associadas", async () => {
    prismaMock.section.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.financeTable.count.mockResolvedValue(0);
    prismaMock.section.delete.mockResolvedValue({} as any);

    await deleteSection({ sectionId: "sec-1" }, TEST_CTX);

    expect(prismaMock.section.delete).toHaveBeenCalledWith({ where: { id: "sec-1" } });
  });

  it("deve lançar ConflictError se há tabelas financeiras associadas", async () => {
    prismaMock.section.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.financeTable.count.mockResolvedValue(3);

    await expect(deleteSection({ sectionId: "sec-1" }, TEST_CTX)).rejects.toThrow(ConflictError);
  });

  it("não deve deletar seção de outra account (segurança multi-tenancy)", async () => {
    prismaMock.section.findUnique.mockResolvedValue({ accountId: "acc-OUTRA" } as any);

    await expect(deleteSection({ sectionId: "sec-1" }, TEST_CTX)).rejects.toThrow(NotFoundError);
  });
});

// ─── Categories ──────────────────────────────────────────────────

describe("createCategory", () => {
  it("deve criar categoria no fim da ordem manual (Spec 68 §2.2)", async () => {
    prismaMock.category.findUnique.mockResolvedValue(null);
    prismaMock.category.aggregate.mockResolvedValue({ _max: { order: 4 } } as any);
    prismaMock.category.create.mockResolvedValue({ id: "cat-nova" } as any);

    const result = await createCategory({ name: "Alimentação" }, TEST_CTX);

    expect(result.categoryId).toBe("cat-nova");
    expect(prismaMock.category.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountId: "acc-test-1",
          name: "Alimentação",
          // A linha-fantasma vive no FIM da lista: a categoria criada por ela precisa
          // aparecer ali, e não no topo.
          order: 5, // max(4) + 1
        }),
      }),
    );
  });

  it("deve lançar ConflictError se nome já existe", async () => {
    prismaMock.category.findUnique.mockResolvedValue({ id: "cat-existente" } as any);

    await expect(createCategory({ name: "Alimentação" }, TEST_CTX)).rejects.toThrow(ConflictError);
  });
});

describe("updateCategory", () => {
  it("não deve atualizar categoria de outra account (segurança multi-tenancy)", async () => {
    prismaMock.category.findUnique.mockResolvedValue({ accountId: "acc-OUTRA" } as any);

    await expect(updateCategory({ categoryId: "cat-1", name: "Novo" }, TEST_CTX)).rejects.toThrow(
      NotFoundError,
    );
  });

  it("deve lançar ConflictError se novo nome já existe", async () => {
    prismaMock.category.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.category.findFirst.mockResolvedValue({ id: "cat-outro" } as any);

    await expect(
      updateCategory({ categoryId: "cat-1", name: "Duplicado" }, TEST_CTX),
    ).rejects.toThrow(ConflictError);
  });
});

describe("deleteCategory", () => {
  it("deve deletar categoria com sucesso", async () => {
    prismaMock.category.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.category.delete.mockResolvedValue({} as any);

    await deleteCategory({ categoryId: "cat-1" }, TEST_CTX);

    expect(prismaMock.category.delete).toHaveBeenCalledWith({ where: { id: "cat-1" } });
  });

  it("não deve deletar categoria de outra account (segurança multi-tenancy)", async () => {
    prismaMock.category.findUnique.mockResolvedValue({ accountId: "acc-OUTRA" } as any);

    await expect(deleteCategory({ categoryId: "cat-1" }, TEST_CTX)).rejects.toThrow(NotFoundError);
  });
});

// ─── Institutions ─────────────────────────────────────────────

describe("createInstitution", () => {
  it("deve criar instituição com sucesso", async () => {
    prismaMock.institution.findUnique.mockResolvedValue(null);
    prismaMock.institution.create.mockResolvedValue({ id: "inst-nova" } as any);

    const result = await createInstitution({ name: "Nubank" }, TEST_CTX);

    expect(result.institutionId).toBe("inst-nova");
  });

  it("deve lançar ConflictError se nome já existe", async () => {
    prismaMock.institution.findUnique.mockResolvedValue({ id: "inst-existente" } as any);

    await expect(createInstitution({ name: "Nubank" }, TEST_CTX)).rejects.toThrow(ConflictError);
  });
});

describe("updateInstitution", () => {
  it("não deve atualizar instituição de outra account (segurança multi-tenancy)", async () => {
    prismaMock.institution.findUnique.mockResolvedValue({ accountId: "acc-OUTRA" } as any);

    await expect(
      updateInstitution({ institutionId: "inst-1", name: "Outro" }, TEST_CTX),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("deleteInstitution", () => {
  it("não deve deletar instituição de outra account (segurança multi-tenancy)", async () => {
    prismaMock.institution.findUnique.mockResolvedValue({ accountId: "acc-OUTRA" } as any);

    await expect(deleteInstitution({ institutionId: "inst-1" }, TEST_CTX)).rejects.toThrow(
      NotFoundError,
    );
  });
});

// ─── Table Types ──────────────────────────────────────────────

describe("deleteTableType", () => {
  it("deve lançar ForbiddenError ao tentar deletar tipo padrão", async () => {
    prismaMock.tableType.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      isDefault: true,
    } as any);

    await expect(deleteTableType({ tableTypeId: "type-default" }, TEST_CTX)).rejects.toThrow(
      ForbiddenError,
    );
  });

  it("deve lançar ConflictError se há tabelas usando o tipo", async () => {
    prismaMock.tableType.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      isDefault: false,
    } as any);
    prismaMock.financeTable.count.mockResolvedValue(5);

    await expect(deleteTableType({ tableTypeId: "type-1" }, TEST_CTX)).rejects.toThrow(
      ConflictError,
    );
  });

  it("não deve deletar tipo de tabela de outra account (segurança multi-tenancy)", async () => {
    prismaMock.tableType.findUnique.mockResolvedValue({ accountId: "acc-OUTRA" } as any);

    await expect(deleteTableType({ tableTypeId: "type-1" }, TEST_CTX)).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe("updateTableType", () => {
  it("não deve permitir renomear tipo de outra account (segurança multi-tenancy)", async () => {
    prismaMock.tableType.findUnique.mockResolvedValue({ accountId: "acc-OUTRA" } as any);

    await expect(
      updateTableType({ tableTypeId: "type-1", name: "Novo" }, TEST_CTX),
    ).rejects.toThrow(NotFoundError);
  });
});
