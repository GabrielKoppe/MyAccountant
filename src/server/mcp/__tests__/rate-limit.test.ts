import { describe, expect, it } from "vitest";

import { ConflictError } from "@/server/api/errors";
import { checkMcpRateLimit } from "@/server/mcp/rate-limit";

describe("checkMcpRateLimit", () => {
  it("permite até `max` chamadas dentro da janela", () => {
    const grantId = "grant-allowed";

    for (let i = 0; i < 5; i++) {
      expect(() =>
        checkMcpRateLimit(grantId, { max: 5, windowMs: 60_000, now: 1_000 + i }),
      ).not.toThrow();
    }
  });

  it("estoura na chamada N+1 dentro da janela", () => {
    const grantId = "grant-exceeds";

    for (let i = 0; i < 5; i++) {
      checkMcpRateLimit(grantId, { max: 5, windowMs: 60_000, now: 1_000 + i });
    }

    expect(() => checkMcpRateLimit(grantId, { max: 5, windowMs: 60_000, now: 1_005 })).toThrow(
      ConflictError,
    );
  });

  it("permite novamente após a janela deslizante expirar", () => {
    const grantId = "grant-resets";

    for (let i = 0; i < 5; i++) {
      checkMcpRateLimit(grantId, { max: 5, windowMs: 60_000, now: i });
    }
    // Ainda dentro da janela: estoura.
    expect(() => checkMcpRateLimit(grantId, { max: 5, windowMs: 60_000, now: 10 })).toThrow(
      ConflictError,
    );

    // Passado o fim da janela original (todas as marcas de 0-4 expiraram): permite de novo.
    expect(() =>
      checkMcpRateLimit(grantId, { max: 5, windowMs: 60_000, now: 60_006 }),
    ).not.toThrow();
  });

  it("mantém contadores independentes por grantId", () => {
    const cfg = { max: 1, windowMs: 60_000, now: 100 };

    expect(() => checkMcpRateLimit("grant-a", cfg)).not.toThrow();
    expect(() => checkMcpRateLimit("grant-b", cfg)).not.toThrow();
    expect(() => checkMcpRateLimit("grant-a", cfg)).toThrow(ConflictError);
  });

  it("usa os defaults de produção quando nenhuma config é passada", () => {
    expect(() => checkMcpRateLimit("grant-defaults")).not.toThrow();
  });
});
