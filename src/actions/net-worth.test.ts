import { describe, expect, it, vi } from "vitest";

import "../../tests/mocks/auth";
import { TEST_CTX, buildAccountMember } from "../../tests/fixtures/account";
import { requireAccountAccess } from "@/server/auth/session";

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
vi.mock("@/server/services/balance-account-service");

import * as balanceAccountService from "@/server/services/balance-account-service";

// Reexporta o mock com tipagem para uso nos testes
const serviceMock = vi.mocked(balanceAccountService);

import {
  createBalanceAccountAction,
  updateBalanceAccountAction,
  archiveBalanceAccountAction,
  deleteBalanceAccountAction,
  upsertBalanceSnapshotAction,
  upsertBalanceSnapshotsAction,
} from "./net-worth";

const BALANCE_ACCOUNT_ID = "cba1testaaaaaaaaaaaaaaaa";

/** Faz requireAccountAccess resolver com papel "viewer" para a próxima chamada. */
function mockViewerRole() {
  vi.mocked(requireAccountAccess).mockResolvedValueOnce({
    user: { id: TEST_CTX.userId, email: "test@example.com", name: "Test User" },
    member: buildAccountMember({ role: "viewer" }),
  });
}

describe("net-worth actions — autorização (NW-01 papéis owner/editor)", () => {
  it("createBalanceAccountAction: viewer não pode criar conta patrimonial", async () => {
    mockViewerRole();

    const result = await createBalanceAccountAction(TEST_CTX.accountId, {
      kind: "asset",
      name: "Conta Nubank",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
    expect(serviceMock.createBalanceAccount).not.toHaveBeenCalled();
  });

  it("updateBalanceAccountAction: viewer não pode editar conta patrimonial", async () => {
    mockViewerRole();

    const result = await updateBalanceAccountAction(TEST_CTX.accountId, {
      balanceAccountId: BALANCE_ACCOUNT_ID,
      name: "Novo nome",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
    expect(serviceMock.updateBalanceAccount).not.toHaveBeenCalled();
  });

  it("archiveBalanceAccountAction: viewer não pode arquivar conta patrimonial", async () => {
    mockViewerRole();

    const result = await archiveBalanceAccountAction(TEST_CTX.accountId, {
      balanceAccountId: BALANCE_ACCOUNT_ID,
      archived: true,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
    expect(serviceMock.archiveBalanceAccount).not.toHaveBeenCalled();
  });

  it("deleteBalanceAccountAction: viewer não pode excluir conta patrimonial", async () => {
    mockViewerRole();

    const result = await deleteBalanceAccountAction(TEST_CTX.accountId, {
      balanceAccountId: BALANCE_ACCOUNT_ID,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
    expect(serviceMock.deleteBalanceAccount).not.toHaveBeenCalled();
  });

  it("upsertBalanceSnapshotAction: viewer não pode atualizar saldo", async () => {
    mockViewerRole();

    const result = await upsertBalanceSnapshotAction(TEST_CTX.accountId, {
      balanceAccountId: BALANCE_ACCOUNT_ID,
      balanceCents: "10000",
      capturedOn: "2026-07-01",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
    expect(serviceMock.upsertBalanceSnapshot).not.toHaveBeenCalled();
  });

  it("upsertBalanceSnapshotsAction: viewer não pode atualizar saldos em lote", async () => {
    mockViewerRole();

    const result = await upsertBalanceSnapshotsAction(TEST_CTX.accountId, {
      capturedOn: "2026-07-01",
      entries: [{ balanceAccountId: BALANCE_ACCOUNT_ID, balanceCents: "10000" }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
    expect(serviceMock.upsertBalanceSnapshots).not.toHaveBeenCalled();
  });
});

describe("net-worth actions — validação", () => {
  it("upsertBalanceSnapshotAction: capturedOn futuro é rejeitado (VALIDATION)", async () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);

    const result = await upsertBalanceSnapshotAction(TEST_CTX.accountId, {
      balanceAccountId: BALANCE_ACCOUNT_ID,
      balanceCents: "10000",
      capturedOn: futureDate.toISOString().slice(0, 10),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION");
    expect(serviceMock.upsertBalanceSnapshot).not.toHaveBeenCalled();
  });

  it("upsertBalanceSnapshotsAction: capturedOn futuro é rejeitado (VALIDATION)", async () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);

    const result = await upsertBalanceSnapshotsAction(TEST_CTX.accountId, {
      capturedOn: futureDate.toISOString().slice(0, 10),
      entries: [{ balanceAccountId: BALANCE_ACCOUNT_ID, balanceCents: "10000" }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION");
    expect(serviceMock.upsertBalanceSnapshots).not.toHaveBeenCalled();
  });
});

describe("net-worth actions — caminho feliz (owner)", () => {
  it("createBalanceAccountAction: owner cria conta e revalida", async () => {
    serviceMock.createBalanceAccount.mockResolvedValue({ balanceAccountId: BALANCE_ACCOUNT_ID });

    const result = await createBalanceAccountAction(TEST_CTX.accountId, {
      kind: "asset",
      name: "Conta Nubank",
    });

    expect(result.ok).toBe(true);
    expect(serviceMock.createBalanceAccount).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "asset", name: "Conta Nubank" }),
      expect.objectContaining({ accountId: TEST_CTX.accountId }),
    );
  });
});
