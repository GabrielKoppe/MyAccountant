import { beforeEach, describe, expect, it, vi } from "vitest";

import "../../../tests/mocks/auth";

const mockGetClient = vi.hoisted(() => vi.fn());
const mockEnsureMembership = vi.hoisted(() => vi.fn());
const mockUpsertGrant = vi.hoisted(() => vi.fn());
const mockCreateAuthCode = vi.hoisted(() => vi.fn());

vi.mock("@/server/mcp/oauth/clients", () => ({ getClient: mockGetClient }));
vi.mock("@/server/auth/membership", () => ({ ensureMembership: mockEnsureMembership }));
vi.mock("@/server/mcp/oauth/store", () => ({ upsertGrant: mockUpsertGrant }));
vi.mock("@/server/mcp/oauth/codes", () => ({ createAuthCode: mockCreateAuthCode }));

import { approveConsentAction } from "@/actions/mcp-consent";
import { ForbiddenError } from "@/server/api/errors";

const VALID_CLIENT = {
  id: "client-db-1",
  clientId: "client-1",
  clientName: "Claude Desktop",
  redirectUris: ["https://claude.ai/callback"],
  createdAt: new Date("2026-01-01"),
};

// userId "user-test-1" vem do mock compartilhado em tests/mocks/auth.ts.
const BASE_INPUT = {
  clientId: "client-1",
  redirectUri: "https://claude.ai/callback",
  codeChallenge: "challenge-abc",
  scope: "read",
  state: "state-xyz",
  accountId: "acc-1",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetClient.mockResolvedValue(VALID_CLIENT);
  mockEnsureMembership.mockResolvedValue({
    accountId: "acc-1",
    userId: "user-test-1",
    role: "owner",
  });
  mockUpsertGrant.mockResolvedValue({ id: "grant-1" });
  mockCreateAuthCode.mockResolvedValue("raw-code-123");
});

describe("approveConsentAction", () => {
  it("multi-tenancy: rejeita consentir para uma Account da qual o usuário NÃO é membro", async () => {
    mockEnsureMembership.mockRejectedValue(new ForbiddenError("Usuário não é membro desta conta."));

    const result = await approveConsentAction(BASE_INPUT);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FORBIDDEN");
    }
    // Nenhum grant nem code pode ser criado quando a checagem de membership falha.
    expect(mockUpsertGrant).not.toHaveBeenCalled();
    expect(mockCreateAuthCode).not.toHaveBeenCalled();
  });

  it("rejeita redirect_uri fora da lista registrada do client (sem emitir code)", async () => {
    const result = await approveConsentAction({
      ...BASE_INPUT,
      redirectUri: "https://evil.example.com/callback",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION");
    }
    expect(mockEnsureMembership).not.toHaveBeenCalled();
    expect(mockUpsertGrant).not.toHaveBeenCalled();
    expect(mockCreateAuthCode).not.toHaveBeenCalled();
  });

  it("rejeita quando o client não existe (getClient retorna null)", async () => {
    mockGetClient.mockResolvedValue(null);

    const result = await approveConsentAction(BASE_INPUT);

    expect(result.ok).toBe(false);
    expect(mockEnsureMembership).not.toHaveBeenCalled();
    expect(mockCreateAuthCode).not.toHaveBeenCalled();
  });

  it("caminho feliz: cria grant + code ligado a (client,user,account,codeChallenge) e retorna redirectTo", async () => {
    const result = await approveConsentAction(BASE_INPUT);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.redirectTo).toContain("https://claude.ai/callback");
      expect(result.data.redirectTo).toContain("code=raw-code-123");
      expect(result.data.redirectTo).toContain("state=state-xyz");
    }

    expect(mockEnsureMembership).toHaveBeenCalledWith("user-test-1", "acc-1");
    expect(mockUpsertGrant).toHaveBeenCalledWith("user-test-1", "acc-1", "client-1");
    expect(mockCreateAuthCode).toHaveBeenCalledWith({
      clientId: "client-1",
      userId: "user-test-1",
      accountId: "acc-1",
      redirectUri: "https://claude.ai/callback",
      codeChallenge: "challenge-abc",
      scope: "read",
    });
  });

  it("caminho feliz sem state: redirectTo não inclui state", async () => {
    const result = await approveConsentAction({ ...BASE_INPUT, state: undefined });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.redirectTo).not.toContain("state=");
    }
  });
});
