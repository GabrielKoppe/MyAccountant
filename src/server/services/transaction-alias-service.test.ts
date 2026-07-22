import { describe, expect, it } from "vitest";

import { createTransactionAliasSchema } from "@/lib/schemas/transaction-alias";
import { AppError, ConflictError, NotFoundError } from "@/server/api/errors";

import { TEST_CTX } from "@/../tests/fixtures/account";
import { prismaMock } from "@/../tests/mocks/prisma";

import {
  archiveTransactionAlias,
  createTransactionAlias,
  deleteTransactionAlias,
  updateTransactionAlias,
} from "./transaction-alias-service";

const BASE_INPUT = {
  trigger: "CEG",
  triggerMode: "contains" as const,
  priority: "medium" as const,
  conditionInstitutionId: null,
  minCents: null,
  maxCents: null,
  description: "Sistema de Gás",
  notes: null,
  amountCents: null,
  categoryId: null,
  subcategoryId: null,
  institutionId: null,
  institutionText: null,
  responsiblePartyId: null,
  expenseType: null,
  paymentMethod: null,
  investmentType: null,
  cardInstallment: null,
  isPending: null,
  isFavorite: null,
  originalCurrency: null,
  originalAmountCents: null,
  exchangeRate: null,
  tagIds: [] as string[],
};

describe("createTransactionAlias", () => {
  it("cria apelido escopado por accountId com triggerNormalized em lowercase", async () => {
    prismaMock.transactionAlias.findFirst.mockResolvedValue(null);
    prismaMock.transactionAlias.create.mockResolvedValue({ id: "alias-1" } as never);

    const r = await createTransactionAlias(BASE_INPUT, TEST_CTX);

    expect(r.id).toBe("alias-1");
    const arg = prismaMock.transactionAlias.create.mock.calls[0][0] as any;
    expect(arg.data.accountId).toBe("acc-test-1");
    expect(arg.data.trigger).toBe("CEG");
    expect(arg.data.triggerNormalized).toBe("ceg");
    expect(arg.data.createdById).toBe("user-test-1");
  });

  it("persiste favorito e moeda estrangeira no payload", async () => {
    prismaMock.transactionAlias.findFirst.mockResolvedValue(null);
    prismaMock.transactionAlias.create.mockResolvedValue({ id: "alias-fx" } as never);

    await createTransactionAlias(
      {
        ...BASE_INPUT,
        isFavorite: true,
        originalCurrency: "USD",
        originalAmountCents: 1299n,
        exchangeRate: 5.12,
      },
      TEST_CTX,
    );

    const arg = prismaMock.transactionAlias.create.mock.calls[0][0] as any;
    expect(arg.data.isFavorite).toBe(true);
    expect(arg.data.originalCurrency).toBe("USD");
    expect(arg.data.originalAmountCents).toBe(1299n);
    expect(arg.data.exchangeRate).toBe(5.12);
  });

  it("persiste correspondência avançada (triggerMode/priority/condição/faixa)", async () => {
    prismaMock.transactionAlias.findFirst.mockResolvedValue(null);
    prismaMock.institution.findFirst.mockResolvedValue({ id: "inst-cond" } as never);
    prismaMock.transactionAlias.create.mockResolvedValue({ id: "alias-adv" } as never);

    await createTransactionAlias(
      {
        ...BASE_INPUT,
        triggerMode: "regex",
        trigger: "^UBER",
        priority: "high",
        conditionInstitutionId: "inst-cond",
        minCents: 1000n,
        maxCents: 5000n,
      },
      TEST_CTX,
    );

    const arg = prismaMock.transactionAlias.create.mock.calls[0][0] as any;
    expect(arg.data.triggerMode).toBe("regex");
    expect(arg.data.priority).toBe("high");
    expect(arg.data.conditionInstitutionId).toBe("inst-cond");
    expect(arg.data.minCents).toBe(1000n);
    expect(arg.data.maxCents).toBe(5000n);
  });

  it("rejeita conditionInstitutionId de outra Account (IDOR)", async () => {
    prismaMock.transactionAlias.findFirst.mockResolvedValue(null);
    prismaMock.institution.findFirst.mockResolvedValue(null);

    await expect(
      createTransactionAlias(
        { ...BASE_INPUT, conditionInstitutionId: "inst-outra-account" },
        TEST_CTX,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("cria vínculos de tags quando tagIds não está vazio", async () => {
    prismaMock.transactionAlias.findFirst.mockResolvedValue(null);
    prismaMock.tag.count.mockResolvedValue(2);
    prismaMock.transactionAlias.create.mockResolvedValue({ id: "alias-1" } as never);

    await createTransactionAlias({ ...BASE_INPUT, tagIds: ["tag-1", "tag-2"] }, TEST_CTX);

    const arg = prismaMock.transactionAlias.create.mock.calls[0][0] as any;
    expect(arg.data.tags.create).toEqual([{ tagId: "tag-1" }, { tagId: "tag-2" }]);
  });

  it("não cria vínculo de tags quando tagIds está vazio (DD-04)", async () => {
    prismaMock.transactionAlias.findFirst.mockResolvedValue(null);
    prismaMock.transactionAlias.create.mockResolvedValue({ id: "alias-1" } as never);

    await createTransactionAlias(BASE_INPUT, TEST_CTX);

    const arg = prismaMock.transactionAlias.create.mock.calls[0][0] as any;
    expect(arg.data.tags).toBeUndefined();
  });

  it("rejeita gatilho colidente na mesma Account (ConflictError)", async () => {
    prismaMock.transactionAlias.findFirst.mockResolvedValue({ id: "existing" } as never);

    await expect(createTransactionAlias(BASE_INPUT, TEST_CTX)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("rejeita categoryId de outra Account (IDOR)", async () => {
    prismaMock.category.findFirst.mockResolvedValue(null);

    await expect(
      createTransactionAlias({ ...BASE_INPUT, categoryId: "cat-outra-account" }, TEST_CTX),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejeita subcategoryId de outra Account (IDOR)", async () => {
    prismaMock.category.findFirst.mockResolvedValue({ id: "cat-1" } as never);
    prismaMock.subcategory.findFirst.mockResolvedValue(null);

    await expect(
      createTransactionAlias(
        { ...BASE_INPUT, categoryId: "cat-1", subcategoryId: "sub-outra-account" },
        TEST_CTX,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejeita subcategoryId cujo pai difere do categoryId do apelido (DD-18)", async () => {
    prismaMock.category.findFirst.mockResolvedValue({ id: "cat-1" } as never);
    prismaMock.subcategory.findFirst.mockResolvedValue({ categoryId: "cat-2" } as never);

    await expect(
      createTransactionAlias(
        { ...BASE_INPUT, categoryId: "cat-1", subcategoryId: "sub-1" },
        TEST_CTX,
      ),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("rejeita institutionId de outra Account (IDOR)", async () => {
    prismaMock.institution.findFirst.mockResolvedValue(null);

    await expect(
      createTransactionAlias({ ...BASE_INPUT, institutionId: "inst-outra-account" }, TEST_CTX),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejeita responsiblePartyId de outra Account (IDOR)", async () => {
    prismaMock.responsibleParty.findFirst.mockResolvedValue(null);

    await expect(
      createTransactionAlias(
        { ...BASE_INPUT, responsiblePartyId: "party-outra-account" },
        TEST_CTX,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejeita tagId de outra Account (IDOR)", async () => {
    prismaMock.tag.count.mockResolvedValue(1); // só 1 das 2 pertence à Account

    await expect(
      createTransactionAlias({ ...BASE_INPUT, tagIds: ["tag-1", "tag-outra-account"] }, TEST_CTX),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("deduplica tagIds antes de checar ownership e persistir", async () => {
    prismaMock.transactionAlias.findFirst.mockResolvedValue(null);
    prismaMock.tag.count.mockResolvedValue(1);
    prismaMock.transactionAlias.create.mockResolvedValue({ id: "alias-1" } as never);

    await createTransactionAlias({ ...BASE_INPUT, tagIds: ["tag-1", "tag-1"] }, TEST_CTX);

    expect(prismaMock.tag.count).toHaveBeenCalledWith({
      where: { id: { in: ["tag-1"] }, accountId: "acc-test-1" },
    });
    const arg = prismaMock.transactionAlias.create.mock.calls[0][0] as any;
    expect(arg.data.tags.create).toEqual([{ tagId: "tag-1" }]);
  });
});

describe("updateTransactionAlias", () => {
  it("rejeita apelido de outra Account (multi-tenancy)", async () => {
    prismaMock.transactionAlias.findFirst.mockResolvedValue(null);

    await expect(
      updateTransactionAlias({ aliasId: "other-acc-alias", trigger: "X" }, TEST_CTX),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("resolve subcategoria efetiva contra o categoryId já persistido quando não tocado (DD-18)", async () => {
    prismaMock.transactionAlias.findFirst
      .mockResolvedValueOnce({ categoryId: "cat-1", subcategoryId: null } as never) // existing
      .mockResolvedValueOnce(null); // collision check (trigger não mudou aqui, mas defensivo)
    prismaMock.subcategory.findFirst.mockResolvedValue({ categoryId: "cat-2" } as never); // pai diferente

    await expect(
      updateTransactionAlias({ aliasId: "alias-1", subcategoryId: "sub-1" }, TEST_CTX),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("substitui o conjunto de tags (delete + createMany) quando tagIds é fornecido", async () => {
    prismaMock.transactionAlias.findFirst.mockResolvedValue({
      categoryId: null,
      subcategoryId: null,
    } as never);
    prismaMock.tag.count.mockResolvedValue(1);
    prismaMock.$transaction.mockImplementation(async (cb: any) => cb(prismaMock));

    await updateTransactionAlias({ aliasId: "alias-1", tagIds: ["tag-1"] }, TEST_CTX);

    expect(prismaMock.transactionAliasTag.deleteMany).toHaveBeenCalledWith({
      where: { aliasId: "alias-1" },
    });
    expect(prismaMock.transactionAliasTag.createMany).toHaveBeenCalledWith({
      data: [{ aliasId: "alias-1", tagId: "tag-1" }],
    });
  });

  it("persiste favorito e moeda estrangeira no update (patch parcial)", async () => {
    prismaMock.transactionAlias.findFirst.mockResolvedValue({
      categoryId: null,
      subcategoryId: null,
      institutionId: null,
      institutionText: null,
    } as never);
    prismaMock.$transaction.mockImplementation(async (cb: any) => cb(prismaMock));

    await updateTransactionAlias(
      {
        aliasId: "alias-1",
        isFavorite: true,
        originalCurrency: "USD",
        originalAmountCents: 1299n,
        exchangeRate: 5.12,
      },
      TEST_CTX,
    );

    const arg = prismaMock.transactionAlias.update.mock.calls[0][0] as any;
    expect(arg.data.isFavorite).toBe(true);
    expect(arg.data.originalCurrency).toBe("USD");
    expect(arg.data.originalAmountCents).toBe(1299n);
    expect(arg.data.exchangeRate).toBe(5.12);
  });

  it("persiste correspondência avançada no update (patch parcial)", async () => {
    prismaMock.transactionAlias.findFirst.mockResolvedValue({
      categoryId: null,
      subcategoryId: null,
      institutionId: null,
      institutionText: null,
    } as never);
    prismaMock.institution.findFirst.mockResolvedValue({ id: "inst-cond" } as never);
    prismaMock.$transaction.mockImplementation(async (cb: any) => cb(prismaMock));

    await updateTransactionAlias(
      {
        aliasId: "alias-1",
        triggerMode: "regex",
        priority: "low",
        conditionInstitutionId: "inst-cond",
        minCents: 100n,
        maxCents: 900n,
      },
      TEST_CTX,
    );

    const arg = prismaMock.transactionAlias.update.mock.calls[0][0] as any;
    expect(arg.data.triggerMode).toBe("regex");
    expect(arg.data.priority).toBe("low");
    expect(arg.data.conditionInstitutionId).toBe("inst-cond");
    expect(arg.data.minCents).toBe(100n);
    expect(arg.data.maxCents).toBe(900n);
  });

  it("rejeita conditionInstitutionId de outra Account no update (IDOR)", async () => {
    prismaMock.transactionAlias.findFirst.mockResolvedValueOnce({
      categoryId: null,
      subcategoryId: null,
      institutionId: null,
      institutionText: null,
    } as never);
    prismaMock.institution.findFirst.mockResolvedValue(null);

    await expect(
      updateTransactionAlias(
        { aliasId: "alias-1", conditionInstitutionId: "inst-outra-account" },
        TEST_CTX,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejeita colisão de gatilho com outro apelido da mesma Account", async () => {
    prismaMock.transactionAlias.findFirst
      .mockResolvedValueOnce({ categoryId: null, subcategoryId: null } as never) // existing
      .mockResolvedValueOnce({ id: "outro-alias" } as never); // collision

    await expect(
      updateTransactionAlias({ aliasId: "alias-1", trigger: "GAS" }, TEST_CTX),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("rejeita limpar a categoria (categoryId: null) mantendo a subcategoria persistida (DD-18)", async () => {
    prismaMock.transactionAlias.findFirst.mockResolvedValueOnce({
      categoryId: "cat-1",
      subcategoryId: "sub-1",
      institutionId: null,
      institutionText: null,
    } as never);
    prismaMock.subcategory.findFirst.mockResolvedValue({ categoryId: "cat-1" } as never);

    await expect(
      updateTransactionAlias({ aliasId: "alias-1", categoryId: null }, TEST_CTX),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("rejeita institutionId novo quando institutionText persistido não foi limpo no mesmo patch (DD-14)", async () => {
    prismaMock.transactionAlias.findFirst.mockResolvedValueOnce({
      categoryId: null,
      subcategoryId: null,
      institutionId: null,
      institutionText: "Nubank",
    } as never);
    prismaMock.institution.findFirst.mockResolvedValue({ id: "inst-1" } as never);

    await expect(
      updateTransactionAlias({ aliasId: "alias-1", institutionId: "inst-1" }, TEST_CTX),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("rejeita categoryId de outra Account no update (IDOR)", async () => {
    prismaMock.transactionAlias.findFirst.mockResolvedValueOnce({
      categoryId: null,
      subcategoryId: null,
      institutionId: null,
      institutionText: null,
    } as never);
    prismaMock.category.findFirst.mockResolvedValue(null);

    await expect(
      updateTransactionAlias({ aliasId: "alias-1", categoryId: "cat-outra-account" }, TEST_CTX),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejeita subcategoryId de outra Account no update (IDOR)", async () => {
    prismaMock.transactionAlias.findFirst.mockResolvedValueOnce({
      categoryId: "cat-1",
      subcategoryId: null,
      institutionId: null,
      institutionText: null,
    } as never);
    prismaMock.subcategory.findFirst.mockResolvedValue(null);

    await expect(
      updateTransactionAlias({ aliasId: "alias-1", subcategoryId: "sub-outra-account" }, TEST_CTX),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejeita institutionId de outra Account no update (IDOR)", async () => {
    prismaMock.transactionAlias.findFirst.mockResolvedValueOnce({
      categoryId: null,
      subcategoryId: null,
      institutionId: null,
      institutionText: null,
    } as never);
    prismaMock.institution.findFirst.mockResolvedValue(null);

    await expect(
      updateTransactionAlias({ aliasId: "alias-1", institutionId: "inst-outra-account" }, TEST_CTX),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejeita responsiblePartyId de outra Account no update (IDOR)", async () => {
    prismaMock.transactionAlias.findFirst.mockResolvedValueOnce({
      categoryId: null,
      subcategoryId: null,
      institutionId: null,
      institutionText: null,
    } as never);
    prismaMock.responsibleParty.findFirst.mockResolvedValue(null);

    await expect(
      updateTransactionAlias(
        { aliasId: "alias-1", responsiblePartyId: "party-outra-account" },
        TEST_CTX,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejeita tagId de outra Account no update (IDOR)", async () => {
    prismaMock.transactionAlias.findFirst.mockResolvedValueOnce({
      categoryId: null,
      subcategoryId: null,
      institutionId: null,
      institutionText: null,
    } as never);
    prismaMock.tag.count.mockResolvedValue(0);

    await expect(
      updateTransactionAlias({ aliasId: "alias-1", tagIds: ["tag-outra-account"] }, TEST_CTX),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("archiveTransactionAlias", () => {
  it("arquiva e desarquiva via toggle escopado por accountId", async () => {
    prismaMock.transactionAlias.updateMany.mockResolvedValue({ count: 1 } as never);

    await archiveTransactionAlias({ aliasId: "alias-1", archived: true }, TEST_CTX);

    expect(prismaMock.transactionAlias.updateMany).toHaveBeenCalledWith({
      where: { id: "alias-1", accountId: "acc-test-1" },
      data: { archivedAt: expect.any(Date) },
    });
  });

  it("rejeita apelido de outra Account (multi-tenancy)", async () => {
    prismaMock.transactionAlias.updateMany.mockResolvedValue({ count: 0 } as never);

    await expect(
      archiveTransactionAlias({ aliasId: "other-acc-alias", archived: true }, TEST_CTX),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("deleteTransactionAlias", () => {
  it("deleta (hard delete) escopado por accountId", async () => {
    prismaMock.transactionAlias.deleteMany.mockResolvedValue({ count: 1 } as never);

    await deleteTransactionAlias({ aliasId: "alias-1" }, TEST_CTX);

    expect(prismaMock.transactionAlias.deleteMany).toHaveBeenCalledWith({
      where: { id: "alias-1", accountId: "acc-test-1" },
    });
  });

  it("rejeita apelido de outra Account (multi-tenancy)", async () => {
    prismaMock.transactionAlias.deleteMany.mockResolvedValue({ count: 0 } as never);

    await expect(
      deleteTransactionAlias({ aliasId: "other-acc-alias" }, TEST_CTX),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("createTransactionAliasSchema", () => {
  it("rejeita gatilho vazio ou só espaços", () => {
    expect(createTransactionAliasSchema.safeParse({ ...BASE_INPUT, trigger: "" }).success).toBe(
      false,
    );
    expect(createTransactionAliasSchema.safeParse({ ...BASE_INPUT, trigger: "   " }).success).toBe(
      false,
    );
  });

  it("aceita gatilho curto (<3 chars) — aviso é só de UI (DD-19)", () => {
    expect(createTransactionAliasSchema.safeParse({ ...BASE_INPUT, trigger: "TV" }).success).toBe(
      true,
    );
  });

  it("rejeita institutionId e institutionText juntos (DD-14)", () => {
    const r = createTransactionAliasSchema.safeParse({
      ...BASE_INPUT,
      institutionId: "inst-1",
      institutionText: "Banco X",
    });
    expect(r.success).toBe(false);
  });

  it("rejeita subcategoryId sem categoryId na criação (DD-18, backstop de presença)", () => {
    const r = createTransactionAliasSchema.safeParse({ ...BASE_INPUT, subcategoryId: "sub-1" });
    expect(r.success).toBe(false);
  });

  it("aceita payload todo nulo (patch vazio é válido — só o gatilho é obrigatório)", () => {
    expect(createTransactionAliasSchema.safeParse(BASE_INPUT).success).toBe(true);
  });

  it("aplica defaults de triggerMode (contains) e priority (medium)", () => {
    const { triggerMode, ...withoutMode } = BASE_INPUT;
    const r = createTransactionAliasSchema.safeParse(withoutMode);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.triggerMode).toBe("contains");
      expect(r.data.priority).toBe("medium");
    }
  });

  it("no modo regex, rejeita gatilho que não é regex válida", () => {
    const r = createTransactionAliasSchema.safeParse({
      ...BASE_INPUT,
      triggerMode: "regex",
      trigger: "(",
    });
    expect(r.success).toBe(false);
  });

  it("no modo regex, rejeita padrão com backtracking catastrófico (ReDoS)", () => {
    const r = createTransactionAliasSchema.safeParse({
      ...BASE_INPUT,
      triggerMode: "regex",
      trigger: "(a+)+$",
    });
    expect(r.success).toBe(false);
  });

  it("no modo regex, aceita gatilho de regex válida e segura", () => {
    const r = createTransactionAliasSchema.safeParse({
      ...BASE_INPUT,
      triggerMode: "regex",
      trigger: "^UBER \\d+",
    });
    expect(r.success).toBe(true);
  });

  it("no modo contains, não valida o gatilho como regex (parênteses são literais)", () => {
    const r = createTransactionAliasSchema.safeParse({
      ...BASE_INPUT,
      triggerMode: "contains",
      trigger: "loja (matriz)",
    });
    expect(r.success).toBe(true);
  });
});
