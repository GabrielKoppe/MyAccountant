import { describe, expect, it } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";
import { TEST_CTX } from "@/../tests/fixtures/account";

import {
  GRID_CONFIG,
  resolveGridLayout,
} from "@/components/dashboards/_core/widget-registry";
import type { StoredWidget } from "@/lib/schemas/dashboard-layout";

import { getLayout, upsertLayout, getGridLayout, upsertGridLayout } from "./dashboard-layout-service";

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

// ─── getLayout ────────────────────────────────────────────────────

describe("getLayout", () => {
  it("deve retornar layout padrão quando não há registro salvo", async () => {
    prismaMock.dashboardLayout.findUnique.mockResolvedValue(null);

    const result = await getLayout("acc-test-1", "monthly");

    expect(result.active.length).toBeGreaterThan(0);
    // Ativos por padrão = todos com defaultVisible: true; widgets opt-in
    // (defaultVisible: false, ex.: insights) começam em "Disponíveis".
    expect(result.active.every((w) => w.defaultVisible)).toBe(true);
    expect(result.available.every((w) => !w.defaultVisible)).toBe(true);
  });

  it("deve respeitar a ordem salva no banco", async () => {
    const storedOrder = ["budgets", "kpi-income", "kpi-expenses"];
    prismaMock.dashboardLayout.findUnique.mockResolvedValue({
      widgets: storedOrder,
    } as any);

    const result = await getLayout("acc-test-1", "monthly");

    expect(result.active[0].id).toBe("budgets");
    expect(result.active[1].id).toBe("kpi-income");
    expect(result.active[2].id).toBe("kpi-expenses");
    // Apenas os 3 salvos devem estar ativos — outros ficam disponíveis
    expect(result.active).toHaveLength(3);
  });

  it("deve ignorar widgetIds desconhecidos salvos no banco", async () => {
    prismaMock.dashboardLayout.findUnique.mockResolvedValue({
      widgets: ["widget-inexistente", "kpi-income"],
    } as any);

    const result = await getLayout("acc-test-1", "monthly");

    const ids = result.active.map((w) => w.id);
    expect(ids).not.toContain("widget-inexistente");
    expect(ids).toContain("kpi-income");
    // Apenas 1 widget ativo (o inexistente foi descartado)
    expect(result.active).toHaveLength(1);
  });

  it("não deve re-adicionar widgets removidos pelo usuário (stored não-nulo)", async () => {
    // Usuário removeu tudo exceto kpi-income
    prismaMock.dashboardLayout.findUnique.mockResolvedValue({
      widgets: ["kpi-income"],
    } as any);

    const result = await getLayout("acc-test-1", "monthly");

    expect(result.active).toHaveLength(1);
    expect(result.active[0].id).toBe("kpi-income");
    // Os removidos devem estar em available
    expect(result.available.length).toBeGreaterThan(0);
  });

  it("deve respeitar stored vazio (usuário removeu todos)", async () => {
    prismaMock.dashboardLayout.findUnique.mockResolvedValue({
      widgets: [],
    } as any);

    const result = await getLayout("acc-test-1", "monthly");

    expect(result.active).toHaveLength(0);
    expect(result.available.length).toBeGreaterThan(0);
  });

  it("deve filtrar por accountId (multi-tenancy)", async () => {
    prismaMock.dashboardLayout.findUnique.mockResolvedValue(null);

    await getLayout("acc-test-1", "monthly");

    expect(prismaMock.dashboardLayout.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { accountId_context: { accountId: "acc-test-1", context: "monthly" } },
      }),
    );
  });
});

// ─── upsertLayout ─────────────────────────────────────────────────

describe("upsertLayout", () => {
  it("deve salvar widgets filtrados por widgetIds conhecidos", async () => {
    prismaMock.dashboardLayout.upsert.mockResolvedValue({} as any);

    await upsertLayout(
      { accountId: "acc-test-1", context: "monthly", widgets: ["kpi-income", "widget-fake"] },
      TEST_CTX,
    );

    expect(prismaMock.dashboardLayout.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          accountId: "acc-test-1",
          widgets: ["kpi-income"],
        }),
        update: expect.objectContaining({
          widgets: ["kpi-income"],
        }),
      }),
    );
  });

  it("não deve vazar dados entre tenants (multi-tenancy)", async () => {
    prismaMock.dashboardLayout.upsert.mockResolvedValue({} as any);

    await upsertLayout(
      { accountId: "acc-test-1", context: "monthly", widgets: ["kpi-income"] },
      { ...TEST_CTX, accountId: "acc-test-1" },
    );

    expect(prismaMock.dashboardLayout.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { accountId_context: { accountId: "acc-test-1", context: "monthly" } },
        create: expect.objectContaining({ accountId: "acc-test-1" }),
      }),
    );
    expect(prismaMock.dashboardLayout.upsert).not.toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ accountId: "acc-outro" }),
      }),
    );
  });

  it("deve usar ctx.accountId, não input.accountId, para tenancy", async () => {
    prismaMock.dashboardLayout.upsert.mockResolvedValue({} as any);

    await upsertLayout(
      { accountId: "acc-test-1", context: "yearly", widgets: ["kpi-year-total"] },
      { ...TEST_CTX, accountId: "acc-test-1" },
    );

    const call = prismaMock.dashboardLayout.upsert.mock.calls[0][0];
    expect(call.where?.accountId_context?.accountId).toBe("acc-test-1");
    expect(call.create.accountId).toBe("acc-test-1");
  });
});

// ─── getGridLayout (spec 36 — StoredWidget[]) ──────────────────────

describe("getGridLayout", () => {
  it("retorna layout inicial quando não há registro salvo", async () => {
    prismaMock.dashboardLayout.findUnique.mockResolvedValue(null);

    const result = await getGridLayout("acc-test-1", "monthly");

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

    await getGridLayout("acc-test-1", "monthly");

    expect(prismaMock.dashboardLayout.findUnique).toHaveBeenCalledWith({
      where: { accountId_context: { accountId: "acc-test-1", context: "monthly" } },
      select: { widgets: true },
    });
  });

  it("descarta widgetId desconhecido silenciosamente", async () => {
    prismaMock.dashboardLayout.findUnique.mockResolvedValue({
      widgets: [buildStored({ widgetId: "widget-inexistente" })],
    } as never);

    const result = await getGridLayout("acc-test-1", "monthly");

    expect(result.every((w) => w.widgetId !== "widget-inexistente")).toBe(true);
  });

  it("faz fallback de sizeVariantId desconhecido para sizeVariants[0]", async () => {
    prismaMock.dashboardLayout.findUnique.mockResolvedValue({
      widgets: [buildStored({ widgetId: "kpi-income", sizeVariantId: "variante-inexistente" })],
    } as never);

    const result = await getGridLayout("acc-test-1", "monthly");

    const kpi = result.find((w) => w.widgetId === "kpi-income");
    expect(kpi?.sizeVariantId).toBe("default"); // sizeVariants[0].id
  });
});

// ─── upsertGridLayout (spec 36) ────────────────────────────────────

describe("upsertGridLayout", () => {
  it("usa ctx.accountId, não input.accountId — multi-tenancy", async () => {
    prismaMock.dashboardLayout.upsert.mockResolvedValue({} as never);

    await upsertGridLayout({ context: "monthly", widgets: [] }, TEST_CTX);

    expect(prismaMock.dashboardLayout.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { accountId_context: { accountId: TEST_CTX.accountId, context: "monthly" } },
      }),
    );
  });

  it("rejeita widget com widgetId desconhecido", async () => {
    await expect(
      upsertGridLayout(
        { context: "monthly", widgets: [buildStored({ widgetId: "inexistente" })] },
        TEST_CTX,
      ),
    ).rejects.toThrow();
  });

  it("rejeita widget fora dos limites da grade", async () => {
    const { cols } = GRID_CONFIG["monthly"];
    await expect(
      upsertGridLayout(
        {
          context: "monthly",
          widgets: [buildStored({ widgetId: "kpi-income", x: cols, y: 0, w: 1, h: 1 })],
        },
        TEST_CTX,
      ),
    ).rejects.toThrow();
  });
});

// ─── resolveGridLayout — bin-packing ───────────────────────────────

describe("resolveGridLayout — bin-packing", () => {
  it("posiciona widgets dentro dos limites de cols", () => {
    const result = resolveGridLayout("monthly", null);
    const { cols } = GRID_CONFIG["monthly"];
    result.forEach((w) => {
      expect(w.x + w.w).toBeLessThanOrEqual(cols);
    });
  });

  it("auto-insere widgets defaultVisible ausentes no layout salvo", () => {
    // Layout salvo só com kpi-income — os demais defaultVisible devem ser auto-inseridos
    const result = resolveGridLayout("monthly", [buildStored({ widgetId: "kpi-income" })]);
    const ids = result.map((w) => w.widgetId);
    expect(ids).toContain("kpi-income");
    expect(ids).toContain("kpi-expenses"); // defaultVisible ausente → auto-inserido
  });
});
