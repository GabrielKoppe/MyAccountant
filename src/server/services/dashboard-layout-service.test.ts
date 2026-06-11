import { describe, expect, it } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";
import { TEST_CTX } from "@/../tests/fixtures/account";

import { getLayout, upsertLayout } from "./dashboard-layout-service";

// ─── getLayout ────────────────────────────────────────────────────

describe("getLayout", () => {
  it("deve retornar layout padrão quando não há registro salvo", async () => {
    prismaMock.dashboardLayout.findUnique.mockResolvedValue(null);

    const result = await getLayout("acc-test-1", "monthly");

    expect(result.active.length).toBeGreaterThan(0);
    expect(result.available).toHaveLength(0);
    expect(result.active.every((w) => w.defaultVisible)).toBe(true);
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
