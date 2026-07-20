import { randomBytes } from "node:crypto";

import type { McpAuthCode } from "@prisma/client";

import { hashToken } from "@/server/mcp/oauth/hash";
import { prisma } from "@/server/prisma";

/** TTL curto do authorization code (spec 63 Fase 3, invariante de segurança: ~10min). */
const AUTH_CODE_TTL_MS = 10 * 60 * 1000;

export type CreateAuthCodeInput = {
  clientId: string;
  userId: string;
  accountId: string;
  redirectUri: string;
  codeChallenge: string;
  scope?: string;
};

/**
 * Cria um authorization code (OAuth 2.1 + PKCE, spec 63 Fase 3).
 *
 * Segurança (SEC-02): o code RAW é retornado ao chamador uma única vez; o
 * banco só recebe `hashToken(raw)` — nunca o valor bruto. O code fica ligado
 * a `(clientId, userId, accountId, redirectUri, codeChallenge, scope)` para
 * que `/api/oauth/token` possa validar o vínculo completo na troca.
 */
export async function createAuthCode(input: CreateAuthCodeInput): Promise<string> {
  const rawCode = randomBytes(32).toString("base64url");

  await prisma.mcpAuthCode.create({
    data: {
      code: hashToken(rawCode),
      clientId: input.clientId,
      userId: input.userId,
      accountId: input.accountId,
      redirectUri: input.redirectUri,
      codeChallenge: input.codeChallenge,
      scope: input.scope ?? "read",
      expiresAt: new Date(Date.now() + AUTH_CODE_TTL_MS),
    },
  });

  return rawCode;
}

/**
 * Consome um authorization code de forma atômica e de uso único.
 *
 * O `updateMany` com `consumedAt: null` na cláusula `where` garante que, sob
 * concorrência, no máximo uma chamada consegue marcar `consumedAt` — um
 * replay (code já consumido) faz `count !== 1` e retorna `null` sem nunca
 * buscar o registro. Um code expirado ainda é marcado como consumido (evita
 * reuso), mas o retorno também é `null` pois `expiresAt` já passou.
 */
export async function consumeAuthCode(rawCode: string): Promise<McpAuthCode | null> {
  const codeHash = hashToken(rawCode);

  const { count } = await prisma.mcpAuthCode.updateMany({
    where: { code: codeHash, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  if (count !== 1) return null;

  const record = await prisma.mcpAuthCode.findUnique({ where: { code: codeHash } });
  if (!record) return null;
  if (record.expiresAt < new Date()) return null;

  return record;
}
