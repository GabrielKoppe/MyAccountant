import { cache } from "react";

import type { TransactionExpenseType } from "@prisma/client";
import { prisma } from "@/server/prisma";
import { formatMonthLabel } from "@/lib/dates";
import { m } from "@/lib/messages";

// ─── Tipos ─────────────────────────────────────────────────────────
// Todos os cents serializados como string (BigInt seguro na fronteira RSC→Client).

export type MemberCategoryBreakdown = {
  name: string;
  cents: string; // serializado como string (BigInt seguro)
  sharePercent: number; // percentual sobre o total deste membro (1 casa decimal)
};

export type MemberBreakdownRow = {
  partyId: string | null; // null = "Sem responsável"
  name: string; // base, sem sufixo; resolvido via ResponsibleParty (2.4)
  isFormerMember: boolean; // true = party personal cujo membro saiu da Account
  icon: string | null; // emoji da party, quando houver
  totalCents: string;
  sharePercent: number; // 1 casa decimal
  topCategoryName: string | null; // null quando membro sem despesa (→ "—" na UI)
  categories: MemberCategoryBreakdown[]; // todas as categorias deste membro, desc
};

export type MemberTrendPoint = { monthLabel: string; totalCents: string };

export type MemberTrendSeries = {
  seriesId: string; // partyId | "unassigned" | "others"
  name: string; // base, sem sufixo
  isFormerMember: boolean;
  icon: string | null;
  points: MemberTrendPoint[]; // um ponto por mês com despesa; ausência = "0"
};

const UNASSIGNED_KEY = "__unassigned__";
const TOP_N = 5;

// ─── Base de despesa (idêntica ao resto do app: spec 11 §7.2) ──────
// Seções subtract, amountCents > 0, table.countInMonth = true.
function expenseWhere(
  accountId: string,
  monthFilter: object,
  expenseType?: TransactionExpenseType,
) {
  return {
    accountId, // ✅ multi-tenancy
    ...monthFilter,
    amountCents: { gt: 0n },
    section: { countType: "subtract" as const },
    table: { countInMonth: true },
    ...(expenseType ? { expenseType } : {}),
  };
}

function sharePercent(part: bigint, total: bigint): number {
  if (total <= 0n) return 0;
  return Math.round((Number(part) / Number(total)) * 1000) / 10;
}

// ─── Resolução de identidade da party responsável (Spec 60 §2.4) ────
// Precedência de nome:
//  1. personal + membro atual → nome AO VIVO via User (reflete renomes).
//  2. external/group → party.name (snapshot).
//  3. personal + membro que saiu → party.name (snapshot) + isFormerMember.
// A party carrega o próprio nome e sobrevive à remoção do User (sem N+1 em users).
export type PartyIdentity = { name: string; isFormerMember: boolean; icon: string | null };

type ActiveParty = { id: string; name: string; icon: string | null };

// Carrega as parties referenciadas + as parties ativas (para o ranking de zerados) em
// UMA query, mais a lista de membros atuais para a precedência de nome ao vivo.
// `spenderPartyIds` = parties com despesa (podem estar arquivadas mas devem resolver nome).
async function loadParties(
  accountId: string,
  spenderPartyIds: string[],
): Promise<{ identities: Map<string, PartyIdentity>; activeParties: ActiveParty[] }> {
  const [parties, currentMembers] = await Promise.all([
    prisma.responsibleParty.findMany({
      where: {
        accountId,
        OR: [{ archivedAt: null }, { id: { in: spenderPartyIds } }],
      },
      select: {
        id: true,
        name: true,
        kind: true,
        icon: true,
        archivedAt: true,
        members: { select: { userId: true, user: { select: { name: true, email: true } } } },
      },
    }),
    prisma.accountMember.findMany({ where: { accountId }, select: { userId: true } }),
  ]);

  const currentIds = new Set(currentMembers.map((mm) => mm.userId));
  const identities = new Map<string, PartyIdentity>();
  const activeParties: ActiveParty[] = [];

  for (const party of parties) {
    if (party.kind === "personal" && party.members.length === 1) {
      const link = party.members[0];
      if (currentIds.has(link.userId)) {
        identities.set(party.id, {
          name: link.user.name ?? link.user.email,
          isFormerMember: false,
          icon: party.icon,
        });
      } else {
        identities.set(party.id, { name: party.name, isFormerMember: true, icon: party.icon });
      }
    } else {
      identities.set(party.id, { name: party.name, isFormerMember: false, icon: party.icon });
    }
    if (party.archivedAt === null) {
      activeParties.push({ id: party.id, name: party.name, icon: party.icon });
    }
  }

  return { identities, activeParties };
}

// ─── Breakdown mensal (MBR-01, MBR-02, MBR-04, MBR-05) ─────────────
// Spec 41 Fase 14: aceita filtro opcional por expenseType.
// Spec 60: agrega por responsiblePartyId; group = uma linha (sem fan-out).

export const getMemberMonthlyBreakdown = cache(
  async (
    accountId: string,
    monthId: string,
    filterExpenseType?: TransactionExpenseType,
  ): Promise<MemberBreakdownRow[]> => {
    const where = expenseWhere(accountId, { monthId }, filterExpenseType);

    const [byParty, byPartyCategory] = await Promise.all([
      prisma.transaction.groupBy({
        by: ["responsiblePartyId"],
        where,
        _sum: { amountCents: true },
      }),
      prisma.transaction.groupBy({
        by: ["responsiblePartyId", "categoryId"],
        where,
        _sum: { amountCents: true },
      }),
    ]);

    // Categoria-top por party (chave: partyId ?? UNASSIGNED_KEY).
    const topCatByResp = new Map<string, { categoryId: string | null; sum: bigint }>();
    for (const row of byPartyCategory) {
      const key = row.responsiblePartyId ?? UNASSIGNED_KEY;
      const sum = row._sum.amountCents ?? 0n;
      const current = topCatByResp.get(key);
      if (!current || sum > current.sum) {
        topCatByResp.set(key, { categoryId: row.categoryId, sum });
      }
    }

    // Resolver nomes de TODAS as categorias presentes (1 query).
    const allCatIds = [
      ...new Set(
        byPartyCategory.map((r) => r.categoryId).filter((id): id is string => id !== null),
      ),
    ];
    const catNames =
      allCatIds.length > 0
        ? await prisma.category.findMany({
            where: { id: { in: allCatIds } },
            select: { id: true, name: true },
          })
        : [];
    const catNameMap = new Map(catNames.map((c) => [c.id, c.name]));

    // Identidades das parties com despesa (nome ao vivo p/ personal atual; snapshot p/ resto)
    // + parties ativas para o ranking de zeradas.
    const spenderIds = byParty
      .map((g) => g.responsiblePartyId)
      .filter((id): id is string => id !== null);
    const { identities, activeParties } = await loadParties(accountId, spenderIds);

    function identityFor(partyId: string): PartyIdentity {
      return (
        identities.get(partyId) ?? {
          name: m.dashboards.members.unassigned,
          isFormerMember: false,
          icon: null,
        }
      );
    }

    const grandTotal = byParty.reduce((sum, g) => sum + (g._sum.amountCents ?? 0n), 0n);

    function topCategoryName(key: string): string | null {
      const top = topCatByResp.get(key);
      if (!top) return null;
      if (top.categoryId === null) return m.dashboards.members.uncategorized;
      return catNameMap.get(top.categoryId) ?? m.dashboards.members.uncategorized;
    }

    function categoriesFor(key: string, memberTotal: bigint): MemberCategoryBreakdown[] {
      return byPartyCategory
        .filter((r) => (r.responsiblePartyId ?? UNASSIGNED_KEY) === key)
        .map((r) => {
          const cents = r._sum.amountCents ?? 0n;
          const name = r.categoryId
            ? (catNameMap.get(r.categoryId) ?? m.dashboards.members.uncategorized)
            : m.dashboards.members.uncategorized;
          return {
            name,
            cents: cents.toString(),
            sharePercent: sharePercent(cents, memberTotal),
          };
        })
        .filter((c) => BigInt(c.cents) > 0n)
        .sort((a, b) => Number(BigInt(b.cents) - BigInt(a.cents)));
    }

    // Linhas com despesa (party real ou "Sem responsável").
    const spendRows: MemberBreakdownRow[] = byParty.map((g) => {
      const total = g._sum.amountCents ?? 0n;
      if (g.responsiblePartyId === null) {
        return {
          partyId: null,
          name: m.dashboards.members.unassigned,
          isFormerMember: false,
          icon: null,
          totalCents: total.toString(),
          sharePercent: sharePercent(total, grandTotal),
          topCategoryName: topCategoryName(UNASSIGNED_KEY),
          categories: categoriesFor(UNASSIGNED_KEY, total),
        };
      }
      const identity = identityFor(g.responsiblePartyId);
      return {
        partyId: g.responsiblePartyId,
        name: identity.name,
        isFormerMember: identity.isFormerMember,
        icon: identity.icon,
        totalCents: total.toString(),
        sharePercent: sharePercent(total, grandTotal),
        topCategoryName: topCategoryName(g.responsiblePartyId),
        categories: categoriesFor(g.responsiblePartyId, total),
      };
    });

    spendRows.sort((a, b) => Number(BigInt(b.totalCents) - BigInt(a.totalCents)));

    // Parties ativas sem despesa no mês → ao final, zeradas.
    const spenderIdSet = new Set(spenderIds);
    const zeroRows: MemberBreakdownRow[] = activeParties
      .filter((party) => !spenderIdSet.has(party.id))
      .map((party) => ({
        partyId: party.id,
        name: party.name,
        isFormerMember: false,
        icon: party.icon,
        totalCents: "0",
        sharePercent: 0,
        topCategoryName: null,
        categories: [],
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
      by: ["responsiblePartyId", "monthId"],
      where: expenseWhere(accountId, { monthId: { in: monthIds } }),
      _sum: { amountCents: true },
    });
    if (rows.length === 0) return [];

    // Eixo X = meses do ano que têm despesa (ordem cronológica).
    const monthIdsWithExpense = new Set(rows.map((r) => r.monthId));
    const axisMonths = months.filter((mo) => monthIdsWithExpense.has(mo.id));
    if (axisMonths.length === 0) return [];

    // byResp[key][monthId] = total. Total anual por party.
    const byRespMonth = new Map<string, Map<string, bigint>>();
    const yearTotalByResp = new Map<string, bigint>();
    for (const r of rows) {
      const key = r.responsiblePartyId ?? UNASSIGNED_KEY;
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

    // Resolver identidades dos top que são partyIds reais.
    const topRealPartyIds = topKeys.filter((k) => k !== UNASSIGNED_KEY);
    const { identities } = await loadParties(accountId, topRealPartyIds);

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
          icon: null,
          points: pointsFor(perMonth),
        };
      }
      const identity = identities.get(key) ?? {
        name: m.dashboards.members.unassigned,
        isFormerMember: false,
        icon: null,
      };
      return {
        seriesId: key,
        name: identity.name,
        isFormerMember: identity.isFormerMember,
        icon: identity.icon,
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
        icon: null,
        points: pointsFor(othersPerMonth),
      });
    }

    return series;
  },
);

// ─── Breakdown anual (Spec 38 FEAT-02) ────────────────────────────
// Agrega todas as despesas de saída do ano por party. Top-5 por totalCents DESC.

export const getMemberYearlyBreakdown = cache(
  async (accountId: string, year: number): Promise<MemberBreakdownRow[]> => {
    const months = await prisma.month.findMany({
      where: { accountId, year },
      select: { id: true },
    });
    if (months.length === 0) return [];
    const monthIds = months.map((month) => month.id);

    const where = expenseWhere(accountId, { monthId: { in: monthIds } });

    const [byParty, byPartyCategory] = await Promise.all([
      prisma.transaction.groupBy({
        by: ["responsiblePartyId"],
        where,
        _sum: { amountCents: true },
      }),
      prisma.transaction.groupBy({
        by: ["responsiblePartyId", "categoryId"],
        where,
        _sum: { amountCents: true },
      }),
    ]);

    // Categoria-top por party
    const topCatByResp = new Map<string, { categoryId: string | null; sum: bigint }>();
    for (const row of byPartyCategory) {
      const key = row.responsiblePartyId ?? UNASSIGNED_KEY;
      const sum = row._sum.amountCents ?? 0n;
      const current = topCatByResp.get(key);
      if (!current || sum > current.sum) {
        topCatByResp.set(key, { categoryId: row.categoryId, sum });
      }
    }

    const allCatIds = [
      ...new Set(
        byPartyCategory.map((r) => r.categoryId).filter((id): id is string => id !== null),
      ),
    ];
    const catNames =
      allCatIds.length > 0
        ? await prisma.category.findMany({
            where: { id: { in: allCatIds } },
            select: { id: true, name: true },
          })
        : [];
    const catNameMap = new Map(catNames.map((c) => [c.id, c.name]));

    const spenderIds = byParty
      .map((g) => g.responsiblePartyId)
      .filter((id): id is string => id !== null);
    const { identities } = await loadParties(accountId, spenderIds);

    function identityFor(partyId: string): PartyIdentity {
      return (
        identities.get(partyId) ?? {
          name: m.dashboards.members.unassigned,
          isFormerMember: false,
          icon: null,
        }
      );
    }

    const grandTotal = byParty.reduce((sum, g) => sum + (g._sum.amountCents ?? 0n), 0n);

    function topCategoryNameYear(key: string): string | null {
      const top = topCatByResp.get(key);
      if (!top) return null;
      if (top.categoryId === null) return m.dashboards.members.uncategorized;
      return catNameMap.get(top.categoryId) ?? m.dashboards.members.uncategorized;
    }

    function categoriesForYear(key: string, memberTotal: bigint): MemberCategoryBreakdown[] {
      return byPartyCategory
        .filter((r) => (r.responsiblePartyId ?? UNASSIGNED_KEY) === key)
        .map((r) => {
          const cents = r._sum.amountCents ?? 0n;
          const name = r.categoryId
            ? (catNameMap.get(r.categoryId) ?? m.dashboards.members.uncategorized)
            : m.dashboards.members.uncategorized;
          return {
            name,
            cents: cents.toString(),
            sharePercent: sharePercent(cents, memberTotal),
          };
        })
        .filter((c) => BigInt(c.cents) > 0n)
        .sort((a, b) => Number(BigInt(b.cents) - BigInt(a.cents)));
    }

    const spendRows: MemberBreakdownRow[] = byParty.map((g) => {
      const total = g._sum.amountCents ?? 0n;
      if (g.responsiblePartyId === null) {
        return {
          partyId: null,
          name: m.dashboards.members.unassigned,
          isFormerMember: false,
          icon: null,
          totalCents: total.toString(),
          sharePercent: sharePercent(total, grandTotal),
          topCategoryName: topCategoryNameYear(UNASSIGNED_KEY),
          categories: categoriesForYear(UNASSIGNED_KEY, total),
        };
      }
      const identity = identityFor(g.responsiblePartyId);
      return {
        partyId: g.responsiblePartyId,
        name: identity.name,
        isFormerMember: identity.isFormerMember,
        icon: identity.icon,
        totalCents: total.toString(),
        sharePercent: sharePercent(total, grandTotal),
        topCategoryName: topCategoryNameYear(g.responsiblePartyId),
        categories: categoriesForYear(g.responsiblePartyId, total),
      };
    });

    spendRows.sort((a, b) => Number(BigInt(b.totalCents) - BigInt(a.totalCents)));
    return spendRows.slice(0, 5);
  },
);
