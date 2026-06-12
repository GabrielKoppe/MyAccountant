import { cache } from "react";

import { prisma } from "@/server/prisma";
import { formatMonthLabel } from "@/lib/dates";
import { m } from "@/lib/messages";

// ─── Tipos ─────────────────────────────────────────────────────────
// Todos os cents serializados como string (BigInt seguro na fronteira RSC→Client).

export type MemberBreakdownRow = {
  userId: string | null; // null = "Sem responsável"
  name: string; // base, sem sufixo; resolvido via AccountMember/User; fallback email
  isFormerMember: boolean; // true = User existe mas não é AccountMember atual
  totalCents: string;
  sharePercent: number; // 1 casa decimal
  topCategoryName: string | null; // null quando membro sem despesa (→ "—" na UI)
};

export type MemberTrendPoint = { monthLabel: string; totalCents: string };

export type MemberTrendSeries = {
  seriesId: string; // userId | "unassigned" | "others"
  name: string; // base, sem sufixo
  isFormerMember: boolean;
  points: MemberTrendPoint[]; // um ponto por mês com despesa; ausência = "0"
};

const UNASSIGNED_KEY = "__unassigned__";
const TOP_N = 5;

// ─── Base de despesa (idêntica ao resto do app: spec 11 §7.2) ──────
// Seções subtract, amountCents > 0, table.countInMonth = true.
function expenseWhere(accountId: string, monthFilter: object) {
  return {
    accountId, // ✅ multi-tenancy
    ...monthFilter,
    amountCents: { gt: 0n },
    section: { countType: "subtract" as const },
    table: { countInMonth: true },
  };
}

function sharePercent(part: bigint, total: bigint): number {
  if (total <= 0n) return 0;
  return Math.round((Number(part) / Number(total)) * 1000) / 10;
}

// ─── Resolução de identidade do responsável ────────────────────────
// Para um conjunto de userIds (não-nulos), resolve nome de exibição e se é ex-membro.
// Membros atuais → nome via AccountMember/User. Demais (User existe mas saiu) → "(ex-membro)".
// Uma query em account_members + uma em users (sem N+1).
type Identity = { name: string; isFormerMember: boolean };

async function resolveResponsibleIdentities(
  accountId: string,
  userIds: string[],
): Promise<Map<string, Identity>> {
  const map = new Map<string, Identity>();
  if (userIds.length === 0) return map;

  const members = await prisma.accountMember.findMany({
    where: { accountId, userId: { in: userIds } },
    select: { userId: true, user: { select: { name: true, email: true } } },
  });
  for (const mem of members) {
    map.set(mem.userId, {
      name: mem.user.name ?? mem.user.email,
      isFormerMember: false,
    });
  }

  const formerIds = userIds.filter((id) => !map.has(id));
  if (formerIds.length > 0) {
    const formerUsers = await prisma.user.findMany({
      where: { id: { in: formerIds } },
      select: { id: true, name: true, email: true },
    });
    for (const u of formerUsers) {
      map.set(u.id, { name: u.name ?? u.email, isFormerMember: true });
    }
  }

  return map;
}

// ─── Breakdown mensal (MBR-01, MBR-02, MBR-04, MBR-05) ─────────────

export const getMemberMonthlyBreakdown = cache(
  async (accountId: string, monthId: string): Promise<MemberBreakdownRow[]> => {
    const where = expenseWhere(accountId, { monthId });

    // 1ª query: soma por responsável (inclui null como grupo).
    // 2ª query: soma por (responsável, categoria) → categoria-top por responsável.
    // 3ª query: todos os membros atuais da Account (para zerados no ranking).
    const [byMember, byMemberCategory, allMembers] = await Promise.all([
      prisma.transaction.groupBy({
        by: ["responsibleUserId"],
        where,
        _sum: { amountCents: true },
      }),
      prisma.transaction.groupBy({
        by: ["responsibleUserId", "categoryId"],
        where,
        _sum: { amountCents: true },
      }),
      prisma.accountMember.findMany({
        where: { accountId },
        select: { userId: true, user: { select: { name: true, email: true } } },
      }),
    ]);

    // Categoria-top por responsável (chave: userId ?? UNASSIGNED_KEY).
    const topCatByResp = new Map<string, { categoryId: string | null; sum: bigint }>();
    for (const row of byMemberCategory) {
      const key = row.responsibleUserId ?? UNASSIGNED_KEY;
      const sum = row._sum.amountCents ?? 0n;
      const current = topCatByResp.get(key);
      if (!current || sum > current.sum) {
        topCatByResp.set(key, { categoryId: row.categoryId, sum });
      }
    }

    // Resolver nomes de categorias-top (1 query).
    const topCatIds = [
      ...new Set([...topCatByResp.values()].map((v) => v.categoryId).filter(Boolean) as string[]),
    ];
    const catNames =
      topCatIds.length > 0
        ? await prisma.category.findMany({
            where: { id: { in: topCatIds } },
            select: { id: true, name: true },
          })
        : [];
    const catNameMap = new Map(catNames.map((c) => [c.id, c.name]));

    // Identidades: membros atuais já vêm em `allMembers`; ex-membros (despesa com
    // responsável que saiu da Account) são resolvidos via User em uma única query.
    const spenderIds = byMember
      .map((g) => g.responsibleUserId)
      .filter((id): id is string => id !== null);
    const memberNameMap = new Map(
      allMembers.map((mem) => [mem.userId, mem.user.name ?? mem.user.email]),
    );
    const formerIds = spenderIds.filter((id) => !memberNameMap.has(id));
    const formerUsers =
      formerIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: formerIds } },
            select: { id: true, name: true, email: true },
          })
        : [];
    const formerNameMap = new Map(formerUsers.map((u) => [u.id, u.name ?? u.email]));

    function identityFor(userId: string): Identity {
      const memberName = memberNameMap.get(userId);
      if (memberName !== undefined) return { name: memberName, isFormerMember: false };
      const formerName = formerNameMap.get(userId);
      if (formerName !== undefined) return { name: formerName, isFormerMember: true };
      return { name: m.dashboards.members.unassigned, isFormerMember: false };
    }

    const grandTotal = byMember.reduce((sum, g) => sum + (g._sum.amountCents ?? 0n), 0n);

    function topCategoryName(key: string): string | null {
      const top = topCatByResp.get(key);
      if (!top) return null;
      if (top.categoryId === null) return m.dashboards.members.uncategorized;
      return catNameMap.get(top.categoryId) ?? m.dashboards.members.uncategorized;
    }

    // Linhas com despesa (responsável real, ex-membro ou "Sem responsável").
    const spendRows: MemberBreakdownRow[] = byMember.map((g) => {
      const total = g._sum.amountCents ?? 0n;
      if (g.responsibleUserId === null) {
        return {
          userId: null,
          name: m.dashboards.members.unassigned,
          isFormerMember: false,
          totalCents: total.toString(),
          sharePercent: sharePercent(total, grandTotal),
          topCategoryName: topCategoryName(UNASSIGNED_KEY),
        };
      }
      const identity = identityFor(g.responsibleUserId);
      return {
        userId: g.responsibleUserId,
        name: identity.name,
        isFormerMember: identity.isFormerMember,
        totalCents: total.toString(),
        sharePercent: sharePercent(total, grandTotal),
        topCategoryName: topCategoryName(g.responsibleUserId),
      };
    });

    spendRows.sort((a, b) => Number(BigInt(b.totalCents) - BigInt(a.totalCents)));

    // Membros atuais sem despesa no mês → ao final, zerados.
    const spenderIdSet = new Set(spenderIds);
    const zeroRows: MemberBreakdownRow[] = allMembers
      .filter((mem) => !spenderIdSet.has(mem.userId))
      .map((mem) => ({
        userId: mem.userId,
        name: mem.user.name ?? mem.user.email,
        isFormerMember: false,
        totalCents: "0",
        sharePercent: 0,
        topCategoryName: null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

    return [...spendRows, ...zeroRows];
  },
);

// ─── Tendência anual (MBR-03, MBR-04, MBR-05) ──────────────────────

export const getMemberYearlyTrend = cache(
  async (accountId: string, year: number): Promise<MemberTrendSeries[]> => {
    const months = await prisma.month.findMany({
      where: { accountId, year },
      orderBy: { month: "asc" },
      select: { id: true, year: true, month: true },
    });
    if (months.length === 0) return [];

    const monthIds = months.map((mo) => mo.id);
    const rows = await prisma.transaction.groupBy({
      by: ["responsibleUserId", "monthId"],
      where: expenseWhere(accountId, { monthId: { in: monthIds } }),
      _sum: { amountCents: true },
    });
    if (rows.length === 0) return [];

    // Eixo X = meses do ano que têm despesa (ordem cronológica).
    const monthIdsWithExpense = new Set(rows.map((r) => r.monthId));
    const axisMonths = months.filter((mo) => monthIdsWithExpense.has(mo.id));
    if (axisMonths.length === 0) return [];

    // byResp[key][monthId] = total. Total anual por responsável.
    const byRespMonth = new Map<string, Map<string, bigint>>();
    const yearTotalByResp = new Map<string, bigint>();
    for (const r of rows) {
      const key = r.responsibleUserId ?? UNASSIGNED_KEY;
      const sum = r._sum.amountCents ?? 0n;
      if (!byRespMonth.has(key)) byRespMonth.set(key, new Map());
      byRespMonth.get(key)!.set(r.monthId, sum);
      yearTotalByResp.set(key, (yearTotalByResp.get(key) ?? 0n) + sum);
    }

    // Ordenar por total anual desc; top-5 viram séries, o resto vira "Outros".
    const rankedKeys = [...yearTotalByResp.entries()]
      .sort((a, b) => Number(b[1] - a[1]))
      .map(([key]) => key);
    const topKeys = rankedKeys.slice(0, TOP_N);
    const otherKeys = rankedKeys.slice(TOP_N);

    // Resolver identidades dos top que são userIds reais.
    const topRealUserIds = topKeys.filter((k) => k !== UNASSIGNED_KEY);
    const identities = await resolveResponsibleIdentities(accountId, topRealUserIds);

    const pointsFor = (perMonth: Map<string, bigint>): MemberTrendPoint[] =>
      axisMonths.map((mo) => ({
        monthLabel: formatMonthLabel(mo.year, mo.month),
        totalCents: (perMonth.get(mo.id) ?? 0n).toString(),
      }));

    const series: MemberTrendSeries[] = topKeys.map((key) => {
      const perMonth = byRespMonth.get(key) ?? new Map<string, bigint>();
      if (key === UNASSIGNED_KEY) {
        return {
          seriesId: "unassigned",
          name: m.dashboards.members.unassigned,
          isFormerMember: false,
          points: pointsFor(perMonth),
        };
      }
      const identity = identities.get(key) ?? {
        name: m.dashboards.members.unassigned,
        isFormerMember: false,
      };
      return {
        seriesId: key,
        name: identity.name,
        isFormerMember: identity.isFormerMember,
        points: pointsFor(perMonth),
      };
    });

    // Linha "Outros" = soma das séries fora do top-5, por mês.
    if (otherKeys.length > 0) {
      const othersPerMonth = new Map<string, bigint>();
      for (const key of otherKeys) {
        const perMonth = byRespMonth.get(key);
        if (!perMonth) continue;
        for (const [mid, sum] of perMonth) {
          othersPerMonth.set(mid, (othersPerMonth.get(mid) ?? 0n) + sum);
        }
      }
      series.push({
        seriesId: "others",
        name: m.dashboards.members.others,
        isFormerMember: false,
        points: pointsFor(othersPerMonth),
      });
    }

    return series;
  },
);
