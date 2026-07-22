import { describe, expect, it } from "vitest";

import { forecastSettingsSchema } from "./forecast";

describe("forecastSettingsSchema", () => {
  it("aplica defaults quando vazio", () => {
    const r = forecastSettingsSchema.parse({});
    expect(r).toMatchObject({
      forecastHorizonMonths: 6, forecastScenario: "realistic",
      forecastOptimisticPct: 15, forecastConservativePct: 15,
      forecastVariableWindow: 6, forecastStartBalanceCents: null,
    });
  });
  it("rejeita horizonte fora do enum", () => {
    expect(forecastSettingsSchema.safeParse({ forecastHorizonMonths: 7 }).success).toBe(false);
  });
  it("rejeita fator acima de 50", () => {
    expect(forecastSettingsSchema.safeParse({ forecastOptimisticPct: 60 }).success).toBe(false);
  });
  it("aceita override BigInt e null", () => {
    expect(forecastSettingsSchema.parse({ forecastStartBalanceCents: 500000n }).forecastStartBalanceCents).toBe(500000n);
    expect(forecastSettingsSchema.parse({ forecastStartBalanceCents: null }).forecastStartBalanceCents).toBeNull();
  });
});
