import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

vi.mock("@/server/queries/dashboards", () => ({
  getYearOverview: vi.fn(),
  getMonthDeepDive: vi.fn(),
  getMonthSparklineData: vi.fn(),
  getComparisonData: vi.fn(),
  getDailyTotals: vi.fn(),
  getCategoryBreakdownFiltered: vi.fn(),
  getCategoryTreemapData: vi.fn(),
  getSankeyData: vi.fn(),
  getTransactionsByIds: vi.fn(),
  getYearDeepDive: vi.fn(),
  getInstitutionBreakdown: vi.fn(),
  getWeeklySpending: vi.fn(),
  getTransactionCount: vi.fn(),
}));

import { mcpTools } from "@/server/mcp/tools";
import {
  getYearOverview,
  getMonthDeepDive,
  getMonthSparklineData,
  getComparisonData,
  getDailyTotals,
  getCategoryBreakdownFiltered,
  getCategoryTreemapData,
  getSankeyData,
  getTransactionsByIds,
  getYearDeepDive,
  getInstitutionBreakdown,
  getWeeklySpending,
  getTransactionCount,
} from "@/server/queries/dashboards";

const ctx = { accountId: "ctx-account", userId: "u1" };

beforeEach(() => vi.clearAllMocks());

describe("mcpTools catalog", () => {
  it("nenhuma tool expõe accountId no shape (DD-04)", () => {
    for (const tool of Object.values(mcpTools)) {
      expect(Object.keys(tool.shape)).not.toContain("accountId");
    }
  });

  it("registra as 13 tools esperadas do dashboards.ts", () => {
    expect(Object.keys(mcpTools).sort()).toEqual(
      [
        "get_category_breakdown",
        "get_year_overview",
        "get_month_deep_dive",
        "get_month_sparkline",
        "get_comparison_data",
        "get_daily_totals",
        "get_category_treemap",
        "get_sankey_data",
        "get_transactions_by_ids",
        "get_year_deep_dive",
        "get_institution_breakdown",
        "get_weekly_spending",
        "get_transaction_count",
      ].sort(),
    );
  });
});

describe("mcpTools.get_category_breakdown", () => {
  it("aceita input sem accountId (schema derivado não expõe accountId)", () => {
    const tool = mcpTools["get_category_breakdown"];
    const schema = z.object(tool.shape);
    const parsed = schema.safeParse({ accountId: "hack", monthId: "m1" });

    expect(parsed.success).toBe(true);
    expect((parsed as { data: Record<string, unknown> }).data.accountId).toBeUndefined();
  });

  it("chama a query com o accountId do contexto, nunca do input", async () => {
    (getCategoryBreakdownFiltered as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const tool = mcpTools["get_category_breakdown"];

    await tool.run(ctx, { monthId: "m1", filterExpenseType: "all", filterTagIds: [] });

    expect(getCategoryBreakdownFiltered).toHaveBeenCalledWith("ctx-account", "m1", {
      filterExpenseType: "all",
      filterTagIds: [],
    });
  });
});

describe("mcpTools.get_year_overview", () => {
  it("chama getYearOverview com ctx.accountId, não input.accountId", async () => {
    (getYearOverview as ReturnType<typeof vi.fn>).mockResolvedValue({});
    const tool = mcpTools["get_year_overview"];

    await tool.run(ctx, { year: 2026 });

    expect(getYearOverview).toHaveBeenCalledWith("ctx-account", 2026);
  });
});

describe("mcpTools.get_month_deep_dive", () => {
  it("chama getMonthDeepDive com ctx.accountId", async () => {
    (getMonthDeepDive as ReturnType<typeof vi.fn>).mockResolvedValue({});
    const tool = mcpTools["get_month_deep_dive"];

    await tool.run(ctx, { monthId: "m1" });

    expect(getMonthDeepDive).toHaveBeenCalledWith("ctx-account", "m1");
  });
});

describe("mcpTools.get_month_sparkline", () => {
  it("chama getMonthSparklineData com ctx.accountId", async () => {
    (getMonthSparklineData as ReturnType<typeof vi.fn>).mockResolvedValue({});
    const tool = mcpTools["get_month_sparkline"];

    await tool.run(ctx, { currentMonthId: "m1" });

    expect(getMonthSparklineData).toHaveBeenCalledWith("ctx-account", "m1");
  });
});

describe("mcpTools.get_comparison_data", () => {
  it("chama getComparisonData com ctx.accountId", async () => {
    (getComparisonData as ReturnType<typeof vi.fn>).mockResolvedValue({});
    const tool = mcpTools["get_comparison_data"];

    await tool.run(ctx, { currentMonthId: "m1" });

    expect(getComparisonData).toHaveBeenCalledWith("ctx-account", "m1");
  });
});

describe("mcpTools.get_daily_totals", () => {
  it("chama getDailyTotals com ctx.accountId e subtractSectionIds null", async () => {
    (getDailyTotals as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const tool = mcpTools["get_daily_totals"];

    await tool.run(ctx, { monthId: "m1", subtractSectionIds: null });

    expect(getDailyTotals).toHaveBeenCalledWith("ctx-account", "m1", null);
  });

  it("chama getDailyTotals com lista de seções quando informada", async () => {
    (getDailyTotals as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const tool = mcpTools["get_daily_totals"];

    await tool.run(ctx, { monthId: "m1", subtractSectionIds: ["s1", "s2"] });

    expect(getDailyTotals).toHaveBeenCalledWith("ctx-account", "m1", ["s1", "s2"]);
  });
});

describe("mcpTools.get_category_treemap", () => {
  it("chama getCategoryTreemapData com ctx.accountId", async () => {
    (getCategoryTreemapData as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const tool = mcpTools["get_category_treemap"];

    await tool.run(ctx, { monthId: "m1" });

    expect(getCategoryTreemapData).toHaveBeenCalledWith("ctx-account", "m1");
  });
});

describe("mcpTools.get_sankey_data", () => {
  it("chama getSankeyData com ctx.accountId e repassa sections/sectionTotals/groupBy", async () => {
    (getSankeyData as ReturnType<typeof vi.fn>).mockResolvedValue({ nodes: [], links: [] });
    const tool = mcpTools["get_sankey_data"];
    const sections = [{ id: "s1", name: "Salário", countType: "add" }];
    const sectionTotals = { s1: "10000" };

    await tool.run(ctx, { monthId: "m1", sections, sectionTotals, groupBy: "category" });

    expect(getSankeyData).toHaveBeenCalledWith(
      "ctx-account",
      "m1",
      sections,
      sectionTotals,
      "category",
    );
  });
});

describe("mcpTools.get_transactions_by_ids", () => {
  it("chama getTransactionsByIds com ctx.accountId", async () => {
    (getTransactionsByIds as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const tool = mcpTools["get_transactions_by_ids"];

    await tool.run(ctx, { ids: ["t1", "t2"] });

    expect(getTransactionsByIds).toHaveBeenCalledWith("ctx-account", ["t1", "t2"]);
  });
});

describe("mcpTools.get_year_deep_dive", () => {
  it("chama getYearDeepDive com ctx.accountId", async () => {
    (getYearDeepDive as ReturnType<typeof vi.fn>).mockResolvedValue({});
    const tool = mcpTools["get_year_deep_dive"];

    await tool.run(ctx, { year: 2025 });

    expect(getYearDeepDive).toHaveBeenCalledWith("ctx-account", 2025);
  });
});

describe("mcpTools.get_institution_breakdown", () => {
  it("chama getInstitutionBreakdown com ctx.accountId", async () => {
    (getInstitutionBreakdown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const tool = mcpTools["get_institution_breakdown"];

    await tool.run(ctx, { monthId: "m1" });

    expect(getInstitutionBreakdown).toHaveBeenCalledWith("ctx-account", "m1");
  });
});

describe("mcpTools.get_weekly_spending", () => {
  it("chama getWeeklySpending com ctx.accountId e os params informados", async () => {
    (getWeeklySpending as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const tool = mcpTools["get_weekly_spending"];

    await tool.run(ctx, { monthId: "m1", monthStartDay: 5, metric: "both" });

    expect(getWeeklySpending).toHaveBeenCalledWith("ctx-account", "m1", 5, "both");
  });
});

describe("mcpTools.get_transaction_count", () => {
  it("chama getTransactionCount com ctx.accountId e periodFilter por monthId", async () => {
    (getTransactionCount as ReturnType<typeof vi.fn>).mockResolvedValue(3);
    const tool = mcpTools["get_transaction_count"];

    await tool.run(ctx, { periodFilter: { monthId: "m1" }, options: { includePending: false } });

    expect(getTransactionCount).toHaveBeenCalledWith(
      "ctx-account",
      { monthId: "m1" },
      { includePending: false },
    );
  });

  it("chama getTransactionCount com periodFilter por monthIds", async () => {
    (getTransactionCount as ReturnType<typeof vi.fn>).mockResolvedValue(7);
    const tool = mcpTools["get_transaction_count"];

    await tool.run(ctx, { periodFilter: { monthIds: ["m1", "m2"] } });

    expect(getTransactionCount).toHaveBeenCalledWith(
      "ctx-account",
      { monthIds: ["m1", "m2"] },
      undefined,
    );
  });
});
