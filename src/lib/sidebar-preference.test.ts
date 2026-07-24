import { describe, expect, it } from "vitest";

import { parseSidebarCollapsed } from "./sidebar-preference";

describe("parseSidebarCollapsed", () => {
  it("retorna true para '1'", () => {
    expect(parseSidebarCollapsed("1")).toBe(true);
  });

  it("retorna false quando o cookie está ausente", () => {
    expect(parseSidebarCollapsed(undefined)).toBe(false);
  });

  it("retorna false para '0'", () => {
    expect(parseSidebarCollapsed("0")).toBe(false);
  });

  it("retorna false para 'true' (só '1' é aceito)", () => {
    expect(parseSidebarCollapsed("true")).toBe(false);
  });

  it("retorna false para string vazia", () => {
    expect(parseSidebarCollapsed("")).toBe(false);
  });
});
