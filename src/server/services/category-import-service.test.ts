import { type Mock, beforeEach, describe, expect, it } from "vitest";

import { TEST_CTX } from "@/../tests/fixtures/account";
import { prismaMock } from "@/../tests/mocks/prisma";

import { applyCategoryImport, previewCategoryImport } from "./category-import-service";

/** `$transaction(callback)` roda o callback com o próprio mock. */
function runTransactionInline() {
  (prismaMock.$transaction as unknown as Mock).mockImplementation(
    async (cb: (tx: unknown) => unknown) => cb(prismaMock),
  );
}

function snapshot(
  categories: Array<{
    id: string;
    name: string;
    subcategories?: Array<{ id: string; name: string }>;
  }> = [],
) {
  prismaMock.category.findMany.mockResolvedValue(
    categories.map((c) => ({ ...c, subcategories: c.subcategories ?? [] })) as never,
  );
}

beforeEach(() => {
  runTransactionInline();
  prismaMock.category.create.mockResolvedValue({ id: "cat-nova" } as never);
  prismaMock.subcategory.create.mockResolvedValue({ id: "sub-nova" } as never);
  prismaMock.category.updateMany.mockResolvedValue({ count: 1 } as never);
});

describe("previewCategoryImport", () => {
  it("não grava nada — é a promessa da tela", async () => {
    snapshot();

    const plan = await previewCategoryImport({ rows: [{ name: "Educação" }] }, TEST_CTX);

    expect(plan.counts.create).toBe(1);
    expect(prismaMock.category.create).not.toHaveBeenCalled();
    expect(prismaMock.subcategory.create).not.toHaveBeenCalled();
    expect(prismaMock.category.updateMany).not.toHaveBeenCalled();
  });

  it("lê o retrato da conta filtrando accountId — sem consultar `Section` (seção sem destino)", async () => {
    snapshot();

    await previewCategoryImport({ rows: [{ name: "Educação" }] }, TEST_CTX);

    expect(prismaMock.category.findMany.mock.calls[0]?.[0]?.where).toMatchObject({
      accountId: TEST_CTX.accountId,
    });
    expect(prismaMock.section.findMany).not.toHaveBeenCalled();
  });
});

describe("applyCategoryImport", () => {
  it("RECLASSIFICA no servidor em vez de confiar no plano do cliente", async () => {
    // Entre abrir o modal e confirmar, alguém da conta criou "Educação". O cliente
    // ainda acha que é criação; o servidor precisa enxergar que virou "ignorar" — do
    // contrário a unique [accountId, name] rejeitaria a gravação.
    snapshot([{ id: "cat-edu", name: "Educação" }]);

    const result = await applyCategoryImport({ rows: [{ name: "Educação" }] }, TEST_CTX);

    expect(result.created).toBe(0);
    expect(prismaMock.category.create).not.toHaveBeenCalled();
  });

  it("cria os pais ANTES dos filhos, resolvendo o pai criado no próprio arquivo", async () => {
    snapshot();
    prismaMock.category.create.mockResolvedValue({ id: "cat-edu" } as never);

    const result = await applyCategoryImport(
      // A subcategoria vem primeiro no arquivo, de propósito.
      { rows: [{ name: "Escola", parent: "Educação" }, { name: "Educação" }] },
      TEST_CTX,
    );

    expect(result.created).toBe(2);
    expect(prismaMock.subcategory.create).toHaveBeenCalledWith({
      data: { accountId: TEST_CTX.accountId, categoryId: "cat-edu", name: "Escola" },
    });
  });

  it("cria a categoria sem `defaultSectionId` — a coluna não tem mais destino", async () => {
    snapshot();
    prismaMock.category.create.mockResolvedValue({ id: "cat-edu" } as never);

    await applyCategoryImport({ rows: [{ name: "Educação", section: "Moradia" }] }, TEST_CTX);

    expect(prismaMock.category.create).toHaveBeenCalledWith({
      data: { accountId: TEST_CTX.accountId, name: "Educação", createdById: TEST_CTX.userId },
      select: { id: true },
    });
  });

  it("pula linhas de erro sem derrubar as demais", async () => {
    snapshot();

    const result = await applyCategoryImport(
      {
        rows: [
          { name: "Órfã", parent: "Inexistente" }, // erro
          { name: "Educação" }, // create
        ],
      },
      TEST_CTX,
    );

    expect(result.created).toBe(1);
    expect(prismaMock.subcategory.create).not.toHaveBeenCalled();
  });

  it("categoria já existente nunca vira `update` — só ignorar (sem `seção`/`cor` para gravar)", async () => {
    snapshot([{ id: "cat-ali", name: "Alimentação" }]);

    const result = await applyCategoryImport(
      { rows: [{ name: "Alimentação", section: "Moradia" }] },
      TEST_CTX,
    );

    expect(result.updated).toBe(0);
    expect(prismaMock.category.updateMany).not.toHaveBeenCalled();
  });

  it("tudo numa transação só — importação pela metade deixaria filho sem pai", async () => {
    snapshot();

    await applyCategoryImport({ rows: [{ name: "Educação" }] }, TEST_CTX);

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe("applyCategoryImport — desativar as ausentes", () => {
  it("desativa (não exclui) as categorias fora do arquivo", async () => {
    snapshot([
      { id: "cat-ali", name: "Alimentação" },
      { id: "cat-doa", name: "Doações" },
    ]);
    prismaMock.category.updateMany.mockResolvedValue({ count: 1 } as never);

    const result = await applyCategoryImport(
      { rows: [{ name: "Alimentação" }], deactivateMissing: true },
      TEST_CTX,
    );

    expect(result.deactivated).toBe(1);
    expect(prismaMock.category.updateMany).toHaveBeenCalledWith({
      where: { accountId: TEST_CTX.accountId, id: { in: ["cat-doa"] } },
      // Excluir apagaria anos de histórico só porque a linha não veio na planilha.
      data: { status: "inactive" },
    });
    expect(prismaMock.category.delete).not.toHaveBeenCalled();
  });

  it("sem o toggle, não desativa nada", async () => {
    snapshot([{ id: "cat-doa", name: "Doações" }]);

    const result = await applyCategoryImport({ rows: [{ name: "Alimentação" }] }, TEST_CTX);

    expect(result.deactivated).toBe(0);
  });
});
