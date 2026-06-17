import { describe, expect, it } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";
import { TEST_CTX } from "@/../tests/fixtures/account";

import { GRID_CONFIG, resolveLayout } from "@/components/dashboards/_core/widget-registry";
import type { StoredWidget } from "@/lib/schemas/dashboard-layout";

import { getLayout, upsertLayout } from "./dashboard-layout-service";

function buildStored(overrides: Partial<StoredWidget> = {}): StoredWidget {
  return {
    instanceId: "i1",
    widgetId: "kpi-income",
    visible: true,
    x: 0,
    y: 0,
    w: 1,
    h: 1,
    sizeVariantId: "default",
    ...overrides,
  };
}

// ─── getLayout (StoredWidget[]) ────────────────────────────────────

describe("getLayout", () => {
  it("retorna layout inicial quando não há registro salvo", async () => {
    prismaMock.dashboardLayout.findUnique.mockResolvedValue(null);

    const result = await getLayout("acc-test-1", "monthly");

    expect(result.length).toBeGreaterThan(0);
    result.forEach((w) => {
      expect(w).toHaveProperty("instanceId");
      expect(w).toHaveProperty("x");
      expect(w).toHaveProperty("y");
      expect(w.visible).toBe(true);
    });
  });

  it("filtra accountId corretamente — isolamento multi-tenancy", async () => {
    prismaMock.dashboardLayout.findUnique.mockResolvedValue(null);

    await getLayout("acc-test-1", "monthly");

    expect(prismaMock.dashboardLayout.findUnique).toHaveBeenCalledWith({
      where: { accountId_context: { accountId: "acc-test-1", context: "monthly" } },
      select: { widgets: true },
    });
  });

  it("descarta widgetId desconhecido silenciosamente", async () => {
    prismaMock.dashboardLayout.findUnique.mockResolvedValue({
      widgets: [buildStored({ widgetId: "widget-inexistente" })],
    } as never);

    const result = await getLayout("acc-test-1", "monthly");

    expect(result.every((w) => w.widgetId !== "widget-inexistente")).toBe(true);
  });

  it("faz fallback de sizeVariantId desconhecido para sizeVariants[0]", async () => {
    prismaMock.dashboardLayout.findUnique.mockResolvedValue({
      widgets: [buildStored({ widgetId: "kpi-income", sizeVariantId: "variante-inexistente" })],
    } as never);

    const result = await getLayout("acc-test-1", "monthly");

    const kpi = result.find((w) => w.widgetId === "kpi-income");
    expect(kpi?.sizeVariantId).toBe("default"); // sizeVariants[0].id
  });
});

// ─── upsertLayout ──────────────────────────────────────────────────

describe("upsertLayout", () => {
  it("usa ctx.accountId, não input.accountId — multi-tenancy", async () => {
    prismaMock.dashboardLayout.upsert.mockResolvedValue({} as never);

    await upsertLayout({ context: "monthly", widgets: [] }, TEST_CTX);

    expect(prismaMock.dashboardLayout.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { accountId_context: { accountId: TEST_CTX.accountId, context: "monthly" } },
      }),
    );
  });

  it("rejeita widget com widgetId desconhecido", async () => {
    await expect(
      upsertLayout(
        { context: "monthly", widgets: [buildStored({ widgetId: "inexistente" })] },
        TEST_CTX,
      ),
    ).rejects.toThrow();
  });

  it("rejeita widget fora dos limites da grade", async () => {
    const { cols } = GRID_CONFIG["monthly"];
    await expect(
      upsertLayout(
        {
          context: "monthly",
          widgets: [buildStored({ widgetId: "kpi-income", x: cols, y: 0, w: 1, h: 1 })],
        },
        TEST_CTX,
      ),
    ).rejects.toThrow();
  });

  it("aceita config válida para widget com configSchema (money-flow)", async () => {
    prismaMock.dashboardLayout.upsert.mockResolvedValue({} as never);
    await upsertLayout(
      {
        context: "monthly",
        widgets: [
          buildStored({ widgetId: "money-flow", w: 6, h: 3, config: { groupBy: "section" } }),
        ],
      },
      TEST_CTX,
    );
    expect(prismaMock.dashboardLayout.upsert).toHaveBeenCalled();
  });

  it("rejeita config inválida para widget com configSchema (money-flow)", async () => {
    await expect(
      upsertLayout(
        {
          context: "monthly",
          widgets: [
            buildStored({ widgetId: "money-flow", w: 6, h: 3, config: { groupBy: "bogus" } }),
          ],
        },
        TEST_CTX,
      ),
    ).rejects.toThrow();
  });
});

// ─── resolveLayout — bin-packing ───────────────────────────────────

describe("resolveLayout — bin-packing", () => {
  it("posiciona widgets dentro dos limites de cols", () => {
    const result = resolveLayout("monthly", null);
    const { cols } = GRID_CONFIG["monthly"];
    result.forEach((w) => {
      expect(w.x + w.w).toBeLessThanOrEqual(cols);
    });
  });

  it("auto-insere widgets defaultVisible ausentes no layout salvo", () => {
    // Layout salvo só com kpi-income — os demais defaultVisible devem ser auto-inseridos
    const result = resolveLayout("monthly", [buildStored({ widgetId: "kpi-income" })]);
    const ids = result.map((w) => w.widgetId);
    expect(ids).toContain("kpi-income");
    expect(ids).toContain("kpi-expenses"); // defaultVisible ausente → auto-inserido
  });
});
