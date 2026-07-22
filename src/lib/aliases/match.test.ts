import { describe, expect, it } from "vitest";

import { type AliasCandidate, type MatchInput, matchAlias } from "./match";

function alias(
  overrides: Partial<AliasCandidate> & Pick<AliasCandidate, "id" | "trigger">,
): AliasCandidate {
  return {
    triggerNormalized: overrides.trigger.toLowerCase(),
    triggerMode: "contains",
    priority: "medium",
    conditionInstitutionId: null,
    minCents: null,
    maxCents: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// Só a descrição varia na maioria dos casos; valor/instituição neutros por padrão.
function input(
  description: string | null | undefined,
  extra: Partial<MatchInput> = {},
): MatchInput {
  return { description, amountCents: null, institutionId: null, ...extra };
}

describe("matchAlias", () => {
  it("casa substring case-insensitive em qualquer posição", () => {
    const ceg = alias({ id: "1", trigger: "CEG" });
    expect(matchAlias(input("pagamento ceg gas"), [ceg])?.id).toBe("1");
    expect(matchAlias(input("CEG SA"), [ceg])?.id).toBe("1");
    expect(matchAlias(input("Ceg"), [ceg])?.id).toBe("1");
  });

  it("retorna null quando nenhum gatilho casa", () => {
    const ceg = alias({ id: "1", trigger: "CEG" });
    expect(matchAlias(input("mercado livre"), [ceg])).toBeNull();
  });

  it("retorna null para descrição null/vazia", () => {
    const ceg = alias({ id: "1", trigger: "CEG" });
    expect(matchAlias(input(null), [ceg])).toBeNull();
    expect(matchAlias(input(undefined), [ceg])).toBeNull();
    expect(matchAlias(input(""), [ceg])).toBeNull();
  });

  it("desempata por gatilho mais longo", () => {
    const ceg = alias({ id: "curto", trigger: "CEG" });
    const cegSa = alias({ id: "longo", trigger: "CEG SA" });
    expect(matchAlias(input("pagamento CEG SA 07/2026"), [ceg, cegSa])?.id).toBe("longo");
    expect(matchAlias(input("pagamento CEG SA 07/2026"), [cegSa, ceg])?.id).toBe("longo");
  });

  it("empate de comprimento: vence updatedAt mais recente", () => {
    const antigo = alias({ id: "antigo", trigger: "CEG", updatedAt: "2026-01-01T00:00:00.000Z" });
    const recente = alias({ id: "recente", trigger: "GAS", updatedAt: "2026-06-01T00:00:00.000Z" });
    expect(matchAlias(input("conta CEG GAS"), [antigo, recente])?.id).toBe("recente");
    expect(matchAlias(input("conta CEG GAS"), [recente, antigo])?.id).toBe("recente");
  });

  it("ignora candidatos com triggerNormalized vazio", () => {
    const vazio = alias({ id: "vazio", trigger: "", triggerNormalized: "" });
    expect(matchAlias(input("qualquer coisa"), [vazio])).toBeNull();
  });

  describe("modo regex", () => {
    it("casa a descrição pelo padrão (trigger em case original)", () => {
      const re = alias({ id: "re", trigger: "^UBER \\d+", triggerMode: "regex" });
      expect(matchAlias(input("UBER 123 viagem"), [re])?.id).toBe("re");
      expect(matchAlias(input("pagamento UBER 123"), [re])).toBeNull(); // âncora ^ não casa
    });

    it("regex inválida nunca casa (defensivo)", () => {
      const bad = alias({ id: "bad", trigger: "(", triggerMode: "regex" });
      expect(matchAlias(input("qualquer ( coisa"), [bad])).toBeNull();
    });
  });

  describe("condição de instituição (AND)", () => {
    const nu = alias({ id: "nu", trigger: "PIX", conditionInstitutionId: "inst-nu" });

    it("casa só quando a instituição da transação bate", () => {
      expect(matchAlias(input("PIX enviado", { institutionId: "inst-nu" }), [nu])?.id).toBe("nu");
    });

    it("não casa quando a instituição difere ou está ausente", () => {
      expect(matchAlias(input("PIX enviado", { institutionId: "inst-outro" }), [nu])).toBeNull();
      expect(matchAlias(input("PIX enviado", { institutionId: null }), [nu])).toBeNull();
    });
  });

  describe("faixa de valor (AND, BigInt)", () => {
    const faixa = alias({ id: "faixa", trigger: "MERCADO", minCents: "1000", maxCents: "5000" });

    it("casa dentro da faixa (inclusive nos limites)", () => {
      expect(matchAlias(input("MERCADO", { amountCents: 3000n }), [faixa])?.id).toBe("faixa");
      expect(matchAlias(input("MERCADO", { amountCents: 1000n }), [faixa])?.id).toBe("faixa");
      expect(matchAlias(input("MERCADO", { amountCents: 5000n }), [faixa])?.id).toBe("faixa");
    });

    it("não casa fora da faixa", () => {
      expect(matchAlias(input("MERCADO", { amountCents: 999n }), [faixa])).toBeNull();
      expect(matchAlias(input("MERCADO", { amountCents: 5001n }), [faixa])).toBeNull();
    });

    it("não casa quando a faixa está preenchida mas a transação não tem valor", () => {
      expect(matchAlias(input("MERCADO", { amountCents: null }), [faixa])).toBeNull();
    });

    it("só minCents: casa de minCents pra cima", () => {
      const min = alias({ id: "min", trigger: "MERCADO", minCents: "1000" });
      expect(matchAlias(input("MERCADO", { amountCents: 999n }), [min])).toBeNull();
      expect(matchAlias(input("MERCADO", { amountCents: 1000n }), [min])?.id).toBe("min");
    });
  });

  describe("prioridade no desempate", () => {
    it("prioridade vence antes do comprimento do gatilho", () => {
      // 'GAS' (high, 3 chars) deve vencer 'CEG GAS' (medium, 7 chars).
      const high = alias({ id: "high", trigger: "GAS", priority: "high" });
      const medium = alias({ id: "medium", trigger: "CEG GAS", priority: "medium" });
      expect(matchAlias(input("conta CEG GAS"), [high, medium])?.id).toBe("high");
      expect(matchAlias(input("conta CEG GAS"), [medium, high])?.id).toBe("high");
    });

    it("empate de prioridade cai para o gatilho mais longo", () => {
      const curto = alias({ id: "curto", trigger: "CEG", priority: "low" });
      const longo = alias({ id: "longo", trigger: "CEG GAS", priority: "low" });
      expect(matchAlias(input("conta CEG GAS"), [curto, longo])?.id).toBe("longo");
    });
  });
});
