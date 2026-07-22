import "@/../tests/mocks/auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";

// next/cache não roda fora de um request scope real do Next.js — precisa de mock
// (mesmo padrão de dashboard-layout.test.ts, net-worth.test.ts e mcp-connectors.test.ts).
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { updateForecastSettingsAction } from "./account-settings";

describe("updateForecastSettingsAction", () => {
  beforeEach(() => prismaMock.accountSettings.update.mockResolvedValue({} as any));

  it("persiste a config na account do contexto (usa ctx.accountId)", async () => {
    const res = await updateForecastSettingsAction("acc-test-1", {
      forecastHorizonMonths: 12,
      forecastScenario: "conservative",
      forecastOptimisticPct: 10,
      forecastConservativePct: 20,
      forecastVariableWindow: 3,
      forecastStartBalanceCents: 500000n,
    });

    expect(res.ok).toBe(true);
    expect(prismaMock.accountSettings.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { accountId: "acc-test-1" } }),
    );
  });

  it("rejeita input inválido (VALIDATION)", async () => {
    const res = await updateForecastSettingsAction("acc-test-1", { forecastHorizonMonths: 7 });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("VALIDATION");
  });
});
