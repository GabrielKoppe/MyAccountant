import type { SectionCountType } from "@prisma/client";

import { prisma } from "@/server/prisma";
import { formatMonthLabel } from "@/lib/dates";
import { calculateMonthTotal } from "@/server/services/month-service";

// ─── Shared types ─────────────────────────────────────────────────

export type SectionMeta = {
  id: string;
  name: string;
  countType: SectionCountType;
};

export type MonthMeta = {
  id: string;
  year: number;
  month: number;
  label: string;
};

// All cents serialized as strings (BigInt safe for RSC→Client serialization)
export type MonthSummary = MonthMeta & {
  sectionTotals: Record<string, string>; // sectionId → cents string
  total: string;
};

export type CategorySum = {
  categoryId: string | null;
  name: string;
  totalCents: string;
};

export type InstitutionSum = {
  institutionId: string | null;
  name: string;
  totalCents: string;
};

export type TopTransaction = {
  id: string;
  description: string | null;
  occurredOn: string;
  amountCents: string;
  sectionName: string;
  sectionCountType: string;
};

// ─── Helper: batch section totals for many months ─────────────────

async function batchSectionTotals(
  accountId: string,
  monthIds: string[],
  sectionIds: string[],
): Promise<Map<string, Map<string, bigint>>> {
  if (monthIds.length === 0 || sectionIds.length === 0) return new Map();

  const rows = await prisma.transaction.groupBy({
    by: ["monthId", "sectionId"],
    where: {
      accountId,
      monthId: { in: monthIds },
      sectionId: { in: sectionIds },
      table: { countInMonth: true },
    },
    _sum: { amountCents: true },
  });

  // Build nested map: monthId → sectionId → total
  const result = new Map<string, Map<string, bigint>>();
  for (const row of rows) {
    if (!result.has(row.monthId)) result.set(row.monthId, new Map());
    result.get(row.monthId)!.set(row.sectionId, row._sum.amountCents ?? 0n);
  }
  return result;
}

// ─── Year Overview ─────────────────────────────────────────────────

export async function getYearOverview(accountId: string, year: number) {
  const [sections, months, allYearsRaw] = await Promise.all([
    prisma.section.findMany({
      where: { accountId },
      orderBy: { order: "asc" },
      select: { id: true, name: true, countType: true },
    }),
    prisma.month.findMany({
      where: { accountId, year },
      orderBy: { month: "asc" },
      select: { id: true, year: true, month: true },
    }),
    prisma.month.findMany({
      where: { accountId },
      select: { year: true },
      distinct: ["year"],
      orderBy: { year: "desc" },
    }),
  ]);

  const allYears = [...new Set(allYearsRaw.map((m) => m.year))].sort((a, b) => b - a);
  const monthIds = months.map((m) => m.id);
  const sectionIds = sections.map((s) => s.id);

  const [sectionTotalsMap, topCategoriesRaw, pendingCount] = await Promise.all([
    batchSectionTotals(accountId, monthIds, sectionIds),
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: {
        accountId,
        monthId: { in: monthIds },
        categoryId: { not: null },
        table: { countInMonth: true },
      },
      _sum: { amountCents: true },
      orderBy: { _sum: { amountCents: "desc" } },
      take: 10,
    }),
    prisma.transaction.count({
      where: { accountId, monthId: { in: monthIds }, isPending: true },
    }),
  ]);

  // Resolve category names
  const categoryIds = topCategoriesRaw.map((r) => r.categoryId).filter(Boolean) as string[];
  const categoryNames = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true },
  });
  const catNameMap = new Map(categoryNames.map((c) => [c.id, c.name]));

  const topCategories: CategorySum[] = topCategoriesRaw.map((r) => ({
    categoryId: r.categoryId,
    name: r.categoryId ? (catNameMap.get(r.categoryId) ?? "—") : "Sem categoria",
    totalCents: (r._sum.amountCents ?? 0n).toString(),
  }));

  // Build month summaries
  const monthSummaries: MonthSummary[] = months.map((m) => {
    const sectionMap = sectionTotalsMap.get(m.id) ?? new Map<string, bigint>();
    const sectionTotals: Record<string, string> = {};
    for (const s of sections) {
      sectionTotals[s.id] = (sectionMap.get(s.id) ?? 0n).toString();
    }
    const total = calculateMonthTotal(
      sections,
      Object.fromEntries(Object.entries(sectionTotals).map(([k, v]) => [k, BigInt(v)])),
    );
    return {
      id: m.id,
      year: m.year,
      month: m.month,
      label: formatMonthLabel(m.year, m.month),
      sectionTotals,
      total: total.toString(),
    };
  });

  return { sections, monthSummaries, topCategories, pendingCount, allYears };
}

// ─── Monthly Deep Dive ─────────────────────────────────────────────

export async function getMonthDeepDive(accountId: string, monthId: string) {
  const [sections, topTransactionsRaw, favorites, categoryTotalsRaw] = await Promise.all([
    prisma.section.findMany({
      where: { accountId },
      orderBy: { order: "asc" },
      select: { id: true, name: true, countType: true },
    }),
    prisma.transaction.findMany({
      where: { accountId, monthId, table: { countInMonth: true } },
      orderBy: { amountCents: "desc" },
      take: 10,
      select: {
        id: true,
        description: true,
        occurredOn: true,
        amountCents: true,
        section: { select: { name: true, countType: true } },
      },
    }),
    prisma.transaction.findMany({
      where: { accountId, monthId, isFavorite: true },
      orderBy: { occurredOn: "desc" },
      take: 10,
      select: {
        id: true,
        description: true,
        occurredOn: true,
        amountCents: true,
        section: { select: { name: true, countType: true } },
      },
    }),
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { accountId, monthId, categoryId: { not: null }, table: { countInMonth: true } },
      _sum: { amountCents: true },
      orderBy: { _sum: { amountCents: "desc" } },
      take: 10,
    }),
  ]);

  const sectionIds = sections.map((s) => s.id);
  const sectionTotalsMap = await batchSectionTotals(accountId, [monthId], sectionIds);
  const sectionMap = sectionTotalsMap.get(monthId) ?? new Map<string, bigint>();

  const sectionTotals: Record<string, string> = {};
  for (const s of sections) {
    sectionTotals[s.id] = (sectionMap.get(s.id) ?? 0n).toString();
  }

  const monthTotal = calculateMonthTotal(
    sections,
    Object.fromEntries(Object.entries(sectionTotals).map(([k, v]) => [k, BigInt(v)])),
  );

  // Resolve category names
  const categoryIds = categoryTotalsRaw.map((r) => r.categoryId).filter(Boolean) as string[];
  const categoryNames = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true },
  });
  const catNameMap = new Map(categoryNames.map((c) => [c.id, c.name]));

  const topCategories: CategorySum[] = categoryTotalsRaw.map((r) => ({
    categoryId: r.categoryId,
    name: r.categoryId ? (catNameMap.get(r.categoryId) ?? "—") : "Sem categoria",
    totalCents: (r._sum.amountCents ?? 0n).toString(),
  }));

  const topTransactions: TopTransaction[] = topTransactionsRaw.map((t) => ({
    id: t.id,
    description: t.description,
    occurredOn: t.occurredOn.toISOString().slice(0, 10),
    amountCents: t.amountCents.toString(),
    sectionName: t.section.name,
    sectionCountType: t.section.countType,
  }));

  const favoriteTransactions: TopTransaction[] = favorites.map((t) => ({
    id: t.id,
    description: t.description,
    occurredOn: t.occurredOn.toISOString().slice(0, 10),
    amountCents: t.amountCents.toString(),
    sectionName: t.section.name,
    sectionCountType: t.section.countType,
  }));

  return {
    sections,
    sectionTotals,
    monthTotal: monthTotal.toString(),
    topCategories,
    topTransactions,
    favoriteTransactions,
  };
}

// ─── Month Sparkline (last 6 months for KPI trend lines) ──────────

export type SparklinePoint = {
  label: string;
  value: number; // Number for recharts display (cents / 100)
};

export type MonthSparklineResult = {
  totalSparkline: SparklinePoint[];
  incomeSparkline: SparklinePoint[];
  expenseSparkline: SparklinePoint[];
  prevMonthTotal: string | null;
  prevMonthIncome: string | null;
  prevMonthExpense: string | null;
};

export async function getMonthSparklineData(
  accountId: string,
  currentMonthId: string,
): Promise<MonthSparklineResult> {
  const empty: MonthSparklineResult = {
    totalSparkline: [],
    incomeSparkline: [],
    expenseSparkline: [],
    prevMonthTotal: null,
    prevMonthIncome: null,
    prevMonthExpense: null,
  };

  const currentMonth = await prisma.month.findUnique({
    where: { id: currentMonthId },
    select: { year: true, month: true },
  });
  if (!currentMonth) return empty;

  const [sections, recentMonths] = await Promise.all([
    prisma.section.findMany({
      where: { accountId },
      select: { id: true, countType: true },
    }),
    prisma.month.findMany({
      where: {
        accountId,
        OR: [
          { year: { lt: currentMonth.year } },
          { year: currentMonth.year, month: { lte: currentMonth.month } },
        ],
      },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: 6,
      select: { id: true, year: true, month: true },
    }),
  ]);

  const chronological = [...recentMonths].reverse();
  const monthIds = chronological.map((m) => m.id);
  const sectionIds = sections.map((s) => s.id);
  const sectionTotalsMap = await batchSectionTotals(accountId, monthIds, sectionIds);

  const addSections = sections.filter((s) => s.countType === "add");
  const subtractSections = sections.filter((s) => s.countType === "subtract");

  const points = chronological.map((m) => {
    const sectionMap = sectionTotalsMap.get(m.id) ?? new Map<string, bigint>();
    const sectionTotalsRec: Record<string, bigint> = {};
    for (const s of sections) {
      sectionTotalsRec[s.id] = sectionMap.get(s.id) ?? 0n;
    }
    const total = calculateMonthTotal(sections, sectionTotalsRec);
    const income = addSections.reduce((sum, s) => {
      const v = sectionTotalsRec[s.id] ?? 0n;
      return sum + (v < 0n ? -v : v);
    }, 0n);
    const expense = subtractSections.reduce((sum, s) => {
      const v = sectionTotalsRec[s.id] ?? 0n;
      return sum + (v < 0n ? -v : v);
    }, 0n);
    return { label: formatMonthLabel(m.year, m.month), total, income, expense };
  });

  const prev = points.length >= 2 ? points[points.length - 2] : null;

  return {
    totalSparkline: points.map((p) => ({ label: p.label, value: Number(p.total) / 100 })),
    incomeSparkline: points.map((p) => ({ label: p.label, value: Number(p.income) / 100 })),
    expenseSparkline: points.map((p) => ({ label: p.label, value: Number(p.expense) / 100 })),
    prevMonthTotal: prev ? prev.total.toString() : null,
    prevMonthIncome: prev ? prev.income.toString() : null,
    prevMonthExpense: prev ? prev.expense.toString() : null,
  };
}

// ─── Comparison Data (prev year same month + avg 3m) ──────────────

export type ComparisonResult = {
  prevYearSameMonth: { total: string; income: string; expense: string } | null;
  avg3months: { total: string; income: string; expense: string } | null;
};

export async function getComparisonData(
  accountId: string,
  currentMonthId: string,
): Promise<ComparisonResult> {
  const currentMonth = await prisma.month.findUnique({
    where: { id: currentMonthId },
    select: { year: true, month: true },
  });
  if (!currentMonth) return { prevYearSameMonth: null, avg3months: null };

  const sections = await prisma.section.findMany({
    where: { accountId },
    select: { id: true, countType: true },
  });
  const sectionIds = sections.map((s) => s.id);
  const addSections = sections.filter((s) => s.countType === "add");
  const subtractSections = sections.filter((s) => s.countType === "subtract");

  // Find: prev year same month + last 3 months before current
  const [prevYearMonth, last3Months] = await Promise.all([
    prisma.month.findFirst({
      where: { accountId, year: currentMonth.year - 1, month: currentMonth.month },
      select: { id: true },
    }),
    prisma.month.findMany({
      where: {
        accountId,
        OR: [
          { year: { lt: currentMonth.year } },
          { year: currentMonth.year, month: { lt: currentMonth.month } },
        ],
      },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: 3,
      select: { id: true },
    }),
  ]);

  const allIds = [...(prevYearMonth ? [prevYearMonth.id] : []), ...last3Months.map((m) => m.id)];
  if (allIds.length === 0) return { prevYearSameMonth: null, avg3months: null };

  const sectionTotalsMap = await batchSectionTotals(accountId, allIds, sectionIds);

  function computePeriodTotals(monthId: string) {
    const sectionMap = sectionTotalsMap.get(monthId) ?? new Map<string, bigint>();
    const rec: Record<string, bigint> = {};
    for (const s of sections) rec[s.id] = sectionMap.get(s.id) ?? 0n;
    const total = calculateMonthTotal(sections, rec);
    const income = addSections.reduce((sum, s) => {
      const v = rec[s.id] ?? 0n;
      return sum + (v < 0n ? -v : v);
    }, 0n);
    const expense = subtractSections.reduce((sum, s) => {
      const v = rec[s.id] ?? 0n;
      return sum + (v < 0n ? -v : v);
    }, 0n);
    return { total, income, expense };
  }

  const prevYearResult = prevYearMonth ? computePeriodTotals(prevYearMonth.id) : null;

  let avg3monthsResult: { total: string; income: string; expense: string } | null = null;
  if (last3Months.length > 0) {
    let sumTotal = 0n,
      sumIncome = 0n,
      sumExpense = 0n;
    for (const m of last3Months) {
      const t = computePeriodTotals(m.id);
      sumTotal += t.total;
      sumIncome += t.income;
      sumExpense += t.expense;
    }
    const n = BigInt(last3Months.length);
    avg3monthsResult = {
      total: (sumTotal / n).toString(),
      income: (sumIncome / n).toString(),
      expense: (sumExpense / n).toString(),
    };
  }

  return {
    prevYearSameMonth: prevYearResult
      ? {
          total: prevYearResult.total.toString(),
          income: prevYearResult.income.toString(),
          expense: prevYearResult.expense.toString(),
        }
      : null,
    avg3months: avg3monthsResult,
  };
}

// ─── Daily Totals for Calendar Heatmap ────────────────────────────

export type DayTotal = {
  day: number; // 1-31
  absoluteCents: string; // BigInt string
  transactionCount: number;
  transactionIds: string[];
};

export async function getDailyTotals(
  accountId: string,
  monthId: string,
  // null = toda atividade financeira (countInMonth); string[] = apenas as seções informadas
  subtractSectionIds: string[] | null,
): Promise<DayTotal[]> {
  if (Array.isArray(subtractSectionIds) && subtractSectionIds.length === 0) return [];

  const whereSection: object =
    subtractSectionIds === null
      ? {} // sem filtro de seção → todas as transações countInMonth
      : { sectionId: { in: subtractSectionIds } };

  const txs = await prisma.transaction.findMany({
    where: {
      accountId,
      monthId,
      ...whereSection,
      table: { countInMonth: true },
    },
    select: { id: true, occurredOn: true, amountCents: true },
    orderBy: { occurredOn: "asc" },
  });

  const dayMap = new Map<number, { total: bigint; ids: string[] }>();
  for (const tx of txs) {
    const day = tx.occurredOn.getUTCDate();
    const existing = dayMap.get(day) ?? { total: 0n, ids: [] };
    dayMap.set(day, {
      total: existing.total + tx.amountCents,
      ids: [...existing.ids, tx.id],
    });
  }

  return Array.from(dayMap.entries())
    .map(([day, { total, ids }]) => ({
      day,
      absoluteCents: (total < 0n ? -total : total).toString(),
      transactionCount: ids.length,
      transactionIds: ids,
    }))
    .sort((a, b) => a.day - b.day);
}

// ─── Category Treemap ──────────────────────────────────────────────

export type TreemapLeaf = {
  id: string;
  subcategoryId: string | null;
  name: string;
  totalCents: string;
  transactionIds: string[];
};

export type TreemapCategory = {
  categoryId: string;
  name: string;
  totalCents: string;
  children: TreemapLeaf[];
};

export async function getCategoryTreemapData(
  accountId: string,
  monthId: string,
): Promise<TreemapCategory[]> {
  const rows = await prisma.transaction.groupBy({
    by: ["categoryId", "subcategoryId"],
    where: {
      accountId,
      monthId,
      categoryId: { not: null },
      table: { countInMonth: true },
    },
    _sum: { amountCents: true },
    orderBy: { _sum: { amountCents: "desc" } },
  });

  if (rows.length === 0) return [];

  const categoryIds = [...new Set(rows.map((r) => r.categoryId).filter(Boolean) as string[])];
  const subcategoryIds = [...new Set(rows.map((r) => r.subcategoryId).filter(Boolean) as string[])];

  const [categories, subcategories, allTxs] = await Promise.all([
    prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true },
    }),
    subcategoryIds.length > 0
      ? prisma.subcategory.findMany({
          where: { id: { in: subcategoryIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    prisma.transaction.findMany({
      where: { accountId, monthId, categoryId: { not: null }, table: { countInMonth: true } },
      select: { id: true, categoryId: true, subcategoryId: true },
    }),
  ]);

  const catNameMap = new Map(categories.map((c) => [c.id, c.name]));
  const subNameMap = new Map(subcategories.map((s) => [s.id, s.name]));

  const txLeafMap = new Map<string, string[]>();
  const txCatMap = new Map<string, string[]>();
  for (const tx of allTxs) {
    const leafKey = `${tx.categoryId}:${tx.subcategoryId ?? ""}`;
    txLeafMap.set(leafKey, [...(txLeafMap.get(leafKey) ?? []), tx.id]);
    txCatMap.set(tx.categoryId!, [...(txCatMap.get(tx.categoryId!) ?? []), tx.id]);
  }

  const catMap = new Map<string, { total: bigint; children: typeof rows }>();
  for (const row of rows) {
    if (!row.categoryId) continue;
    const existing = catMap.get(row.categoryId) ?? { total: 0n, children: [] };
    const amt = row._sum.amountCents ?? 0n;
    catMap.set(row.categoryId, {
      total: existing.total + (amt < 0n ? -amt : amt),
      children: [...existing.children, row],
    });
  }

  return Array.from(catMap.entries())
    .map(([catId, { total, children }]) => ({
      categoryId: catId,
      name: catNameMap.get(catId) ?? "—",
      totalCents: total.toString(),
      children: children
        .map((c) => {
          const amt = c._sum.amountCents ?? 0n;
          const absAmt = amt < 0n ? -amt : amt;
          const leafKey = `${c.categoryId}:${c.subcategoryId ?? ""}`;
          return {
            id: leafKey,
            subcategoryId: c.subcategoryId,
            name: c.subcategoryId ? (subNameMap.get(c.subcategoryId) ?? "—") : "Sem subcategoria",
            totalCents: absAmt.toString(),
            transactionIds: txLeafMap.get(leafKey) ?? [],
          };
        })
        .sort((a, b) => Number(BigInt(b.totalCents)) - Number(BigInt(a.totalCents))),
    }))
    .sort((a, b) => Number(BigInt(b.totalCents)) - Number(BigInt(a.totalCents)));
}

// ─── Sankey Data ───────────────────────────────────────────────────

export type SankeyNode = { id: string; label: string };
export type SankeyLink = { source: string; target: string; value: number };
export type SankeyData = { nodes: SankeyNode[]; links: SankeyLink[] };

// groupBy controla o nível de gastos do Sankey (Total → categorias OU Total → seções).
// 'category' é o padrão (comportamento original).
export async function getSankeyData(
  accountId: string,
  monthId: string,
  sections: SectionMeta[],
  sectionTotals: Record<string, string>,
  groupBy: "section" | "category" = "category",
): Promise<SankeyData> {
  const abs = (v: bigint) => (v < 0n ? -v : v);

  const addSections = sections.filter((s) => s.countType === "add");
  const subtractSections = sections.filter(
    (s) => s.countType === "subtract" || s.countType === "neutral",
  );

  const incomeTotal = addSections.reduce(
    (sum, s) => sum + abs(BigInt(sectionTotals[s.id] ?? "0")),
    0n,
  );
  if (incomeTotal === 0n) return { nodes: [], links: [] };

  const totalExpense = subtractSections.reduce(
    (sum, s) => sum + abs(BigInt(sectionTotals[s.id] ?? "0")),
    0n,
  );
  const savings = incomeTotal > totalExpense ? incomeTotal - totalExpense : 0n;

  const TOTAL = "__total__";
  const SAVINGS = "__savings__";
  const UNCAT = "__uncat__";

  const activeSources = addSections.filter((s) => abs(BigInt(sectionTotals[s.id] ?? "0")) > 0n);

  const baseNodes: SankeyNode[] = [
    ...activeSources.map((s) => ({ id: s.id, label: s.name })),
    { id: TOTAL, label: "Total Disponível" },
  ];
  const baseLinks: SankeyLink[] = activeSources.map((s) => ({
    source: s.id,
    target: TOTAL,
    value: Number(abs(BigInt(sectionTotals[s.id] ?? "0"))) / 100,
  }));

  // Nível intermediário: gastos por seção ou por categoria.
  let midNodes: SankeyNode[] = [];
  let midLinks: SankeyLink[] = [];

  if (groupBy === "section") {
    const expenseSections = subtractSections.filter(
      (s) => abs(BigInt(sectionTotals[s.id] ?? "0")) > 0n,
    );
    midNodes = expenseSections.map((s) => ({ id: `sec_${s.id}`, label: s.name }));
    midLinks = expenseSections.map((s) => ({
      source: TOTAL,
      target: `sec_${s.id}`,
      value: Number(abs(BigInt(sectionTotals[s.id] ?? "0"))) / 100,
    }));
  } else {
    const subtractIds = subtractSections.map((s) => s.id);
    const categoryRows =
      subtractIds.length > 0
        ? await prisma.transaction.groupBy({
            by: ["categoryId"],
            where: {
              accountId,
              monthId,
              sectionId: { in: subtractIds },
              table: { countInMonth: true },
            },
            _sum: { amountCents: true },
            orderBy: { _sum: { amountCents: "desc" } },
            take: 8,
          })
        : [];

    const categoryIds = categoryRows.map((r) => r.categoryId).filter(Boolean) as string[];
    const cats =
      categoryIds.length > 0
        ? await prisma.category.findMany({
            where: { id: { in: categoryIds } },
            select: { id: true, name: true },
          })
        : [];
    const catNameMap = new Map(cats.map((c) => [c.id, c.name]));

    const categorizedExpense = categoryRows.reduce(
      (sum, r) => sum + abs(r._sum.amountCents ?? 0n),
      0n,
    );
    const uncategorized =
      totalExpense > categorizedExpense ? totalExpense - categorizedExpense : 0n;

    const named = categoryRows.filter((r) => r.categoryId && (r._sum.amountCents ?? 0n) !== 0n);
    midNodes = [
      ...named.map((r) => ({
        id: `cat_${r.categoryId}`,
        label: catNameMap.get(r.categoryId!) ?? "—",
      })),
      ...(uncategorized > 0n ? [{ id: UNCAT, label: "Outros gastos" }] : []),
    ];
    midLinks = [
      ...named.map((r) => ({
        source: TOTAL,
        target: `cat_${r.categoryId}`,
        value: Number(abs(r._sum.amountCents ?? 0n)) / 100,
      })),
      ...(uncategorized > 0n
        ? [{ source: TOTAL, target: UNCAT, value: Number(uncategorized) / 100 }]
        : []),
    ];
  }

  const nodes: SankeyNode[] = [
    ...baseNodes,
    ...midNodes,
    ...(savings > 0n ? [{ id: SAVINGS, label: "Sobra / Poupança" }] : []),
  ];
  const links: SankeyLink[] = [
    ...baseLinks,
    ...midLinks,
    ...(savings > 0n ? [{ source: TOTAL, target: SAVINGS, value: Number(savings) / 100 }] : []),
  ];

  return { nodes, links };
}

// ─── DrillDown Transactions ────────────────────────────────────────

export type DrillDownTransaction = {
  id: string;
  description: string | null;
  occurredOn: string;
  amountCents: string;
  isPending: boolean;
  isFavorite: boolean;
  sectionName: string;
  categoryName: string | null;
};

export async function getTransactionsByIds(
  accountId: string,
  ids: string[],
): Promise<DrillDownTransaction[]> {
  if (ids.length === 0) return [];
  const txs = await prisma.transaction.findMany({
    where: { accountId, id: { in: ids } },
    select: {
      id: true,
      description: true,
      occurredOn: true,
      amountCents: true,
      isPending: true,
      isFavorite: true,
      section: { select: { name: true } },
      category: { select: { name: true } },
    },
    orderBy: { occurredOn: "desc" },
  });
  return txs.map((t) => ({
    id: t.id,
    description: t.description,
    occurredOn: t.occurredOn.toISOString().slice(0, 10),
    amountCents: t.amountCents.toString(),
    isPending: t.isPending,
    isFavorite: t.isFavorite,
    sectionName: t.section.name,
    categoryName: t.category?.name ?? null,
  }));
}

// ─── Yearly Deep Dive ──────────────────────────────────────────────

export async function getYearDeepDive(accountId: string, year: number) {
  const [sections, months] = await Promise.all([
    prisma.section.findMany({
      where: { accountId },
      orderBy: { order: "asc" },
      select: { id: true, name: true, countType: true },
    }),
    prisma.month.findMany({
      where: { accountId, year },
      orderBy: { month: "asc" },
      select: { id: true, year: true, month: true },
    }),
  ]);

  const monthIds = months.map((m) => m.id);
  const sectionIds = sections.map((s) => s.id);

  const [sectionTotalsMap, topCategoriesRaw, topInstitutionsRaw, allYearsRaw] = await Promise.all([
    batchSectionTotals(accountId, monthIds, sectionIds),
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: {
        accountId,
        monthId: { in: monthIds },
        categoryId: { not: null },
        table: { countInMonth: true },
      },
      _sum: { amountCents: true },
      orderBy: { _sum: { amountCents: "desc" } },
      take: 20, // fetch 20 para permitir slicing pelo config top-categories
    }),
    prisma.transaction.groupBy({
      by: ["institutionId"],
      where: {
        accountId,
        monthId: { in: monthIds },
        institutionId: { not: null },
        table: { countInMonth: true },
      },
      _sum: { amountCents: true },
      orderBy: { _sum: { amountCents: "desc" } },
      take: 10,
    }),
    prisma.month.findMany({
      where: { accountId },
      select: { year: true },
      distinct: ["year"],
      orderBy: { year: "desc" },
    }),
  ]);

  // Resolve names
  const categoryIds = topCategoriesRaw.map((r) => r.categoryId).filter(Boolean) as string[];
  const institutionIds = topInstitutionsRaw.map((r) => r.institutionId).filter(Boolean) as string[];
  const [catNames, instNames] = await Promise.all([
    prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true },
    }),
    prisma.institution.findMany({
      where: { id: { in: institutionIds } },
      select: { id: true, name: true },
    }),
  ]);
  const catNameMap = new Map(catNames.map((c) => [c.id, c.name]));
  const instNameMap = new Map(instNames.map((i) => [i.id, i.name]));

  const topCategories: CategorySum[] = topCategoriesRaw.map((r) => ({
    categoryId: r.categoryId,
    name: r.categoryId ? (catNameMap.get(r.categoryId) ?? "—") : "Sem categoria",
    totalCents: (r._sum.amountCents ?? 0n).toString(),
  }));

  const topInstitutions: InstitutionSum[] = topInstitutionsRaw.map((r) => ({
    institutionId: r.institutionId,
    name: r.institutionId ? (instNameMap.get(r.institutionId) ?? "—") : "Sem instituição",
    totalCents: (r._sum.amountCents ?? 0n).toString(),
  }));

  // Build month summaries
  const monthSummaries: MonthSummary[] = months.map((m) => {
    const sectionMap = sectionTotalsMap.get(m.id) ?? new Map<string, bigint>();
    const sectionTotals: Record<string, string> = {};
    for (const s of sections) {
      sectionTotals[s.id] = (sectionMap.get(s.id) ?? 0n).toString();
    }
    const total = calculateMonthTotal(
      sections,
      Object.fromEntries(Object.entries(sectionTotals).map(([k, v]) => [k, BigInt(v)])),
    );
    return {
      id: m.id,
      year: m.year,
      month: m.month,
      label: formatMonthLabel(m.year, m.month),
      sectionTotals,
      total: total.toString(),
    };
  });

  const allYears = [...new Set(allYearsRaw.map((m) => m.year))].sort((a, b) => b - a);

  return { sections, monthSummaries, topCategories, topInstitutions, allYears };
}
