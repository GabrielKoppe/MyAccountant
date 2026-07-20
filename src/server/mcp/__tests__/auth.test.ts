import { beforeEach, describe, expect, it, vi } from "vitest";

// Factory inline (não `mockDeep()` top-level) — evita o bug de hoisting do Vitest com vi.mock.
vi.mock("@/server/mcp/oauth/store", () => ({ findGrantByAccessToken: vi.fn() }));

import { verifyMcpBearer } from "@/server/mcp/auth";
import { findGrantByAccessToken } from "@/server/mcp/oauth/store";

const mockFindGrant = findGrantByAccessToken as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("verifyMcpBearer", () => {
  it("devolve undefined sem Authorization e sem bearerToken", async () => {
    const req = new Request("http://x/api/mcp");

    const result = await verifyMcpBearer(req);

    expect(result).toBeUndefined();
    expect(mockFindGrant).not.toHaveBeenCalled();
  });

  it("devolve undefined quando findGrantByAccessToken não encontra o grant", async () => {
    mockFindGrant.mockResolvedValue(null);
    const req = new Request("http://x/api/mcp", {
      headers: { authorization: "Bearer bad-token" },
    });

    const result = await verifyMcpBearer(req);

    expect(result).toBeUndefined();
    expect(mockFindGrant).toHaveBeenCalledWith("bad-token");
  });

  it("devolve AuthInfo com userId/accountId/grantId em extra e scopes ['read'] para token válido", async () => {
    mockFindGrant.mockResolvedValue({
      id: "grant1",
      userId: "user1",
      accountId: "acc1",
      clientId: "client1",
      scope: "read",
      createdAt: new Date(),
      lastUsedAt: null,
      revokedAt: null,
    });
    const req = new Request("http://x/api/mcp", {
      headers: { authorization: "Bearer good-token" },
    });

    const result = await verifyMcpBearer(req);

    expect(result).toEqual({
      token: "good-token",
      clientId: "client1",
      scopes: ["read"],
      extra: { userId: "user1", accountId: "acc1", grantId: "grant1" },
    });
  });

  it("prefere o bearerToken passado como segundo argumento (contrato withMcpAuth) sobre o header", async () => {
    mockFindGrant.mockResolvedValue({
      id: "grant2",
      userId: "user2",
      accountId: "acc2",
      clientId: "client2",
      scope: "read",
      createdAt: new Date(),
      lastUsedAt: null,
      revokedAt: null,
    });
    // Sem header Authorization — só o segundo argumento.
    const req = new Request("http://x/api/mcp");

    const result = await verifyMcpBearer(req, "token-from-arg");

    expect(mockFindGrant).toHaveBeenCalledWith("token-from-arg");
    expect(result?.extra).toEqual({ userId: "user2", accountId: "acc2", grantId: "grant2" });
  });
});
