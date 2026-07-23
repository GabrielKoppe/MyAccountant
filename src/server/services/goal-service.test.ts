import { describe, expect, it, beforeEach } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";
import { TEST_CTX } from "@/../tests/fixtures/account";
import { ConflictError, NotFoundError } from "@/server/api/errors";

import {
  createGoal,
  updateGoal,
  deleteGoal,
  archiveGoal,
  addContribution,
  deleteContribution,
  linkTransactionAsContribution,
} from "./goal-service";

// FIX atomicidade (spec 47 §7): updateGoal/addContribution/deleteContribution rodam a
// escrita + recompute de isAchieved dentro de `prisma.$transaction(async (trx) => ...)`.
// Resolvendo o mock assim, a `trx` do callback É o próprio `prismaMock` — todo assert
// existente em `prismaMock.<model>.<method>` continua batendo sem qualquer outra mudança.
beforeEach(() => {
  prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock));
});

// ─── createGoal ─────────────────────────────────────────────────────────

describe("createGoal", () => {
  it("deve criar meta com sucesso gravando accountId/createdById do ctx", async () => {
    prismaMock.goal.create.mockResolvedValue({ id: "goal-1" } as any);

    const result = await createGoal(
      {
        name: "Viagem ao Japão",
        targetCents: 2000000n,
        deadline: null,
        sectionId: null,
        categoryId: null,
      },
      TEST_CTX,
    );

    expect(result.goalId).toBe("goal-1");
    expect(prismaMock.goal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountId: "acc-test-1",
          name: "Viagem ao Japão",
          targetCents: 2000000n,
          deadline: null,
          sectionId: null,
          categoryId: null,
          createdById: "user-test-1",
        }),
      }),
    );
  });

  it("rejeita sectionId de outra account (IDOR)", async () => {
    prismaMock.section.findFirst.mockResolvedValue(null);

    await expect(
      createGoal(
        {
          name: "Meta",
          targetCents: 1000n,
          deadline: null,
          sectionId: "sec-outra",
          categoryId: null,
        },
        TEST_CTX,
      ),
    ).rejects.toThrow(NotFoundError);

    expect(prismaMock.goal.create).not.toHaveBeenCalled();
  });

  it("rejeita categoryId de outra account (IDOR)", async () => {
    prismaMock.category.findFirst.mockResolvedValue(null);

    await expect(
      createGoal(
        {
          name: "Meta",
          targetCents: 1000n,
          deadline: null,
          sectionId: null,
          categoryId: "cat-outra",
        },
        TEST_CTX,
      ),
    ).rejects.toThrow(NotFoundError);

    expect(prismaMock.goal.create).not.toHaveBeenCalled();
  });
});

// ─── updateGoal ─────────────────────────────────────────────────────────

describe("updateGoal", () => {
  const baseInput = {
    goalId: "goal-1",
    name: "Meta atualizada",
    targetCents: 100000n,
    deadline: null,
    sectionId: null,
    categoryId: null,
  };

  it("deve atualizar meta com sucesso (isAchieved recomputado como false)", async () => {
    prismaMock.goal.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.goalContribution.aggregate.mockResolvedValue({
      _sum: { amountCents: 30000n },
    } as any);
    prismaMock.goal.update.mockResolvedValue({} as any);

    await updateGoal(baseInput, TEST_CTX);

    expect(prismaMock.goal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "goal-1" },
        data: expect.objectContaining({
          name: "Meta atualizada",
          targetCents: 100000n,
          isAchieved: false,
        }),
      }),
    );
  });

  it("recomputa isAchieved=true quando o novo alvo cai para um valor já coberto pelo progresso", async () => {
    prismaMock.goal.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.goalContribution.aggregate.mockResolvedValue({
      _sum: { amountCents: 80000n },
    } as any);
    prismaMock.goal.update.mockResolvedValue({} as any);

    await updateGoal({ ...baseInput, targetCents: 50000n }, TEST_CTX); // alvo cai abaixo do progresso (80000)

    expect(prismaMock.goal.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isAchieved: true }) }),
    );
  });

  it("recomputa isAchieved=false quando o novo alvo sobe acima do progresso (DD-06 — meta deixa de estar atingida)", async () => {
    prismaMock.goal.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.goalContribution.aggregate.mockResolvedValue({
      _sum: { amountCents: 60000n },
    } as any); // batia o alvo antigo
    prismaMock.goal.update.mockResolvedValue({} as any);

    await updateGoal({ ...baseInput, targetCents: 200000n }, TEST_CTX); // novo alvo > progresso

    expect(prismaMock.goal.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isAchieved: false }) }),
    );
  });

  it("não deve atualizar meta de outra account (multi-tenancy)", async () => {
    prismaMock.goal.findUnique.mockResolvedValue({ accountId: "acc-OUTRA" } as any);

    await expect(updateGoal(baseInput, TEST_CTX)).rejects.toThrow(NotFoundError);

    expect(prismaMock.goal.update).not.toHaveBeenCalled();
  });

  it("rejeita sectionId de outra account (IDOR)", async () => {
    prismaMock.goal.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.section.findFirst.mockResolvedValue(null);

    await expect(updateGoal({ ...baseInput, sectionId: "sec-outra" }, TEST_CTX)).rejects.toThrow(
      NotFoundError,
    );

    expect(prismaMock.goal.update).not.toHaveBeenCalled();
  });

  it("rejeita categoryId de outra account (IDOR)", async () => {
    prismaMock.goal.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.category.findFirst.mockResolvedValue(null);

    await expect(updateGoal({ ...baseInput, categoryId: "cat-outra" }, TEST_CTX)).rejects.toThrow(
      NotFoundError,
    );

    expect(prismaMock.goal.update).not.toHaveBeenCalled();
  });

  it("deve lançar NotFoundError quando meta não existe", async () => {
    prismaMock.goal.findUnique.mockResolvedValue(null);

    await expect(updateGoal(baseInput, TEST_CTX)).rejects.toThrow(NotFoundError);

    expect(prismaMock.goal.update).not.toHaveBeenCalled();
  });
});

// ─── deleteGoal ─────────────────────────────────────────────────────────

describe("deleteGoal", () => {
  it("deve excluir meta com sucesso", async () => {
    prismaMock.goal.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.goal.delete.mockResolvedValue({} as any);

    await deleteGoal({ goalId: "goal-1" }, TEST_CTX);

    expect(prismaMock.goal.delete).toHaveBeenCalledWith({ where: { id: "goal-1" } });
  });

  it("não deve excluir meta de outra account (multi-tenancy)", async () => {
    prismaMock.goal.findUnique.mockResolvedValue({ accountId: "acc-OUTRA" } as any);

    await expect(deleteGoal({ goalId: "goal-1" }, TEST_CTX)).rejects.toThrow(NotFoundError);

    expect(prismaMock.goal.delete).not.toHaveBeenCalled();
  });

  it("deve lançar NotFoundError quando meta não existe", async () => {
    prismaMock.goal.findUnique.mockResolvedValue(null);

    await expect(deleteGoal({ goalId: "goal-inexistente" }, TEST_CTX)).rejects.toThrow(
      NotFoundError,
    );

    expect(prismaMock.goal.delete).not.toHaveBeenCalled();
  });
});

// ─── archiveGoal ─────────────────────────────────────────────────────────

describe("archiveGoal", () => {
  it("deve arquivar meta preenchendo archivedAt", async () => {
    prismaMock.goal.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.goal.update.mockResolvedValue({} as any);

    await archiveGoal({ goalId: "goal-1", archived: true }, TEST_CTX);

    expect(prismaMock.goal.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "goal-1" }, data: { archivedAt: expect.any(Date) } }),
    );
  });

  it("deve desarquivar meta zerando archivedAt", async () => {
    prismaMock.goal.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.goal.update.mockResolvedValue({} as any);

    await archiveGoal({ goalId: "goal-1", archived: false }, TEST_CTX);

    expect(prismaMock.goal.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "goal-1" }, data: { archivedAt: null } }),
    );
  });

  it("não deve arquivar meta de outra account (multi-tenancy)", async () => {
    prismaMock.goal.findUnique.mockResolvedValue({ accountId: "acc-OUTRA" } as any);

    await expect(archiveGoal({ goalId: "goal-1", archived: true }, TEST_CTX)).rejects.toThrow(
      NotFoundError,
    );

    expect(prismaMock.goal.update).not.toHaveBeenCalled();
  });
});

// ─── addContribution ─────────────────────────────────────────────────────

describe("addContribution", () => {
  const baseInput = {
    goalId: "goal-1",
    amountCents: 10000n,
    contributedOn: new Date("2026-07-01"),
    transactionId: null,
    responsiblePartyId: null,
    notes: null,
  };

  it("deve registrar aporte gravando byUserId do ctx (nunca do body)", async () => {
    prismaMock.goal.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      targetCents: 100000n,
    } as any);
    prismaMock.goalContribution.create.mockResolvedValue({ id: "contrib-1" } as any);
    prismaMock.goalContribution.aggregate.mockResolvedValue({
      _sum: { amountCents: 10000n },
    } as any);
    prismaMock.goal.update.mockResolvedValue({} as any);

    const result = await addContribution(baseInput, TEST_CTX);

    expect(result.contributionId).toBe("contrib-1");
    expect(prismaMock.goalContribution.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountId: "acc-test-1",
          goalId: "goal-1",
          amountCents: 10000n,
          byUserId: "user-test-1",
          responsiblePartyId: null,
          transactionId: null,
        }),
      }),
    );
  });

  it("isAchieved vira true quando a soma das contribuições cruza o alvo", async () => {
    prismaMock.goal.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      targetCents: 10000n,
    } as any);
    prismaMock.goalContribution.create.mockResolvedValue({ id: "contrib-1" } as any);
    prismaMock.goalContribution.aggregate.mockResolvedValue({
      _sum: { amountCents: 10000n },
    } as any); // == alvo

    await addContribution(baseInput, TEST_CTX);

    expect(prismaMock.goal.update).toHaveBeenCalledWith({
      where: { id: "goal-1" },
      data: { isAchieved: true },
    });
  });

  it("isAchieved permanece false quando a soma ainda não atinge o alvo", async () => {
    prismaMock.goal.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      targetCents: 999999n,
    } as any);
    prismaMock.goalContribution.create.mockResolvedValue({ id: "contrib-1" } as any);
    prismaMock.goalContribution.aggregate.mockResolvedValue({
      _sum: { amountCents: 10000n },
    } as any);

    await addContribution(baseInput, TEST_CTX);

    expect(prismaMock.goal.update).toHaveBeenCalledWith({
      where: { id: "goal-1" },
      data: { isAchieved: false },
    });
  });

  it("não deve registrar aporte em meta de outra account (multi-tenancy)", async () => {
    prismaMock.goal.findUnique.mockResolvedValue({
      accountId: "acc-OUTRA",
      targetCents: 100000n,
    } as any);

    await expect(addContribution(baseInput, TEST_CTX)).rejects.toThrow(NotFoundError);

    expect(prismaMock.goalContribution.create).not.toHaveBeenCalled();
  });

  it("rejeita transactionId de outra account (IDOR)", async () => {
    prismaMock.goal.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      targetCents: 100000n,
    } as any);
    prismaMock.transaction.findUnique.mockResolvedValue({
      accountId: "acc-OUTRA",
      responsiblePartyId: null,
    } as any);

    await expect(
      addContribution({ ...baseInput, transactionId: "tx-outra" }, TEST_CTX),
    ).rejects.toThrow(NotFoundError);

    expect(prismaMock.goalContribution.create).not.toHaveBeenCalled();
  });

  it("herda responsiblePartyId da transação vinculada, ignorando responsiblePartyId do body (GOAL-03)", async () => {
    prismaMock.goal.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      targetCents: 100000n,
    } as any);
    prismaMock.transaction.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      responsiblePartyId: "party-real",
    } as any);
    prismaMock.goalContribution.create.mockResolvedValue({ id: "contrib-1" } as any);
    prismaMock.goalContribution.aggregate.mockResolvedValue({
      _sum: { amountCents: 10000n },
    } as any);

    await addContribution(
      { ...baseInput, transactionId: "tx-1", responsiblePartyId: "party-forjado-pelo-body" },
      TEST_CTX,
    );

    expect(prismaMock.goalContribution.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ responsiblePartyId: "party-real", transactionId: "tx-1" }),
      }),
    );
  });

  it("rejeita responsiblePartyId de outra account quando não há transactionId (IDOR)", async () => {
    prismaMock.goal.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      targetCents: 100000n,
    } as any);
    prismaMock.responsibleParty.findUnique.mockResolvedValue({ accountId: "acc-OUTRA" } as any);

    await expect(
      addContribution({ ...baseInput, responsiblePartyId: "party-outra" }, TEST_CTX),
    ).rejects.toThrow(NotFoundError);

    expect(prismaMock.goalContribution.create).not.toHaveBeenCalled();
  });

  // C2 (fix wave): addContribution chamado direto (fora do fluxo de sugestão) com
  // um transactionId já vinculado a outro aporte dobrava a contagem sem erro. Agora
  // usa o mesmo guard (assertTransactionNotLinked) de linkTransactionAsContribution.
  it("rejeita transactionId já vinculado a outro aporte — dedup (ConflictError, C2)", async () => {
    prismaMock.goal.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      targetCents: 100000n,
    } as any);
    prismaMock.transaction.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      responsiblePartyId: null,
    } as any);
    prismaMock.goalContribution.findFirst.mockResolvedValue({ id: "contrib-existente" } as any);

    await expect(
      addContribution({ ...baseInput, transactionId: "tx-1" }, TEST_CTX),
    ).rejects.toThrow(ConflictError);

    expect(prismaMock.goalContribution.create).not.toHaveBeenCalled();
  });

  it("aceita responsiblePartyId direto quando pertence à account (sem transactionId)", async () => {
    prismaMock.goal.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      targetCents: 100000n,
    } as any);
    prismaMock.responsibleParty.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.goalContribution.create.mockResolvedValue({ id: "contrib-1" } as any);
    prismaMock.goalContribution.aggregate.mockResolvedValue({
      _sum: { amountCents: 10000n },
    } as any);

    await addContribution({ ...baseInput, responsiblePartyId: "party-1" }, TEST_CTX);

    expect(prismaMock.goalContribution.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ responsiblePartyId: "party-1" }) }),
    );
  });
});

// ─── deleteContribution ─────────────────────────────────────────────────

describe("deleteContribution", () => {
  it("deve excluir aporte; Σ vazio (null) tratado como 0 e isAchieved cai para false", async () => {
    prismaMock.goalContribution.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      goalId: "goal-1",
      goal: { targetCents: 100000n },
    } as any);
    prismaMock.goalContribution.delete.mockResolvedValue({} as any);
    prismaMock.goalContribution.aggregate.mockResolvedValue({ _sum: { amountCents: null } } as any);

    await deleteContribution({ contributionId: "contrib-1" }, TEST_CTX);

    expect(prismaMock.goalContribution.delete).toHaveBeenCalledWith({ where: { id: "contrib-1" } });
    expect(prismaMock.goal.update).toHaveBeenCalledWith({
      where: { id: "goal-1" },
      data: { isAchieved: false },
    });
  });

  it("isAchieved volta a false ao excluir aporte que cruzava o alvo", async () => {
    prismaMock.goalContribution.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      goalId: "goal-1",
      goal: { targetCents: 10000n },
    } as any);
    prismaMock.goalContribution.delete.mockResolvedValue({} as any);
    // após excluir, a soma restante já não bate mais o alvo
    prismaMock.goalContribution.aggregate.mockResolvedValue({
      _sum: { amountCents: 5000n },
    } as any);

    await deleteContribution({ contributionId: "contrib-1" }, TEST_CTX);

    expect(prismaMock.goal.update).toHaveBeenCalledWith({
      where: { id: "goal-1" },
      data: { isAchieved: false },
    });
  });

  it("isAchieved permanece true se as contribuições restantes ainda cobrem o alvo", async () => {
    prismaMock.goalContribution.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      goalId: "goal-1",
      goal: { targetCents: 10000n },
    } as any);
    prismaMock.goalContribution.delete.mockResolvedValue({} as any);
    prismaMock.goalContribution.aggregate.mockResolvedValue({
      _sum: { amountCents: 15000n },
    } as any);

    await deleteContribution({ contributionId: "contrib-1" }, TEST_CTX);

    expect(prismaMock.goal.update).toHaveBeenCalledWith({
      where: { id: "goal-1" },
      data: { isAchieved: true },
    });
  });

  it("não deve excluir aporte de outra account (multi-tenancy)", async () => {
    prismaMock.goalContribution.findUnique.mockResolvedValue({
      accountId: "acc-OUTRA",
      goalId: "goal-1",
      goal: { targetCents: 100000n },
    } as any);

    await expect(deleteContribution({ contributionId: "contrib-1" }, TEST_CTX)).rejects.toThrow(
      NotFoundError,
    );

    expect(prismaMock.goalContribution.delete).not.toHaveBeenCalled();
  });

  it("deve lançar NotFoundError quando aporte não existe", async () => {
    prismaMock.goalContribution.findUnique.mockResolvedValue(null);

    await expect(
      deleteContribution({ contributionId: "contrib-inexistente" }, TEST_CTX),
    ).rejects.toThrow(NotFoundError);

    expect(prismaMock.goalContribution.delete).not.toHaveBeenCalled();
  });
});

// ─── linkTransactionAsContribution ───────────────────────────────────────

describe("linkTransactionAsContribution", () => {
  const baseInput = { goalId: "goal-1", transactionId: "tx-1" };

  it("cria o aporte com amountCents = abs(tx), herdando responsiblePartyId e contributedOn da transação, e byUserId do ctx", async () => {
    prismaMock.goal.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      targetCents: 100000n,
    } as any);
    prismaMock.transaction.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      amountCents: -5000n, // negativo — prova a conversão abs()
      occurredOn: new Date("2026-07-10"),
      responsiblePartyId: "party-1",
    } as any);
    prismaMock.goalContribution.findFirst.mockResolvedValue(null); // ainda não vinculada
    prismaMock.goalContribution.create.mockResolvedValue({ id: "contrib-1" } as any);
    prismaMock.goalContribution.aggregate.mockResolvedValue({
      _sum: { amountCents: 5000n },
    } as any);
    prismaMock.goal.update.mockResolvedValue({} as any);

    const result = await linkTransactionAsContribution(baseInput, TEST_CTX);

    expect(result.contributionId).toBe("contrib-1");
    expect(prismaMock.goalContribution.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountId: "acc-test-1",
          goalId: "goal-1",
          amountCents: 5000n, // abs(-5000n)
          contributedOn: new Date("2026-07-10"),
          byUserId: "user-test-1", // ctx, nunca do body (GOAL-03)
          responsiblePartyId: "party-1", // herdado da tx
          transactionId: "tx-1",
        }),
      }),
    );
  });

  it("não deve vincular meta de outra account (multi-tenancy)", async () => {
    prismaMock.goal.findUnique.mockResolvedValue({
      accountId: "acc-OUTRA",
      targetCents: 100000n,
    } as any);

    await expect(linkTransactionAsContribution(baseInput, TEST_CTX)).rejects.toThrow(NotFoundError);

    expect(prismaMock.goalContribution.create).not.toHaveBeenCalled();
  });

  it("rejeita transactionId de outra account (IDOR)", async () => {
    prismaMock.goal.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      targetCents: 100000n,
    } as any);
    prismaMock.transaction.findUnique.mockResolvedValue({
      accountId: "acc-OUTRA",
      amountCents: 5000n,
      occurredOn: new Date("2026-07-10"),
      responsiblePartyId: null,
    } as any);

    await expect(linkTransactionAsContribution(baseInput, TEST_CTX)).rejects.toThrow(NotFoundError);

    expect(prismaMock.goalContribution.create).not.toHaveBeenCalled();
  });

  it("rejeita vínculo duplicado — transação já vinculada a um aporte (ConflictError)", async () => {
    prismaMock.goal.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      targetCents: 100000n,
    } as any);
    prismaMock.transaction.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      amountCents: 5000n,
      occurredOn: new Date("2026-07-10"),
      responsiblePartyId: null,
    } as any);
    prismaMock.goalContribution.findFirst.mockResolvedValue({ id: "contrib-existente" } as any);

    await expect(linkTransactionAsContribution(baseInput, TEST_CTX)).rejects.toThrow(ConflictError);

    expect(prismaMock.goalContribution.create).not.toHaveBeenCalled();
  });
});
