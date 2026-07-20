import { describe, it, expect, vi } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";

const envMock = vi.hoisted(() => ({
  MCP_ACCESS_TOKEN_TTL_SECONDS: 3600,
  MCP_REFRESH_TOKEN_TTL_DAYS: 90,
}));
vi.mock("@/lib/env", () => ({ env: envMock }));

import { hashToken } from "@/server/mcp/oauth/hash";
import { issueTokens, findGrantByAccessToken, revokeGrant } from "@/server/mcp/oauth/store";

describe("issueTokens", () => {
  it("persiste hash, nunca o token raw", async () => {
    prismaMock.mcpToken.create.mockResolvedValue({} as never);

    const { accessToken, refreshToken } = await issueTokens("grant1");

    const calls = prismaMock.mcpToken.create.mock.calls.map((c) => (c[0] as any).data.tokenHash);
    expect(calls).toContain(hashToken(accessToken));
    expect(calls).toContain(hashToken(refreshToken));
    // Raw jamais no banco.
    expect(calls).not.toContain(accessToken);
    expect(calls).not.toContain(refreshToken);
  });

  it("cria um McpToken 'access' e um 'refresh' com grantId correto", async () => {
    prismaMock.mcpToken.create.mockResolvedValue({} as never);

    await issueTokens("grant-xyz");

    const datas = prismaMock.mcpToken.create.mock.calls.map((c) => (c[0] as any).data);
    expect(datas).toHaveLength(2);
    expect(datas.every((d) => d.grantId === "grant-xyz")).toBe(true);
    expect(datas.map((d) => d.type).sort()).toEqual(["access", "refresh"]);
  });

  it("calcula expiresAt a partir das TTLs configuradas em env", async () => {
    prismaMock.mcpToken.create.mockResolvedValue({} as never);

    const before = Date.now();
    await issueTokens("grant1");
    const after = Date.now();

    const datas = prismaMock.mcpToken.create.mock.calls.map((c) => (c[0] as any).data);
    const access = datas.find((d) => d.type === "access")!;
    const refresh = datas.find((d) => d.type === "refresh")!;

    // Access ~ TTL_SECONDS (default 3600s) à frente de "agora".
    const accessDeltaMs = access.expiresAt.getTime() - before;
    expect(accessDeltaMs).toBeGreaterThanOrEqual(3600 * 1000);
    expect(accessDeltaMs).toBeLessThanOrEqual(3600 * 1000 + (after - before));

    // Refresh ~ TTL_DAYS (default 90d) à frente de "agora".
    const refreshDeltaMs = refresh.expiresAt.getTime() - before;
    expect(refreshDeltaMs).toBeGreaterThanOrEqual(90 * 86_400 * 1000);
    expect(refreshDeltaMs).toBeLessThanOrEqual(90 * 86_400 * 1000 + (after - before));
  });

  it("retorna os tokens raw ao chamador", async () => {
    prismaMock.mcpToken.create.mockResolvedValue({} as never);

    const { accessToken, refreshToken } = await issueTokens("grant1");

    expect(typeof accessToken).toBe("string");
    expect(typeof refreshToken).toBe("string");
    expect(accessToken).not.toEqual(refreshToken);
    expect(accessToken.length).toBeGreaterThan(20);
  });
});

describe("findGrantByAccessToken", () => {
  const grant = {
    id: "grant1",
    userId: "user1",
    accountId: "acc1",
    clientId: "client1",
    scope: "read",
    createdAt: new Date(),
    lastUsedAt: null,
    revokedAt: null as Date | null,
  };

  it("retorna null se o token não existe", async () => {
    prismaMock.mcpToken.findUnique.mockResolvedValue(null);

    const result = await findGrantByAccessToken("token-inexistente");

    expect(result).toBeNull();
    expect(prismaMock.mcpToken.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: hashToken("token-inexistente") } }),
    );
  });

  it("retorna null se o token expirou", async () => {
    prismaMock.mcpToken.findUnique.mockResolvedValue({
      id: "t1",
      grantId: "grant1",
      type: "access",
      tokenHash: hashToken("raw"),
      expiresAt: new Date(Date.now() - 1000),
      createdAt: new Date(),
      grant,
    } as never);

    const result = await findGrantByAccessToken("raw");

    expect(result).toBeNull();
  });

  it("retorna null se o type não é 'access' (ex.: refresh)", async () => {
    prismaMock.mcpToken.findUnique.mockResolvedValue({
      id: "t1",
      grantId: "grant1",
      type: "refresh",
      tokenHash: hashToken("raw"),
      expiresAt: new Date(Date.now() + 10_000),
      createdAt: new Date(),
      grant,
    } as never);

    const result = await findGrantByAccessToken("raw");

    expect(result).toBeNull();
  });

  it("retorna null se o grant foi revogado", async () => {
    prismaMock.mcpToken.findUnique.mockResolvedValue({
      id: "t1",
      grantId: "grant1",
      type: "access",
      tokenHash: hashToken("raw"),
      expiresAt: new Date(Date.now() + 10_000),
      createdAt: new Date(),
      grant: { ...grant, revokedAt: new Date() },
    } as never);

    const result = await findGrantByAccessToken("raw");

    expect(result).toBeNull();
  });

  it("retorna o grant quando o token é válido, não expirado e não revogado", async () => {
    prismaMock.mcpToken.findUnique.mockResolvedValue({
      id: "t1",
      grantId: "grant1",
      type: "access",
      tokenHash: hashToken("raw"),
      expiresAt: new Date(Date.now() + 10_000),
      createdAt: new Date(),
      grant,
    } as never);

    const result = await findGrantByAccessToken("raw");

    expect(result).toEqual(grant);
  });
});

describe("revokeGrant", () => {
  it("marca revokedAt no grant e apaga seus tokens numa transação", async () => {
    prismaMock.$transaction.mockResolvedValue([] as never);

    await revokeGrant("grant1");

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    const txArg = (prismaMock.$transaction as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(Array.isArray(txArg)).toBe(true);

    expect(prismaMock.mcpGrant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "grant1" },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      }),
    );
    expect(prismaMock.mcpToken.deleteMany).toHaveBeenCalledWith({
      where: { grantId: "grant1" },
    });
  });
});
