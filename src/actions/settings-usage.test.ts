import { beforeEach, describe, expect, it, vi } from "vitest";

import "../../tests/mocks/auth";
import "../../tests/mocks/prisma";
import { TEST_CTX, buildAccountMember } from "../../tests/fixtures/account";
import { NotFoundError } from "@/server/api/errors";
import { requireAccountAccess } from "@/server/auth/session";

// O service é mockado: aqui só se testa transporte (autorização + validação).
vi.mock("@/server/services/settings-usage-service");

import * as settingsUsageService from "@/server/services/settings-usage-service";

import { countUsageAction } from "./settings-usage";

const serviceMock = vi.mocked(settingsUsageService);

const CATEGORY_ID = "ccategory0000000000000aa";
const COUNTED_AT = new Date("2026-08-09T12:00:00.000Z");

// O projeto não liga `clearMocks` global: sem isto, o `toHaveBeenCalled` de um
// teste enxergaria as chamadas do teste anterior. `clearAllMocks` zera o
// registro de chamadas SEM apagar a implementação dos mocks de auth/prisma
// (isso seria `resetAllMocks`).
beforeEach(() => {
  vi.clearAllMocks();
});

/** Faz requireAccountAccess resolver com papel "viewer" para a próxima chamada. */
function mockViewerRole() {
  vi.mocked(requireAccountAccess).mockResolvedValueOnce({
    user: { id: TEST_CTX.userId, email: "test@example.com", name: "Test User" },
    member: buildAccountMember({ role: "viewer" }),
  });
}

describe("countUsageAction — transporte", () => {
  it("repassa entity/entityId/force e o accountId do contexto", async () => {
    serviceMock.countUsage.mockResolvedValue({
      transactions: 12,
      months: 3,
      byMonth: [{ month: "2026-07", transactions: 12 }],
      countedAt: COUNTED_AT,
      fromCache: false,
    });

    const result = await countUsageAction(TEST_CTX.accountId, {
      entity: "category",
      entityId: CATEGORY_ID,
      force: true,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.transactions).toBe(12);
    expect(serviceMock.countUsage).toHaveBeenCalledWith({
      accountId: TEST_CTX.accountId,
      entity: "category",
      entityId: CATEGORY_ID,
      force: true,
    });
  });
});

describe("countUsageAction — validação", () => {
  it("entidade fora do enum é rejeitada (VALIDATION)", async () => {
    const result = await countUsageAction(TEST_CTX.accountId, {
      entity: "transactionAlias",
      entityId: CATEGORY_ID,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION");
    expect(serviceMock.countUsage).not.toHaveBeenCalled();
  });

  it("entityId sem formato de id é rejeitado (VALIDATION)", async () => {
    const result = await countUsageAction(TEST_CTX.accountId, {
      entity: "category",
      entityId: "abc",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION");
    expect(serviceMock.countUsage).not.toHaveBeenCalled();
  });

  it("aceita id UUID legado (não usa cuid estrito)", async () => {
    serviceMock.countUsage.mockResolvedValue({
      transactions: 0,
      months: 0,
      byMonth: [],
      countedAt: COUNTED_AT,
      fromCache: true,
    });

    const result = await countUsageAction(TEST_CTX.accountId, {
      entity: "institution",
      entityId: "3f7c1a2e-9b5d-4c8a-8e21-0b6d5f4a1c33",
    });

    expect(result.ok).toBe(true);
  });
});

describe("countUsageAction — multi-tenancy e papéis", () => {
  it("objeto de outra conta: NotFoundError do service vira NOT_FOUND", async () => {
    serviceMock.countUsage.mockRejectedValue(new NotFoundError("Objeto de configuração"));

    const result = await countUsageAction(TEST_CTX.accountId, {
      entity: "category",
      entityId: CATEGORY_ID,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
  });

  it("viewer não pode disparar a contagem (FORBIDDEN)", async () => {
    mockViewerRole();

    const result = await countUsageAction(TEST_CTX.accountId, {
      entity: "category",
      entityId: CATEGORY_ID,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
    expect(serviceMock.countUsage).not.toHaveBeenCalled();
  });
});
