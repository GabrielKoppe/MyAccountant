import { describe, expect, it } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";
import { TEST_CTX } from "@/../tests/fixtures/account";
import { NotFoundError, ConflictError } from "@/server/api/errors";

import {
  addTagToTransaction,
  bulkAddTag,
  bulkRemoveTag,
  listTags,
  removeTagFromTransaction,
} from "./tag-service";

describe("listTags", () => {
  it("deve listar tags da account ordenadas por nome", async () => {
    prismaMock.tag.findMany.mockResolvedValue([
      { id: "tag-1", name: "Alimentação", color: null, _count: { transactions: 3 } } as any,
    ]);

    const tags = await listTags("acc-test-1");
    expect(tags).toHaveLength(1);
    expect(prismaMock.tag.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { accountId: "acc-test-1" }, orderBy: { name: "asc" } }),
    );
  });
});

describe("addTagToTransaction — multi-tenancy", () => {
  it("deve lançar NotFoundError se transação pertence a outra account", async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({ accountId: "acc-OUTRA" } as any);

    await expect(
      addTagToTransaction({ transactionId: "tx-1", tagName: "Viagem" }, TEST_CTX),
    ).rejects.toThrow(NotFoundError);
  });

  it("deve criar tag nova e vincular à transação", async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.tag.findFirst.mockResolvedValue(null);
    prismaMock.tag.create.mockResolvedValue({ id: "tag-new", name: "Viagem", color: null } as any);
    prismaMock.transactionTag.count.mockResolvedValue(0);
    prismaMock.transactionTag.upsert.mockResolvedValue({} as any);

    const result = await addTagToTransaction(
      { transactionId: "tx-1", tagName: "Viagem" },
      TEST_CTX,
    );

    expect(result.tagName).toBe("Viagem");
    expect(prismaMock.tag.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ accountId: "acc-test-1", name: "Viagem" }),
      }),
    );
  });

  it("deve reutilizar tag existente (case-insensitive)", async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.tag.findFirst.mockResolvedValue({
      id: "tag-exist",
      name: "viagem",
      color: null,
    } as any);
    prismaMock.transactionTag.count.mockResolvedValue(0);
    prismaMock.transactionTag.upsert.mockResolvedValue({} as any);

    const result = await addTagToTransaction(
      { transactionId: "tx-1", tagName: "VIAGEM" },
      TEST_CTX,
    );

    expect(result.tagId).toBe("tag-exist");
    expect(prismaMock.tag.create).not.toHaveBeenCalled();
  });

  it("deve lançar ConflictError ao atingir limite de 10 tags", async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.tag.findFirst.mockResolvedValue({ id: "tag-1", name: "Teste", color: null } as any);
    prismaMock.transactionTag.count.mockResolvedValue(10);

    await expect(
      addTagToTransaction({ transactionId: "tx-1", tagName: "Nova" }, TEST_CTX),
    ).rejects.toThrow(ConflictError);
  });
});

describe("removeTagFromTransaction — multi-tenancy", () => {
  it("deve lançar NotFoundError se tag pertence a outra account", async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.tag.findUnique.mockResolvedValue({ id: "tag-1", accountId: "acc-OUTRA" } as any);

    await expect(
      removeTagFromTransaction({ transactionId: "tx-1", tagId: "tag-1" }, TEST_CTX),
    ).rejects.toThrow(NotFoundError);
  });

  it("deve remover a tag da transação", async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.tag.findUnique.mockResolvedValue({ id: "tag-1", accountId: "acc-test-1" } as any);
    prismaMock.transactionTag.deleteMany.mockResolvedValue({ count: 1 });

    await removeTagFromTransaction({ transactionId: "tx-1", tagId: "tag-1" }, TEST_CTX);

    expect(prismaMock.transactionTag.deleteMany).toHaveBeenCalledWith({
      where: { transactionId: "tx-1", tagId: "tag-1" },
    });
  });
});

describe("bulkAddTag — multi-tenancy", () => {
  it("deve lançar NotFoundError se IDs não pertencem à account", async () => {
    prismaMock.transaction.count.mockResolvedValue(1); // só 1 de 2 existe na account

    await expect(
      bulkAddTag({ transactionIds: ["tx-1", "tx-2"], tagName: "Natal" }, TEST_CTX),
    ).rejects.toThrow(NotFoundError);
  });

  it("deve adicionar tag a múltiplas transações", async () => {
    prismaMock.transaction.count.mockResolvedValue(2);
    prismaMock.tag.findFirst.mockResolvedValue(null);
    prismaMock.tag.create.mockResolvedValue({ id: "tag-natal", name: "Natal", color: null } as any);
    prismaMock.transactionTag.createMany.mockResolvedValue({ count: 2 });

    const result = await bulkAddTag(
      { transactionIds: ["tx-1", "tx-2"], tagName: "Natal" },
      TEST_CTX,
    );

    expect(result.tagName).toBe("Natal");
    expect(prismaMock.transactionTag.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    );
  });
});

describe("bulkRemoveTag", () => {
  it("deve remover tag de múltiplas transações", async () => {
    prismaMock.tag.findUnique.mockResolvedValue({ id: "tag-1", accountId: "acc-test-1" } as any);
    prismaMock.transactionTag.deleteMany.mockResolvedValue({ count: 3 });

    await bulkRemoveTag({ transactionIds: ["tx-1", "tx-2", "tx-3"], tagId: "tag-1" }, TEST_CTX);

    expect(prismaMock.transactionTag.deleteMany).toHaveBeenCalledWith({
      where: { tagId: "tag-1", transactionId: { in: ["tx-1", "tx-2", "tx-3"] } },
    });
  });
});
