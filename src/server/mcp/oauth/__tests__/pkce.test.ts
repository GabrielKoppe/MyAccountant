import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { verifyPkceS256 } from "@/server/mcp/oauth/pkce";

const challengeFor = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");

describe("verifyPkceS256", () => {
  it("retorna true quando o verifier corresponde ao challenge", () => {
    const verifier = "a-valid-code-verifier-1234567890";

    expect(verifyPkceS256(verifier, challengeFor(verifier))).toBe(true);
  });

  it("retorna false quando o verifier é incorreto (challenge de outro verifier)", () => {
    const verifier = "a-valid-code-verifier-1234567890";
    const challenge = challengeFor("um-verifier-completamente-diferente");

    expect(verifyPkceS256(verifier, challenge)).toBe(false);
  });

  it("retorna false quando o challenge tem tamanho diferente (guard antes do timingSafeEqual)", () => {
    const verifier = "a-valid-code-verifier-1234567890";

    // Se não houvesse o guard de comprimento, timingSafeEqual lançaria em vez
    // de retornar false — o teste garante que a função nunca propaga essa exceção.
    expect(() => verifyPkceS256(verifier, "short")).not.toThrow();
    expect(verifyPkceS256(verifier, "short")).toBe(false);
  });

  it("retorna false para challenge vazio", () => {
    expect(verifyPkceS256("qualquer-verifier", "")).toBe(false);
  });
});
