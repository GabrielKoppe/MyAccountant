import { describe, expect, it } from "vitest";

import { type AliasCandidate, matchAlias } from "./match";

function alias(
  overrides: Partial<AliasCandidate> & Pick<AliasCandidate, "id" | "trigger">,
): AliasCandidate {
  return {
    triggerNormalized: overrides.trigger.toLowerCase(),
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("matchAlias", () => {
  it("casa substring case-insensitive em qualquer posição", () => {
    const ceg = alias({ id: "1", trigger: "CEG" });
    expect(matchAlias("pagamento ceg gas", [ceg])?.id).toBe("1");
    expect(matchAlias("CEG SA", [ceg])?.id).toBe("1");
    expect(matchAlias("Ceg", [ceg])?.id).toBe("1");
  });

  it("retorna null quando nenhum gatilho casa", () => {
    const ceg = alias({ id: "1", trigger: "CEG" });
    expect(matchAlias("mercado livre", [ceg])).toBeNull();
  });

  it("retorna null para descrição null/vazia", () => {
    const ceg = alias({ id: "1", trigger: "CEG" });
    expect(matchAlias(null, [ceg])).toBeNull();
    expect(matchAlias(undefined, [ceg])).toBeNull();
    expect(matchAlias("", [ceg])).toBeNull();
  });

  it("desempata por gatilho mais longo", () => {
    const ceg = alias({ id: "curto", trigger: "CEG" });
    const cegSa = alias({ id: "longo", trigger: "CEG SA" });
    expect(matchAlias("pagamento CEG SA 07/2026", [ceg, cegSa])?.id).toBe("longo");
    expect(matchAlias("pagamento CEG SA 07/2026", [cegSa, ceg])?.id).toBe("longo");
  });

  it("empate de comprimento: vence updatedAt mais recente", () => {
    const antigo = alias({ id: "antigo", trigger: "CEG", updatedAt: "2026-01-01T00:00:00.000Z" });
    const recente = alias({ id: "recente", trigger: "GAS", updatedAt: "2026-06-01T00:00:00.000Z" });
    expect(matchAlias("conta CEG GAS", [antigo, recente])?.id).toBe("recente");
    expect(matchAlias("conta CEG GAS", [recente, antigo])?.id).toBe("recente");
  });

  it("ignora candidatos com triggerNormalized vazio", () => {
    const vazio = alias({ id: "vazio", trigger: "", triggerNormalized: "" });
    expect(matchAlias("qualquer coisa", [vazio])).toBeNull();
  });
});
