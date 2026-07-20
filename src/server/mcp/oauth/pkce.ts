import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Verifica PKCE S256 (RFC 7636) com comparação em tempo constante.
 *
 * Segurança (spec 63 Fase 3): PKCE é obrigatório no fluxo de token do
 * Authorization Server nativo. O `challenge` recebido do client é comparado
 * ao SHA-256(base64url) do `verifier` usando `timingSafeEqual` — nunca `===`
 * — para não vazar informação por timing. O guard de comprimento evita que
 * `timingSafeEqual` lance (ele exige buffers do mesmo tamanho).
 */
export function verifyPkceS256(verifier: string, challenge: string): boolean {
  const hashed = createHash("sha256").update(verifier).digest("base64url");
  const a = Buffer.from(hashed);
  const b = Buffer.from(challenge);
  return a.length === b.length && timingSafeEqual(a, b);
}
