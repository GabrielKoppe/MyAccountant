import { describe, expect, it } from "vitest";

import { createTableTypeSchema, updateTableTypeSchema } from "./settings";

const tableTypeId = "cljk3d4e500006abcdefgh1122";

describe("createTableTypeSchema — rowLayout", () => {
  it('aceita rowLayout "columns" e "pills"', () => {
    for (const rowLayout of ["columns", "pills"] as const) {
      const result = createTableTypeSchema.safeParse({
        name: "Tipo",
        hiddenColumns: {},
        rowLayout,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rowLayout é opcional (omissão válida)", () => {
    const result = createTableTypeSchema.safeParse({ name: "Tipo", hiddenColumns: {} });
    expect(result.success).toBe(true);
  });

  it("rejeita valor inválido de rowLayout", () => {
    const result = createTableTypeSchema.safeParse({
      name: "Tipo",
      hiddenColumns: {},
      rowLayout: "cards",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateTableTypeSchema — rowLayout", () => {
  it('aceita rowLayout "columns" e "pills"', () => {
    for (const rowLayout of ["columns", "pills"] as const) {
      const result = updateTableTypeSchema.safeParse({ tableTypeId, rowLayout });
      expect(result.success).toBe(true);
    }
  });

  it("rowLayout é opcional (omissão válida)", () => {
    const result = updateTableTypeSchema.safeParse({ tableTypeId });
    expect(result.success).toBe(true);
  });

  it("rejeita valor inválido de rowLayout", () => {
    const result = updateTableTypeSchema.safeParse({ tableTypeId, rowLayout: "grid" });
    expect(result.success).toBe(false);
  });
});
