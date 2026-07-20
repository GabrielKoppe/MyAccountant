import { randomBytes } from "node:crypto";

import type { McpClient } from "@prisma/client";

import { prisma } from "@/server/prisma";

export type RegisterClientInput = {
  clientName: string;
  redirectUris: string[];
};

/**
 * Registra um novo client MCP (Dynamic Client Registration, spec 63 Fase 3).
 *
 * Clients MCP são públicos (sem `client_secret`, ver invariantes da Fase 3):
 * `clientId` identifica o client mas não autentica sozinho — autenticação do
 * usuário e autorização do grant continuam vindo do fluxo de authorize/token.
 */
export async function registerClient(input: RegisterClientInput): Promise<McpClient> {
  const clientId = randomBytes(16).toString("base64url");

  return prisma.mcpClient.create({
    data: {
      clientId,
      clientName: input.clientName,
      redirectUris: input.redirectUris,
    },
  });
}

/** Busca um client MCP pelo `clientId` público. Retorna `null` se não existir. */
export async function getClient(clientId: string): Promise<McpClient | null> {
  return prisma.mcpClient.findUnique({ where: { clientId } });
}
