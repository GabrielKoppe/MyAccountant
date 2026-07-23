import { describe, expect, it, vi } from "vitest";

import "../../tests/mocks/auth";
import { TEST_CTX, buildAccountMember } from "../../tests/fixtures/account";
import { requireAccountAccess } from "@/server/auth/session";
import { ConflictError, NotFoundError } from "@/server/api/errors";

// Mock next/cache e prisma para não falhar em ambiente de testes
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/server/prisma", async () => {
  const { mockDeep } = await import("vitest-mock-extended");
  const mock = mockDeep();
  return { prisma: mock };
});

// Mock do service para isolar as actions dos detalhes de Prisma
vi.mock("@/server/services/goal-service");

import * as goalService from "@/server/services/goal-service";
import { revalidatePath } from "next/cache";

// Reexporta o mock com tipagem para uso nos testes
const serviceMock = vi.mocked(goalService);

import {
  createGoalAction,
  updateGoalAction,
  deleteGoalAction,
  archiveGoalAction,
  addContributionAction,
  deleteContributionAction,
  linkSuggestedContributionAction,
  getGoalDetailAction,
  getGoalSuggestionsAction,
} from "./goals";

const GOAL_ID = "cgoal1testaaaaaaaaaaaaaa";
const TX_ID = "ctxn1testaaaaaaaaaaaaaaa";
const CONTRIBUTION_ID = "ccontrib1testaaaaaaaaaaa";

/** Faz requireAccountAccess resolver com papel "viewer" para a próxima chamada. */
function mockViewerRole() {
  vi.mocked(requireAccountAccess).mockResolvedValueOnce({
    user: { id: TEST_CTX.userId, email: "test@example.com", name: "Test User" },
    member: buildAccountMember({ role: "viewer" }),
  });
}

describe("goals actions — autorização (GOAL-01/03 papéis owner/editor)", () => {
  it("createGoalAction: viewer não pode criar meta", async () => {
    mockViewerRole();

    const result = await createGoalAction(TEST_CTX.accountId, {
      name: "Viagem ao Japão",
      targetCents: "200000",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
    expect(serviceMock.createGoal).not.toHaveBeenCalled();
  });

  it("updateGoalAction: viewer não pode editar meta", async () => {
    mockViewerRole();

    const result = await updateGoalAction(TEST_CTX.accountId, {
      goalId: GOAL_ID,
      name: "Meta atualizada",
      targetCents: "200000",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
    expect(serviceMock.updateGoal).not.toHaveBeenCalled();
  });

  it("deleteGoalAction: viewer não pode excluir meta", async () => {
    mockViewerRole();

    const result = await deleteGoalAction(TEST_CTX.accountId, { goalId: GOAL_ID });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
    expect(serviceMock.deleteGoal).not.toHaveBeenCalled();
  });

  it("archiveGoalAction: viewer não pode arquivar meta", async () => {
    mockViewerRole();

    const result = await archiveGoalAction(TEST_CTX.accountId, {
      goalId: GOAL_ID,
      archived: true,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
    expect(serviceMock.archiveGoal).not.toHaveBeenCalled();
  });

  it("addContributionAction: viewer não pode registrar aporte", async () => {
    mockViewerRole();

    const result = await addContributionAction(TEST_CTX.accountId, {
      goalId: GOAL_ID,
      amountCents: "10000",
      contributedOn: "2026-07-01",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
    expect(serviceMock.addContribution).not.toHaveBeenCalled();
  });

  it("deleteContributionAction: viewer não pode excluir aporte", async () => {
    mockViewerRole();

    const result = await deleteContributionAction(TEST_CTX.accountId, {
      contributionId: CONTRIBUTION_ID,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
    expect(serviceMock.deleteContribution).not.toHaveBeenCalled();
  });

  it("linkSuggestedContributionAction: viewer não pode vincular sugestão", async () => {
    mockViewerRole();

    const result = await linkSuggestedContributionAction(TEST_CTX.accountId, {
      goalId: GOAL_ID,
      transactionId: TX_ID,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
    expect(serviceMock.linkTransactionAsContribution).not.toHaveBeenCalled();
  });
});

describe("goals actions — leitura do drawer de detalhe (Fase 9, sem requireRoles)", () => {
  it("getGoalDetailAction: viewer também pode ler (só leitura, não é mutação)", async () => {
    mockViewerRole();

    const result = await getGoalDetailAction(TEST_CTX.accountId, { goalId: GOAL_ID });

    // Sem meta mockada no prisma (deep mock), a query real cai no caminho
    // "não encontrada" e resolve com sucesso — o que importa aqui é que NÃO
    // seja bloqueada por FORBIDDEN antes de chegar na query.
    expect(result.ok).toBe(true);
  });

  it("getGoalSuggestionsAction: viewer também pode ler (só leitura, não é mutação)", async () => {
    mockViewerRole();

    const result = await getGoalSuggestionsAction(TEST_CTX.accountId, { goalId: GOAL_ID });

    expect(result.ok).toBe(true);
  });

  it("getGoalDetailAction: goalId inválido (não-cuid) é rejeitado (VALIDATION)", async () => {
    const result = await getGoalDetailAction(TEST_CTX.accountId, { goalId: "não-é-um-cuid" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION");
  });
});

describe("goals actions — validação", () => {
  it("createGoalAction: targetCents ≤ 0 é rejeitado (VALIDATION)", async () => {
    const result = await createGoalAction(TEST_CTX.accountId, {
      name: "Meta inválida",
      targetCents: "0",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION");
    expect(serviceMock.createGoal).not.toHaveBeenCalled();
  });

  it("createGoalAction: deadline no passado é rejeitada (VALIDATION)", async () => {
    const result = await createGoalAction(TEST_CTX.accountId, {
      name: "Meta com prazo vencido",
      targetCents: "100000",
      deadline: "2020-01-01",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION");
    expect(serviceMock.createGoal).not.toHaveBeenCalled();
  });

  it("linkSuggestedContributionAction: transactionId inválido (não-cuid) é rejeitado (VALIDATION)", async () => {
    const result = await linkSuggestedContributionAction(TEST_CTX.accountId, {
      goalId: GOAL_ID,
      transactionId: "não-é-um-cuid",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION");
    expect(serviceMock.linkTransactionAsContribution).not.toHaveBeenCalled();
  });
});

describe("goals actions — propagação de erros do service", () => {
  it("linkSuggestedContributionAction: NotFoundError do service (transação cross-account) vira NOT_FOUND", async () => {
    serviceMock.linkTransactionAsContribution.mockRejectedValue(new NotFoundError("Transação"));

    const result = await linkSuggestedContributionAction(TEST_CTX.accountId, {
      goalId: GOAL_ID,
      transactionId: TX_ID,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
  });

  it("linkSuggestedContributionAction: ConflictError do service (vínculo duplicado) vira CONFLICT", async () => {
    serviceMock.linkTransactionAsContribution.mockRejectedValue(
      new ConflictError("Esta transação já foi vinculada a um aporte."),
    );

    const result = await linkSuggestedContributionAction(TEST_CTX.accountId, {
      goalId: GOAL_ID,
      transactionId: TX_ID,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("CONFLICT");
  });
});

describe("goals actions — caminho feliz (owner)", () => {
  it("createGoalAction: owner cria meta e revalida a aba Metas", async () => {
    serviceMock.createGoal.mockResolvedValue({ goalId: GOAL_ID });

    const result = await createGoalAction(TEST_CTX.accountId, {
      name: "Viagem ao Japão",
      targetCents: "200000",
    });

    expect(result.ok).toBe(true);
    expect(serviceMock.createGoal).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Viagem ao Japão", targetCents: 200000n }),
      expect.objectContaining({ accountId: TEST_CTX.accountId }),
    );
    expect(revalidatePath).toHaveBeenCalledWith(`/${TEST_CTX.accountId}/planning/goals`);
  });

  it("linkSuggestedContributionAction: owner vincula sugestão e revalida a aba Metas", async () => {
    serviceMock.linkTransactionAsContribution.mockResolvedValue({
      contributionId: CONTRIBUTION_ID,
    });

    const result = await linkSuggestedContributionAction(TEST_CTX.accountId, {
      goalId: GOAL_ID,
      transactionId: TX_ID,
    });

    expect(result.ok).toBe(true);
    expect(serviceMock.linkTransactionAsContribution).toHaveBeenCalledWith(
      expect.objectContaining({ goalId: GOAL_ID, transactionId: TX_ID }),
      expect.objectContaining({ accountId: TEST_CTX.accountId }),
    );
    expect(revalidatePath).toHaveBeenCalledWith(`/${TEST_CTX.accountId}/planning/goals`);
  });
});
