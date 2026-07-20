import { beforeEach, describe, expect, it, vi } from "vitest";

import "@/../tests/mocks/auth";
import { prismaMock } from "@/../tests/mocks/prisma";

const mockRevokeGrant = vi.hoisted(() => vi.fn());
vi.mock("@/server/mcp/oauth/store", () => ({ revokeGrant: mockRevokeGrant }));

// next/cache não roda fora de um request scope real do Next.js — precisa de mock.
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { revokeConnectorAction } from "@/actions/mcp-connectors";

// requireAccountAccess é mockado (tests/mocks/auth.ts) para SEMPRE suceder,
// não importa o accountId — o que estamos testando aqui é a segunda camada
// de autorização: a ownership check dentro do próprio handler, que compara
// grant.accountId E grant.userId ao ctx (accountId do chamador e userId do
// usuário autenticado no mock).
// IDs no formato cuid (schema `revokeConnectorSchema` valida `grantId` com `.cuid()`).
// tests/mocks/auth.ts fixa o usuário autenticado com id "user-test-1".
const GRANT_A = { id: "cgrantidaaaaaaaaaaaaaaaa", accountId: "acc-A", userId: "user-test-1" };
const GRANT_B = { id: "cgrantidbbbbbbbbbbbbbbbb", accountId: "acc-B", userId: "user-test-1" };
const GRANT_OTHER_USER = {
  id: "cgrantidccccccccccccccccc",
  accountId: "acc-A",
  userId: "user-test-2",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("revokeConnectorAction", () => {
  it("multi-tenancy: NÃO revoga um grant que pertence a outra Account", async () => {
    prismaMock.mcpGrant.findUnique.mockResolvedValue(GRANT_B as never);

    const result = await revokeConnectorAction("acc-A", { grantId: GRANT_B.id });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
    // O grant da Account B deve permanecer intacto — revokeGrant nunca é chamado.
    expect(mockRevokeGrant).not.toHaveBeenCalled();
  });

  it("user-scoping: NÃO revoga um grant de OUTRO usuário na mesma Account", async () => {
    prismaMock.mcpGrant.findUnique.mockResolvedValue(GRANT_OTHER_USER as never);

    const result = await revokeConnectorAction("acc-A", { grantId: GRANT_OTHER_USER.id });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
    // O grant pertence a outro usuário (mesma Account) — nunca revogado.
    expect(mockRevokeGrant).not.toHaveBeenCalled();
  });

  it("falha (sem revogar) quando o grant não existe", async () => {
    prismaMock.mcpGrant.findUnique.mockResolvedValue(null);

    const result = await revokeConnectorAction("acc-A", { grantId: "cgrantidnaoexistexxxxxxx" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
    expect(mockRevokeGrant).not.toHaveBeenCalled();
  });

  it("caminho feliz: revoga um grant que pertence à própria Account", async () => {
    prismaMock.mcpGrant.findUnique.mockResolvedValue(GRANT_A as never);

    const result = await revokeConnectorAction("acc-A", { grantId: GRANT_A.id });

    expect(result.ok).toBe(true);
    expect(mockRevokeGrant).toHaveBeenCalledWith(GRANT_A.id);
    expect(mockRevokeGrant).toHaveBeenCalledTimes(1);
  });
});
