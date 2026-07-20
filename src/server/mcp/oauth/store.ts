import { randomBytes } from "node:crypto";

import type { McpGrant } from "@prisma/client";

import { env } from "@/lib/env";
import { hashToken } from "@/server/mcp/oauth/hash";
import { prisma } from "@/server/prisma";

const rawToken = () => randomBytes(32).toString("base64url");

/**
 * Emite um par (access, refresh) de tokens para um grant existente.
 *
 * Segurança (spec 23 SEC-02): os tokens RAW são retornados ao chamador uma
 * única vez. O banco só recebe `hashToken(raw)` — nunca o valor bruto.
 */
export async function issueTokens(
  grantId: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = rawToken();
  const refreshToken = rawToken();
  const now = Date.now();

  await prisma.mcpToken.create({
    data: {
      grantId,
      type: "access",
      tokenHash: hashToken(accessToken),
      expiresAt: new Date(now + env.MCP_ACCESS_TOKEN_TTL_SECONDS * 1000),
    },
  });

  await prisma.mcpToken.create({
    data: {
      grantId,
      type: "refresh",
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(now + env.MCP_REFRESH_TOKEN_TTL_DAYS * 86_400_000),
    },
  });

  return { accessToken, refreshToken };
}

/**
 * Resolve um grant a partir de um access token raw.
 *
 * Retorna `null` se o token não existir, não for do tipo `access`, estiver
 * expirado, ou se o grant associado já tiver sido revogado.
 */
export async function findGrantByAccessToken(raw: string): Promise<McpGrant | null> {
  const token = await prisma.mcpToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { grant: true },
  });

  if (!token) return null;
  if (token.type !== "access") return null;
  if (token.expiresAt < new Date()) return null;
  if (token.grant.revokedAt) return null;

  return token.grant;
}

/**
 * Revoga um grant: marca `revokedAt` e apaga todos os seus tokens (access e
 * refresh) numa única transação.
 */
export async function revokeGrant(grantId: string): Promise<void> {
  await prisma.$transaction([
    prisma.mcpGrant.update({ where: { id: grantId }, data: { revokedAt: new Date() } }),
    prisma.mcpToken.deleteMany({ where: { grantId } }),
  ]);
}
