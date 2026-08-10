import { describe, expect, it } from "vitest";

import { ACTIVE_SOURCE_KIND, formatLastUsedLabel, resolveActive } from "./settings-status";

describe("resolveActive", () => {
  it("isActive: espelha o booleano", () => {
    expect(resolveActive({ kind: "isActive", isActive: true })).toBe(true);
    expect(resolveActive({ kind: "isActive", isActive: false })).toBe(false);
  });

  it("archivedAt: null é ATIVO (é o contrário de isActive — a fonte do bug que D2 evita)", () => {
    expect(resolveActive({ kind: "archivedAt", archivedAt: null })).toBe(true);
    expect(resolveActive({ kind: "archivedAt", archivedAt: new Date("2026-01-01") })).toBe(false);
    expect(resolveActive({ kind: "archivedAt", archivedAt: "2026-01-01T00:00:00.000Z" })).toBe(
      false,
    );
  });

  it("status: só 'active' é ativo", () => {
    expect(resolveActive({ kind: "status", status: "active" })).toBe(true);
    expect(resolveActive({ kind: "status", status: "inactive" })).toBe(false);
  });
});

describe("ACTIVE_SOURCE_KIND", () => {
  it("as três entidades com mecanismo próprio NÃO são migradas para status (D2)", () => {
    expect(ACTIVE_SOURCE_KIND.Section).toBe("isActive");
    expect(ACTIVE_SOURCE_KIND.ResponsibleParty).toBe("archivedAt");
    expect(ACTIVE_SOURCE_KIND.TransactionAlias).toBe("archivedAt");
  });

  it("as demais usam o enum novo", () => {
    expect(ACTIVE_SOURCE_KIND.Category).toBe("status");
    expect(ACTIVE_SOURCE_KIND.CsvTemplate).toBe("status");
    expect(ACTIVE_SOURCE_KIND.ChecklistItem).toBe("status");
  });
});

describe("formatLastUsedLabel", () => {
  it("inativo vence tudo — mesmo com lastUsedAt preenchido", () => {
    expect(
      formatLastUsedLabel({ active: false, lastUsedAt: new Date("2026-07-15T12:00:00.000Z") }),
    ).toBe("desativado");
  });

  it("ativo sem uso concorda em gênero", () => {
    expect(formatLastUsedLabel({ active: true, lastUsedAt: null })).toBe("nunca usada");
    expect(formatLastUsedLabel({ active: true, lastUsedAt: null, gender: "m" })).toBe(
      "nunca usado",
    );
    expect(formatLastUsedLabel({ active: true, lastUsedAt: undefined })).toBe("nunca usada");
  });

  it("ativo com uso vira rótulo de mês", () => {
    const label = formatLastUsedLabel({
      active: true,
      lastUsedAt: new Date("2026-07-15T12:00:00.000Z"),
    });
    expect(label).toMatch(/jul/i);
    expect(label).toContain("2026");
  });

  it("aceita string ISO (fronteira RSC → client)", () => {
    expect(formatLastUsedLabel({ active: true, lastUsedAt: "2026-07-15T12:00:00.000Z" })).toBe(
      formatLastUsedLabel({ active: true, lastUsedAt: new Date("2026-07-15T12:00:00.000Z") }),
    );
  });

  it("lê o mês em UTC — não escorrega para o mês anterior em fuso negativo", () => {
    // 01/07 00:30 UTC é 30/06 21:30 em America/Sao_Paulo; o rótulo tem de dizer julho.
    const label = formatLastUsedLabel({
      active: true,
      lastUsedAt: "2026-07-01T00:30:00.000Z",
    });
    expect(label).toMatch(/jul/i);
  });

  it("data inválida degrada para 'nunca usada' em vez de 'Invalid Date'", () => {
    expect(formatLastUsedLabel({ active: true, lastUsedAt: "não é data" })).toBe("nunca usada");
  });
});
