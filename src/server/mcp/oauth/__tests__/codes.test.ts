import { describe, expect, it } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";

import { consumeAuthCode, createAuthCode } from "@/server/mcp/oauth/codes";
import { hashToken } from "@/server/mcp/oauth/hash";

const baseInput = {
  clientId: "client1",
  userId: "user1",
  accountId: "acc1",
  redirectUri: "https://claude.ai/callback",
  codeChallenge: "challenge-abc",
};

describe("createAuthCode", () => {
  it("retorna o code RAW e persiste apenas o hash (nunca o raw)", async () => {
    prismaMock.mcpAuthCode.create.mockResolvedValue({} as never);

    const rawCode = await createAuthCode(baseInput);

    expect(typeof rawCode).toBe("string");
    expect(rawCode.length).toBeGreaterThan(20);

    const data = (prismaMock.mcpAuthCode.create.mock.calls[0][0] as any).data;
    expect(data.code).toBe(hashToken(rawCode));
    expect(data.code).not.toBe(rawCode);
  });

  it("persiste o vínculo completo (clientId, userId, accountId, redirectUri, codeChallenge) e scope default 'read'", async () => {
    prismaMock.mcpAuthCode.create.mockResolvedValue({} as never);

    await createAuthCode(baseInput);

    const data = (prismaMock.mcpAuthCode.create.mock.calls[0][0] as any).data;
    expect(data.clientId).toBe(baseInput.clientId);
    expect(data.userId).toBe(baseInput.userId);
    expect(data.accountId).toBe(baseInput.accountId);
    expect(data.redirectUri).toBe(baseInput.redirectUri);
    expect(data.codeChallenge).toBe(baseInput.codeChallenge);
    expect(data.scope).toBe("read");
  });

  it("usa o scope explícito quando informado", async () => {
    prismaMock.mcpAuthCode.create.mockResolvedValue({} as never);

    await createAuthCode({ ...baseInput, scope: "custom" });

    const data = (prismaMock.mcpAuthCode.create.mock.calls[0][0] as any).data;
    expect(data.scope).toBe("custom");
  });

  it("calcula expiresAt com TTL curto (~10min)", async () => {
    prismaMock.mcpAuthCode.create.mockResolvedValue({} as never);

    const before = Date.now();
    await createAuthCode(baseInput);
    const after = Date.now();

    const data = (prismaMock.mcpAuthCode.create.mock.calls[0][0] as any).data;
    const deltaMs = data.expiresAt.getTime() - before;

    expect(deltaMs).toBeGreaterThanOrEqual(10 * 60 * 1000 - (after - before));
    expect(deltaMs).toBeLessThanOrEqual(10 * 60 * 1000 + (after - before));
  });
});

describe("consumeAuthCode", () => {
  it("1ª chamada: updateMany marca 1 linha, registro é buscado e retornado", async () => {
    const rawCode = "raw-code-123";
    const codeHash = hashToken(rawCode);
    const record = {
      id: "ac1",
      code: codeHash,
      clientId: "client1",
      userId: "user1",
      accountId: "acc1",
      redirectUri: "https://claude.ai/callback",
      codeChallenge: "challenge-abc",
      scope: "read",
      expiresAt: new Date(Date.now() + 10_000),
      consumedAt: new Date(),
      createdAt: new Date(),
    };

    prismaMock.mcpAuthCode.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.mcpAuthCode.findUnique.mockResolvedValue(record as never);

    const result = await consumeAuthCode(rawCode);

    expect(result).toEqual(record);
    expect(prismaMock.mcpAuthCode.updateMany).toHaveBeenCalledWith({
      where: { code: codeHash, consumedAt: null },
      data: { consumedAt: expect.any(Date) },
    });
    expect(prismaMock.mcpAuthCode.findUnique).toHaveBeenCalledWith({ where: { code: codeHash } });
  });

  it("replay (já consumido): updateMany marca 0 linhas → retorna null sem buscar o registro", async () => {
    prismaMock.mcpAuthCode.updateMany.mockResolvedValue({ count: 0 });

    const result = await consumeAuthCode("raw-code-123");

    expect(result).toBeNull();
    expect(prismaMock.mcpAuthCode.findUnique).not.toHaveBeenCalled();
  });

  it("code expirado: mesmo com 1 linha marcada, retorna null", async () => {
    const rawCode = "raw-code-expired";
    const codeHash = hashToken(rawCode);

    prismaMock.mcpAuthCode.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.mcpAuthCode.findUnique.mockResolvedValue({
      id: "ac1",
      code: codeHash,
      expiresAt: new Date(Date.now() - 1000),
      consumedAt: new Date(),
    } as never);

    const result = await consumeAuthCode(rawCode);

    expect(result).toBeNull();
  });

  it("registro sumiu entre updateMany e findUnique (condição defensiva): retorna null", async () => {
    prismaMock.mcpAuthCode.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.mcpAuthCode.findUnique.mockResolvedValue(null);

    const result = await consumeAuthCode("raw-code-123");

    expect(result).toBeNull();
  });
});
