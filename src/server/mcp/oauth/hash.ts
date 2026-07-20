import { createHash } from "node:crypto";

/**
 * Hash determinístico (SHA-256, hex) de um token OAuth raw.
 *
 * Usado para nunca persistir o token bruto no banco (spec 23 SEC-02):
 * o chamador recebe o token raw uma única vez; o banco só guarda o hash.
 */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
