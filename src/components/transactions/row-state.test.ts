import { describe, expect, it } from "vitest";

import { describeRowState } from "./row-state";

const base = { description: "Netflix", notes: null, originalCurrency: null, linkCount: 0 };

describe("describeRowState", () => {
  it("retorna só a descrição quando não há estado", () => {
    expect(describeRowState(base)).toBe("Netflix");
  });

  it("lista nota, moeda estrangeira e vínculos (plural)", () => {
    expect(
      describeRowState({ description: "Netflix", notes: "x", originalCurrency: "USD", linkCount: 2 }),
    ).toBe("Netflix — tem nota, moeda estrangeira, 2 vínculos");
  });

  it("usa singular para 1 vínculo", () => {
    expect(describeRowState({ ...base, linkCount: 1 })).toBe("Netflix — 1 vínculo");
  });

  it("retorna só os estados quando não há descrição", () => {
    expect(describeRowState({ description: null, notes: "x", originalCurrency: null, linkCount: 0 })).toBe(
      "tem nota",
    );
  });
});
