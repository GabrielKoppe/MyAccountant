import type { Prisma, SectionCountType } from "@prisma/client";

import { prisma } from "@/server/prisma";
import { formatMonthLabel } from "@/lib/dates";
import type { SandboxConfig, SandboxMetric } from "@/lib/schemas/sandbox";

// ─── Public types ──────────────────────────────────────────────────────────

export type SandboxSeries = {
  key: string;
  label: string;
};

export type SandboxRow = {
  xKey: string;
  xLabel: string;
  [seriesKey: string]: string | number;
};

export type SandboxResult = {
  series: SandboxSeries[];
  rows: SandboxRow[];
  grandTotalCents: bigint;
};

// ─── Internal helpers ──────────────────────────────────────────────────────

type RawGroupRow = {
  monthId?: string | null;
  sectionId?: string | null;
  categoryId?: string | null;
  responsibleUserId?: string | null;
  institutionId?: string | null;
  tableId?: string | null;
  _sum: { amountCents: bigint | null };
  _count: { _all: number };
};

function applyMetric(
  cents: bigint,
  count: number,
  countType: SectionCountType | undefined,
  metric: SandboxMetric,
): number {
  switch (metric) {
    case "count":
      return count;
    case "income":
    case "expense": {
      const abs = cents < 0n ? -cents : cents;
      return Number(abs) / 100;
    }
    case "avg": {
      if (count === 0) return 0;
      const total = applyCountTypeSign(cents, countType ?? "neutral");
      return Number(total) / (100 * count);
    }
    default: {
      const signed = applyCountTypeSign(cents, countType ?? "neutral");
      return Number(signed) / 100;
    }
  }
}

function applyCountTypeSign(cents: bigint, countType: SectionCountType): bigint {
  switch (countType) {
    case "subtract":
      return cents < 0n ? cents : -cents;
    case "ignore":
      return 0n;
    default:
      return cents;
  }
}

async function resolveMonthIds(
  accountId: string,
  config: SandboxConfig,
  currentMonthId?: string,
): Promise<string[]> {
  if (config.periodType === "current_month") return currentMonthId ? [currentMonthId] : [];
  if (config.periodType === "months") return config.monthIds ?? [];
  if (config.periodType === "year" && config.year != null) {
    const months = await prisma.month.findMany({
      where: { accountId, year: config.year },
      select: { id: true },
    });
    return months.map((m) => m.id);
  }
  if (config.periodType === "last_3_months" || config.periodType === "last_6_months") {
    const take = config.periodType === "last_3_months" ? 3 : 6;
    const months = await prisma.month.findMany({
      where: { accountId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take,
      select: { id: true },
    });
    return months.map((m) => m.id);
  }
  return [];
}

// ─── Main query ───────────────────────────────────────────────────────────

export async function getSandboxData(
  accountId: string,
  config: SandboxConfig,
  context?: { currentMonthId?: string },
): Promise<SandboxResult> {
  const monthIds = await resolveMonthIds(accountId, config, context?.currentMonthId);
  if (monthIds.length === 0) return { series: [], rows: [], grandTotalCents: 0n };

  const needsInstitution = config.groupBy === "institution" || config.seriesBy === "institution";
  const needsTableType = config.groupBy === "table_type" || config.seriesBy === "table_type";

  const [sections, categories, members, months, institutionsRaw, financeTablesRaw] =
    await Promise.all([
      prisma.section.findMany({
        where: { accountId },
        select: { id: true, name: true, countType: true, order: true },
        orderBy: { order: "asc" },
      }),
      prisma.category.findMany({
        where: { accountId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.accountMember.findMany({
        where: { accountId },
        select: { userId: true, user: { select: { name: true, email: true } } },
      }),
      prisma.month.findMany({
        where: { accountId, id: { in: monthIds } },
        select: { id: true, year: true, month: true },
        orderBy: [{ year: "asc" }, { month: "asc" }],
      }),
      needsInstitution
        ? prisma.institution.findMany({
            where: { accountId },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          })
        : Promise.resolve([]),
      needsTableType
        ? prisma.financeTable.findMany({
            where: { accountId, monthId: { in: monthIds } },
            select: {
              id: true,
              tableTypeId: true,
              tableType: { select: { id: true, name: true } },
            },
          })
        : Promise.resolve([]),
    ]);

  // Lookup maps
  const sectionMap = new Map(sections.map((s) => [s.id, s]));
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
  const memberMap = new Map(
    members.map((m) => [m.userId, m.user.name ?? m.user.email ?? "Membro"]),
  );
  const monthMap = new Map(months.map((m) => [m.id, m]));
  const institutionMap = new Map(institutionsRaw.map((i) => [i.id, i.name]));

  // tableId → { typeId, typeName }
  type TypeEntry = { typeId: string; typeName: string };
  const tableIdToType = new Map<string, TypeEntry>();
  const typeIdToName = new Map<string, string>();
  for (const ft of financeTablesRaw) {
    const entry: TypeEntry = {
      typeId: ft.tableTypeId ?? "sem-tipo",
      typeName: ft.tableType?.name ?? "Manual",
    };
    tableIdToType.set(ft.id, entry);
    typeIdToName.set(entry.typeId, entry.typeName);
  }

  // Section filter based on metric
  let sectionIdFilter: string[];
  if (config.metric === "income") {
    sectionIdFilter = sections.filter((s) => s.countType === "add").map((s) => s.id);
  } else if (config.metric === "expense") {
    sectionIdFilter = sections.filter((s) => s.countType === "subtract").map((s) => s.id);
  } else {
    sectionIdFilter = sections.filter((s) => s.countType !== "ignore").map((s) => s.id);
  }
  if (config.filterSectionIds?.length) {
    sectionIdFilter = sectionIdFilter.filter((id) => config.filterSectionIds!.includes(id));
  }

  // Build groupBy fields for Prisma
  const bySet = new Set<string>();
  if (config.groupBy === "month") bySet.add("monthId");
  else if (config.groupBy === "section") bySet.add("sectionId");
  else if (config.groupBy === "category") bySet.add("categoryId");
  else if (config.groupBy === "institution") bySet.add("institutionId");
  else if (config.groupBy === "table_type") bySet.add("tableId");

  if (config.seriesBy === "section") bySet.add("sectionId");
  else if (config.seriesBy === "category") bySet.add("categoryId");
  else if (config.seriesBy === "member") bySet.add("responsibleUserId");
  else if (config.seriesBy === "institution") bySet.add("institutionId");
  else if (config.seriesBy === "table_type") bySet.add("tableId");

  // Always include sectionId when metric needs countType (total/avg)
  // so we can correctly apply the subtract sign per section
  if ((config.metric === "total" || config.metric === "avg") && !bySet.has("sectionId")) {
    bySet.add("sectionId");
  }

  const byFields = [...bySet] as Prisma.TransactionScalarFieldEnum[];

  const where: Prisma.TransactionWhereInput = {
    accountId,
    monthId: { in: monthIds },
    table: { countInMonth: true },
    sectionId: { in: sectionIdFilter },
    ...(config.filterCategoryIds?.length ? { categoryId: { in: config.filterCategoryIds } } : {}),
    ...(config.filterMemberIds?.length
      ? { responsibleUserId: { in: config.filterMemberIds } }
      : {}),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawRows = (await (prisma.transaction.groupBy as any)({
    by: byFields,
    where,
    _sum: { amountCents: true },
    _count: { _all: true },
  })) as RawGroupRow[];

  if (rawRows.length === 0) return { series: [], rows: [], grandTotalCents: 0n };

  // Key helpers — map a raw row to its X-axis key and series key
  const getXKey = (row: RawGroupRow): string => {
    switch (config.groupBy) {
      case "month":
        return row.monthId ?? "unknown";
      case "section":
        return row.sectionId ?? "unknown";
      case "category":
        return row.categoryId ?? "sem-categoria";
      case "institution":
        return row.institutionId ?? "sem-instituicao";
      case "table_type":
        return tableIdToType.get(row.tableId ?? "")?.typeId ?? "sem-tipo";
    }
  };

  const getSeriesKey = (row: RawGroupRow): string => {
    switch (config.seriesBy) {
      case "section":
        return row.sectionId ?? "unknown";
      case "category":
        return row.categoryId ?? "sem-categoria";
      case "member":
        return row.responsibleUserId ?? "nao-atribuido";
      case "institution":
        return row.institutionId ?? "sem-instituicao";
      case "table_type":
        return tableIdToType.get(row.tableId ?? "")?.typeId ?? "sem-tipo";
      default:
        return "total";
    }
  };

  // Pass 1: collect unique keys
  const xKeyOrder: string[] = [];
  const xKeySet = new Set<string>();
  const seriesKeyOrder: string[] = [];
  const seriesKeySet = new Set<string>();

  for (const row of rawRows) {
    const xKey = getXKey(row);
    const sKey = getSeriesKey(row);
    if (!xKeySet.has(xKey)) {
      xKeySet.add(xKey);
      xKeyOrder.push(xKey);
    }
    if (!seriesKeySet.has(sKey)) {
      seriesKeySet.add(sKey);
      seriesKeyOrder.push(sKey);
    }
  }

  // Sort xKeys
  if (config.groupBy === "month") {
    xKeyOrder.sort((a, b) => {
      const ma = monthMap.get(a);
      const mb = monthMap.get(b);
      if (!ma || !mb) return 0;
      return ma.year !== mb.year ? ma.year - mb.year : ma.month - mb.month;
    });
  } else if (config.groupBy === "section") {
    xKeyOrder.sort((a, b) => (sectionMap.get(a)?.order ?? 0) - (sectionMap.get(b)?.order ?? 0));
  }
  // category / institution / table_type — sorted by total descending after pivot (see below)

  // Build series list
  const series: SandboxSeries[] =
    config.seriesBy === "none"
      ? [{ key: "total", label: "Total" }]
      : seriesKeyOrder.map((key) => {
          let label = key;
          switch (config.seriesBy) {
            case "section":
              label = sectionMap.get(key)?.name ?? "(removida)";
              break;
            case "category":
              label = key === "sem-categoria" ? "Sem categoria" : (categoryMap.get(key) ?? key);
              break;
            case "member":
              label = key === "nao-atribuido" ? "Não atribuído" : (memberMap.get(key) ?? "Membro");
              break;
            case "institution":
              label =
                key === "sem-instituicao" ? "Sem instituição" : (institutionMap.get(key) ?? key);
              break;
            case "table_type":
              label = key === "sem-tipo" ? "Manual" : (typeIdToName.get(key) ?? key);
              break;
          }
          return { key, label };
        });

  // Build pivot map
  const seriesKeys = series.map((s) => s.key);
  const pivot = new Map<string, Record<string, number>>();
  for (const xKey of xKeyOrder) {
    const obj: Record<string, number> = {};
    for (const sKey of seriesKeys) obj[sKey] = 0;
    pivot.set(xKey, obj);
  }

  // Pass 2: fill pivot with values
  let grandTotalCents = 0n;
  for (const row of rawRows) {
    const xKey = getXKey(row);
    const sKey = getSeriesKey(row);
    const cents = row._sum.amountCents ?? 0n;
    const count = row._count._all;
    // sectionId is always available for total/avg (we added it to bySet)
    const sectionId = row.sectionId ?? (config.groupBy === "section" ? xKey : undefined);
    const section = sectionId ? sectionMap.get(sectionId) : undefined;
    const value = applyMetric(cents, count, section?.countType, config.metric);

    const cell = pivot.get(xKey);
    if (cell && sKey in cell) cell[sKey] += value;

    if (config.metric === "total") {
      grandTotalCents += applyCountTypeSign(cents, section?.countType ?? "neutral");
    }
  }

  // Build rows
  const rows: SandboxRow[] = xKeyOrder.map((xKey) => {
    let xLabel = xKey;
    switch (config.groupBy) {
      case "month": {
        const m = monthMap.get(xKey);
        xLabel = m ? formatMonthLabel(m.year, m.month) : xKey;
        break;
      }
      case "section":
        xLabel = sectionMap.get(xKey)?.name ?? "(removida)";
        break;
      case "category":
        xLabel = xKey === "sem-categoria" ? "Sem categoria" : (categoryMap.get(xKey) ?? xKey);
        break;
      case "institution":
        xLabel =
          xKey === "sem-instituicao" ? "Sem instituição" : (institutionMap.get(xKey) ?? xKey);
        break;
      case "table_type":
        xLabel = xKey === "sem-tipo" ? "Manual" : (typeIdToName.get(xKey) ?? xKey);
        break;
    }
    return { xKey, xLabel, ...(pivot.get(xKey) ?? {}) };
  });

  // Sort by total descending for category/institution/table_type
  if (
    config.groupBy === "category" ||
    config.groupBy === "institution" ||
    config.groupBy === "table_type"
  ) {
    rows.sort((a, b) => {
      const aAbs = seriesKeys.reduce((s, k) => s + Math.abs((a[k] as number) ?? 0), 0);
      const bAbs = seriesKeys.reduce((s, k) => s + Math.abs((b[k] as number) ?? 0), 0);
      return bAbs - aAbs;
    });
  }

  return { series, rows, grandTotalCents };
}
