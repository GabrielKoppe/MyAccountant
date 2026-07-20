import { describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";

// env é construído com @t3-oss/env-nextjs; sob o ambiente jsdom do Vitest,
// acessar uma var server-only lança. Mock igual ao usado em
// src/server/services/auth-service.test.ts e no store.test.ts existente.
const envMock = vi.hoisted(() => ({
  MCP_ACCESS_TOKEN_TTL_SECONDS: 3600,
  MCP_REFRESH_TOKEN_TTL_DAYS: 90,
}));
vi.mock("@/lib/env", () => ({ env: envMock }));

import { hashToken } from "@/server/mcp/oauth/hash";
import {
  findGrantByRefreshToken,
  rotateRefreshToken,
  upsertGrant,
} from "@/server/mcp/oauth/store";

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

describe("upsertGrant", () => {
  it("cria/retorna o grant via upsert na chave única (userId, accountId, clientId)", async () => {
    prismaMock.mcpGrant.upsert.mockResolvedValue(grant as never);

    const result = await upsertGrant("user1", "acc1", "client1");

    expect(result).toEqual(grant);
    expect(prismaMock.mcpGrant.upsert).toHaveBeenCalledWith({
      where: {
        userId_accountId_clientId: { userId: "user1", accountId: "acc1", clientId: "client1" },
      },
      update: {},
      create: { userId: "user1", accountId: "acc1", clientId: "client1" },
    });
  });

  it("é idempotente: chamadas repetidas usam sempre a mesma chave única", async () => {
    prismaMock.mcpGrant.upsert.mockResolvedValue(grant as never);

    await upsertGrant("user1", "acc1", "client1");
    await upsertGrant("user1", "acc1", "client1");

    expect(prismaMock.mcpGrant.upsert).toHaveBeenCalledTimes(2);
    const [firstCall, secondCall] = prismaMock.mcpGrant.upsert.mock.calls;
    expect(firstCall[0]).toEqual(secondCall[0]);
  });
});

describe("findGrantByRefreshToken", () => {
  it("retorna null se o token não existe", async () => {
    prismaMock.mcpToken.findUnique.mockResolvedValue(null);

    const result = await findGrantByRefreshToken("token-inexistente");

    expect(result).toBeNull();
  });

  it("retorna null se o type não é 'refresh' (ex.: access)", async () => {
    prismaMock.mcpToken.findUnique.mockResolvedValue({
      id: "t1",
      grantId: "grant1",
      type: "access",
      tokenHash: hashToken("raw"),
      expiresAt: new Date(Date.now() + 10_000),
      createdAt: new Date(),
      grant,
    } as never);

    const result = await findGrantByRefreshToken("raw");

    expect(result).toBeNull();
  });

  it("retorna null se o token expirou", async () => {
    prismaMock.mcpToken.findUnique.mockResolvedValue({
      id: "t1",
      grantId: "grant1",
      type: "refresh",
      tokenHash: hashToken("raw"),
      expiresAt: new Date(Date.now() - 1000),
      createdAt: new Date(),
      grant,
    } as never);

    const result = await findGrantByRefreshToken("raw");

    expect(result).toBeNull();
  });

  it("retorna null se o grant foi revogado", async () => {
    prismaMock.mcpToken.findUnique.mockResolvedValue({
      id: "t1",
      grantId: "grant1",
      type: "refresh",
      tokenHash: hashToken("raw"),
      expiresAt: new Date(Date.now() + 10_000),
      createdAt: new Date(),
      grant: { ...grant, revokedAt: new Date() },
    } as never);

    const result = await findGrantByRefreshToken("raw");

    expect(result).toBeNull();
  });

  it("retorna o grant quando o refresh é válido, não expirado e não revogado", async () => {
    prismaMock.mcpToken.findUnique.mockResolvedValue({
      id: "t1",
      grantId: "grant1",
      type: "refresh",
      tokenHash: hashToken("raw"),
      expiresAt: new Date(Date.now() + 10_000),
      createdAt: new Date(),
      grant,
    } as never);

    const result = await findGrantByRefreshToken("raw");

    expect(result).toEqual(grant);
  });
});

describe("rotateRefreshToken", () => {
  it("refresh válido: consome atomicamente o refresh antigo, apaga o access sibling e emite um novo par", async () => {
    prismaMock.mcpToken.findUnique.mockResolvedValue({
      id: "t-old-refresh",
      grantId: "grant1",
      type: "refresh",
      tokenHash: hashToken("old-refresh"),
      expiresAt: new Date(Date.now() + 10_000),
      createdAt: new Date(),
      grant,
    } as never);
    // As mutações rodam dentro de prisma.$transaction — executa o callback
    // com o próprio prismaMock como `tx` (mesmo padrão de transaction-service.test.ts).
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock));
    prismaMock.mcpToken.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.mcpToken.create.mockResolvedValue({} as never);

    const result = await rotateRefreshToken("old-refresh");

    expect(result).not.toBeNull();
    expect(typeof result!.accessToken).toBe("string");
    expect(typeof result!.refreshToken).toBe("string");
    expect(result!.refreshToken).not.toBe("old-refresh");

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    // Gate de uso único: delete pelo tokenHash específico do refresh, não pelo grantId inteiro.
    expect(prismaMock.mcpToken.deleteMany).toHaveBeenCalledWith({
      where: { tokenHash: hashToken("old-refresh"), type: "refresh" },
    });
    // Limpeza do access sibling do par antigo.
    expect(prismaMock.mcpToken.deleteMany).toHaveBeenCalledWith({
      where: { grantId: "grant1", type: "access" },
    });
    // issueTokens cria exatamente um McpToken "access" e um "refresh".
    expect(prismaMock.mcpToken.create).toHaveBeenCalledTimes(2);
    const types = prismaMock.mcpToken.create.mock.calls
      .map((c) => (c[0] as any).data.type)
      .sort();
    expect(types).toEqual(["access", "refresh"]);
  });

  it("uso único (TOCTOU): uma segunda rotação com o MESMO refresh raw perde a corrida e retorna null", async () => {
    prismaMock.mcpToken.findUnique.mockResolvedValue({
      id: "t-old-refresh",
      grantId: "grant1",
      type: "refresh",
      tokenHash: hashToken("old-refresh"),
      expiresAt: new Date(Date.now() + 10_000),
      createdAt: new Date(),
      grant,
    } as never);
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock));
    // Simula a segunda chamada concorrente: a primeira já ganhou a corrida e
    // apagou a linha do refresh — o deleteMany do gate de single-use desta
    // chamada não encontra mais nada para apagar (count 0).
    prismaMock.mcpToken.deleteMany.mockResolvedValueOnce({ count: 0 });

    const result = await rotateRefreshToken("old-refresh");

    expect(result).toBeNull();
    expect(prismaMock.mcpToken.deleteMany).toHaveBeenCalledWith({
      where: { tokenHash: hashToken("old-refresh"), type: "refresh" },
    });
    // Perdeu a corrida: nunca apaga o access sibling nem emite um novo par.
    expect(prismaMock.mcpToken.deleteMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.mcpToken.create).not.toHaveBeenCalled();
  });

  it("refresh de grant revogado retorna null e não deleta nem emite nada", async () => {
    prismaMock.mcpToken.findUnique.mockResolvedValue({
      id: "t1",
      grantId: "grant1",
      type: "refresh",
      tokenHash: hashToken("raw"),
      expiresAt: new Date(Date.now() + 10_000),
      createdAt: new Date(),
      grant: { ...grant, revokedAt: new Date() },
    } as never);

    const result = await rotateRefreshToken("raw");

    expect(result).toBeNull();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.mcpToken.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.mcpToken.create).not.toHaveBeenCalled();
  });

  it("refresh inexistente retorna null", async () => {
    prismaMock.mcpToken.findUnique.mockResolvedValue(null);

    const result = await rotateRefreshToken("token-inexistente");

    expect(result).toBeNull();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.mcpToken.deleteMany).not.toHaveBeenCalled();
  });
});
