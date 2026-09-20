import { describe, expect, it } from "vitest";

import { resolveRowLayout } from "./row-layout";

describe("resolveRowLayout", () => {
  it("viewport estreito sempre resolve para 'pills' (independe do configurado)", () => {
    expect(resolveRowLayout("columns", true)).toBe("pills");
    expect(resolveRowLayout("pills", true)).toBe("pills");
  });

  it("viewport largo: usa o layout configurado", () => {
    expect(resolveRowLayout("columns", false)).toBe("columns");
    expect(resolveRowLayout("pills", false)).toBe("pills");
  });

  it("viewport largo: normaliza qualquer valor != 'pills' para 'columns'", () => {
    expect(resolveRowLayout("desconhecido" as "columns", false)).toBe("columns");
  });
});
