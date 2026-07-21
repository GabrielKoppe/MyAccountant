import { cache } from "react";

import { prisma } from "@/server/prisma";
import { getCurrentFiscalMonth } from "@/lib/dates";
import {
  computeCurrentNetWorth,
  buildMonthlySeries,
  type NwAccount,
} from "@/server/services/net-worth-service";
import { serializeBalanceAccount } from "@/lib/serializers/balance-account";

/** Gera N meses cronológicos terminando em (year, month). */
function lastNMonths(end: { year: number; month: number }, n: number) {
  const out: { year: number; month: number }[] = [];
  let { year, month } = end;
  for (let i = 0; i < n; i++) {
    out.unshift({ year, month });
    month--;
    if (month === 0) {
      month = 12;
      year--;
    }
  }
  return out;
}

async function monthStartDayOf(accountId: string) {
  const s = await prisma.accountSettings.findUnique({
    where: { accountId },
    select: { monthStartDay: true },
  });
  return s?.monthStartDay ?? 1;
}

/** Contas + snapshots da account (multi-tenancy) para alimentar buildMonthlySeries. */
async function fetchAccountsAndSnapshots(accountId: string) {
  const accounts: NwAccount[] = await prisma.balanceAccount.findMany({
    where: { accountId }, // ✅ multi-tenancy
    select: { id: true, kind: true, archivedAt: true },
  });
  // carry-forward precisa de TODO o histórico (não filtrar por início da janela)
  const snapshots = await prisma.balanceSnapshot.findMany({
    where: { accountId }, // ✅ multi-tenancy
    select: { balanceAccountId: true, balanceCents: true, capturedOn: true },
  });
  return { accounts, snapshots };
}

export const getNetWorthSeries = cache(async function getNetWorthSeries(
  accountId: string,
  monthCount: number,
) {
  const monthStartDay = await monthStartDayOf(accountId);
  const months = lastNMonths(getCurrentFiscalMonth(new Date(), monthStartDay), monthCount);
  const { accounts, snapshots } = await fetchAccountsAndSnapshots(accountId);
  return buildMonthlySeries(accounts, snapshots, months, monthStartDay).map((p) => ({
    year: p.year,
    month: p.month,
    assetsCents: p.assetsCents.toString(), // BigInt→string
    liabilitiesCents: p.liabilitiesCents.toString(), // BigInt→string
    netCents: p.netCents.toString(), // BigInt→string
  }));
});

// Spec 46 Fase 9 — série anual (12 meses fiscais de `year`) para o widget yearly.
export const getNetWorthSeriesForYear = cache(async function getNetWorthSeriesForYear(
  accountId: string,
  year: number,
) {
  const monthStartDay = await monthStartDayOf(accountId);
  const months = Array.from({ length: 12 }, (_, i) => ({ year, month: i + 1 }));
  const { accounts, snapshots } = await fetchAccountsAndSnapshots(accountId);
  return buildMonthlySeries(accounts, snapshots, months, monthStartDay).map((p) => ({
    year: p.year,
    month: p.month,
    assetsCents: p.assetsCents.toString(), // BigInt→string
    liabilitiesCents: p.liabilitiesCents.toString(), // BigInt→string
    netCents: p.netCents.toString(), // BigInt→string
  }));
});

export const getNetWorthOverview = cache(async function getNetWorthOverview(accountId: string) {
  const accounts = await prisma.balanceAccount.findMany({
    where: { accountId }, // ✅ multi-tenancy
    include: {
      institution: { select: { name: true } },
      snapshots: { orderBy: { capturedOn: "desc" }, take: 1 },
    },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
  });
  const latest = new Map<string, bigint>();
  for (const a of accounts) if (a.snapshots[0]) latest.set(a.id, a.snapshots[0].balanceCents);
  const totals = computeCurrentNetWorth(accounts, latest);

  const series = await getNetWorthSeries(accountId, 2); // delta vs mês anterior
  const prev = series.length >= 2 ? BigInt(series[series.length - 2].netCents) : null;
  const deltaCents = prev === null ? null : (totals.netCents - prev).toString();
  const deltaPct =
    prev === null || prev === 0n
      ? null
      : (Number(totals.netCents - prev) / Math.abs(Number(prev))) * 100;

  return {
    assetsCents: totals.assetsCents.toString(),
    liabilitiesCents: totals.liabilitiesCents.toString(),
    netCents: totals.netCents.toString(),
    deltaCents,
    deltaPct,
    accounts: accounts.map(serializeBalanceAccount),
  };
});
