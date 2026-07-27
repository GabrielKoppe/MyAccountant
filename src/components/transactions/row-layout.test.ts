import { describe, expect, it } from "vitest";

import { resolveRowLayout } from "./row-layout";

describe("resolveRowLayout", () => {
  it("viewport estreito sempre resolve para 'rich' (independe do configurado)", () => {
    expect(resolveRowLayout("columns", true)).toBe("rich");
    expect(resolveRowLayout("rich", true)).toBe("rich");
  });

  it("viewport largo: usa o layout configurado", () => {
    expect(resolveRowLayout("columns", false)).toBe("columns");
    expect(resolveRowLayout("rich", false)).toBe("rich");
  });

  it("viewport largo: normaliza qualquer valor != 'rich' para 'columns'", () => {
    expect(resolveRowLayout("desconhecido" as "columns", false)).toBe("columns");
  });
});
