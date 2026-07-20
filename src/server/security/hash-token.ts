import { createHash } from "crypto";

/**
 * Hash SHA-256 (hex) de um token. Usado para armazenar tokens de convite (SEC-02)
 * e de recuperação de senha (SEC-09) em repouso — o token raw só trafega no email/URL.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
