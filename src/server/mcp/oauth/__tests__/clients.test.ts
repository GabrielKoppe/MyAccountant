import { describe, expect, it } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";

import { getClient, registerClient } from "@/server/mcp/oauth/clients";

describe("registerClient", () => {
  it("persiste clientName + redirectUris e gera um clientId aleatório (string não trivial)", async () => {
    prismaMock.mcpClient.create.mockResolvedValue({
      id: "c1",
      clientId: "whatever-generated",
      clientName: "Claude Desktop",
      redirectUris: ["https://claude.ai/callback"],
      createdAt: new Date(),
    } as never);

    await registerClient({
      clientName: "Claude Desktop",
      redirectUris: ["https://claude.ai/callback"],
    });

    const data = (prismaMock.mcpClient.create.mock.calls[0][0] as any).data;
    expect(data.clientName).toBe("Claude Desktop");
    expect(data.redirectUris).toEqual(["https://claude.ai/callback"]);
    expect(typeof data.clientId).toBe("string");
    expect(data.clientId.length).toBeGreaterThan(10);
  });

  it("gera clientIds diferentes em chamadas distintas", async () => {
    prismaMock.mcpClient.create.mockResolvedValue({} as never);

    await registerClient({ clientName: "A", redirectUris: ["https://a.test"] });
    await registerClient({ clientName: "B", redirectUris: ["https://b.test"] });

    const [firstCall, secondCall] = prismaMock.mcpClient.create.mock.calls;
    const clientIdA = (firstCall[0] as any).data.clientId;
    const clientIdB = (secondCall[0] as any).data.clientId;

    expect(clientIdA).not.toEqual(clientIdB);
  });

  it("retorna o client criado pelo Prisma", async () => {
    const created = {
      id: "c1",
      clientId: "abc123",
      clientName: "X",
      redirectUris: ["https://x.test"],
      createdAt: new Date(),
    };
    prismaMock.mcpClient.create.mockResolvedValue(created as never);

    const result = await registerClient({ clientName: "X", redirectUris: ["https://x.test"] });

    expect(result).toEqual(created);
  });
});

describe("getClient", () => {
  it("consulta por clientId e retorna o registro quando encontrado (round-trip)", async () => {
    const stored = {
      id: "c1",
      clientId: "abc123",
      clientName: "X",
      redirectUris: ["https://x.test"],
      createdAt: new Date(),
    };
    prismaMock.mcpClient.findUnique.mockResolvedValue(stored as never);

    const result = await getClient("abc123");

    expect(result).toEqual(stored);
    expect(prismaMock.mcpClient.findUnique).toHaveBeenCalledWith({
      where: { clientId: "abc123" },
    });
  });

  it("retorna null quando o client não existe", async () => {
    prismaMock.mcpClient.findUnique.mockResolvedValue(null);

    const result = await getClient("inexistente");

    expect(result).toBeNull();
  });
});
