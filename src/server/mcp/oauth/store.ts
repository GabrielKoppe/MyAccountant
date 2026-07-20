import { randomBytes } from "node:crypto";

import type { McpGrant, Prisma } from "@prisma/client";

import { env } from "@/lib/env";
import { hashToken } from "@/server/mcp/oauth/hash";
import { prisma } from "@/server/prisma";

const rawToken = () => randomBytes(32).toString("base64url");

/** Client usado pelas mutações do store: o `prisma` global ou um `tx` de `$transaction`. */
type Db = typeof prisma | Prisma.TransactionClient;

/**
 * Emite um par (access, refresh) de tokens para um grant existente.
 *
 * Segurança (spec 23 SEC-02): os tokens RAW são retornados ao chamador uma
 * única vez. O banco só recebe `hashToken(raw)` — nunca o valor bruto.
 *
 * Aceita opcionalmente um `db` (ex.: um `tx` de `prisma.$transaction`) para
 * que a emissão participe da mesma transação de quem chama — usado por
 * `rotateRefreshToken` para que consumo do refresh antigo + emissão do par
 * novo sejam atômicos.
 */
export async function issueTokens(
  grantId: string,
  db: Db = prisma,
): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = rawToken();
  const refreshToken = rawToken();
  const now = Date.now();

  await db.mcpToken.create({
    data: {
      grantId,
      type: "access",
      tokenHash: hashToken(accessToken),
      expiresAt: new Date(now + env.MCP_ACCESS_TOKEN_TTL_SECONDS * 1000),
    },
  });

  await db.mcpToken.create({
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
 * Resolve um grant a partir do hash de um token e do `type` esperado.
 *
 * Retorna `null` se o token não existir, não for do `type` esperado, estiver
 * expirado, ou se o grant associado já tiver sido revogado. Compartilhado por
 * `findGrantByAccessToken` e `findGrantByRefreshToken`.
 */
async function findGrantByTokenHash(
  raw: string,
  type: "access" | "refresh",
): Promise<McpGrant | null> {
  const token = await prisma.mcpToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { grant: true },
  });

  if (!token) return null;
  if (token.type !== type) return null;
  if (token.expiresAt < new Date()) return null;
  if (token.grant.revokedAt) return null;

  return token.grant;
}

/**
 * Resolve um grant a partir de um access token raw.
 *
 * Retorna `null` se o token não existir, não for do tipo `access`, estiver
 * expirado, ou se o grant associado já tiver sido revogado.
 */
export async function findGrantByAccessToken(raw: string): Promise<McpGrant | null> {
  return findGrantByTokenHash(raw, "access");
}

/**
 * Resolve um grant a partir de um refresh token raw.
 *
 * Retorna `null` se o token não existir, não for do tipo `refresh`, estiver
 * expirado, ou se o grant associado já tiver sido revogado.
 */
export async function findGrantByRefreshToken(raw: string): Promise<McpGrant | null> {
  return findGrantByTokenHash(raw, "refresh");
}

/**
 * Cria (ou retorna, se já existir) o grant de `(userId, accountId, clientId)`.
 *
 * Idempotente via a constraint `@@unique([userId, accountId, clientId])` —
 * chamadas repetidas para a mesma tupla nunca duplicam o grant.
 */
export async function upsertGrant(
  userId: string,
  accountId: string,
  clientId: string,
): Promise<McpGrant> {
  return prisma.mcpGrant.upsert({
    where: { userId_accountId_clientId: { userId, accountId, clientId } },
    update: {},
    create: { userId, accountId, clientId },
  });
}

/**
 * Rotaciona um refresh token: valida o refresh raw, **consome atomicamente**
 * a linha do refresh antigo, apaga o access sibling do mesmo grant, e emite
 * um novo par via `issueTokens`.
 *
 * Retorna `null` se o refresh for inválido, expirado, ou pertencer a um
 * grant revogado (delegado a `findGrantByRefreshToken`) — nesse caso nada é
 * apagado nem emitido.
 *
 * Segurança (spec 23 SEC-02 / TOCTOU): o gate de uso único NÃO é a leitura
 * acima — é o `count` retornado pelo `deleteMany` filtrado por `tokenHash`
 * dentro da transação (mesmo princípio de `consumeAuthCode`). Sob duas
 * chamadas concorrentes com o MESMO refresh raw, o Postgres serializa os dois
 * deletes via lock de linha: a primeira transação a commitar apaga a linha;
 * a segunda, ao reavaliar o `WHERE`, não encontra mais a linha e recebe
 * `count === 0` — logo `null`, sem emitir um segundo par. Isso fecha a janela
 * TOCTOU em que ambas as chamadas passariam pela leitura antes de qualquer
 * delete.
 */
export async function rotateRefreshToken(
  oldRefreshRaw: string,
): Promise<{ accessToken: string; refreshToken: string } | null> {
  const grant = await findGrantByRefreshToken(oldRefreshRaw);
  if (!grant) return null;

  const tokenHash = hashToken(oldRefreshRaw);

  return prisma.$transaction(async (tx) => {
    // Gate de uso único: apenas a chamada cujo delete efetivamente remove a
    // linha (count === 1) segue adiante. Uma segunda chamada concorrente para
    // o mesmo raw perde a linha (count === 0) e retorna null.
    const { count } = await tx.mcpToken.deleteMany({
      where: { tokenHash, type: "refresh" },
    });
    if (count !== 1) return null;

    // Limpeza do access token irmão do par antigo (não é o gate de single-use).
    await tx.mcpToken.deleteMany({ where: { grantId: grant.id, type: "access" } });

    return issueTokens(grant.id, tx);
  });
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
