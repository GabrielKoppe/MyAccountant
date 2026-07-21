import { getMonthRange } from "@/lib/dates";

export type NwAccount = { id: string; kind: "asset" | "liability"; archivedAt: Date | null };
export type NwSnapshot = { balanceAccountId: string; balanceCents: bigint; capturedOn: Date };

/** Patrimônio atual: último saldo por conta NÃO-arquivada; ativo soma, passivo subtrai. */
export function computeCurrentNetWorth(accounts: NwAccount[], latestByAccount: Map<string, bigint>) {
  let assetsCents = 0n;
  let liabilitiesCents = 0n;
  for (const a of accounts) {
    if (a.archivedAt !== null) continue; // arquivada fora do atual
    const bal = latestByAccount.get(a.id);
    if (bal === undefined) continue;
    if (a.kind === "asset") assetsCents += bal;
    else liabilitiesCents += bal;
  }
  return { assetsCents, liabilitiesCents, netCents: assetsCents - liabilitiesCents };
}

/** Série mensal por carry-forward. `months` em ordem cronológica. */
export function buildMonthlySeries(
  accounts: NwAccount[],
  snapshots: NwSnapshot[],
  months: { year: number; month: number }[],
  monthStartDay: number,
) {
  const byAccount = new Map<string, NwSnapshot[]>();
  for (const s of snapshots) {
    const list = byAccount.get(s.balanceAccountId) ?? [];
    list.push(s);
    byAccount.set(s.balanceAccountId, list);
  }
  for (const list of byAccount.values()) list.sort((a, b) => a.capturedOn.getTime() - b.capturedOn.getTime());

  return months.map(({ year, month }) => {
    const end = getMonthRange(year, month, monthStartDay).end;
    let assetsCents = 0n;
    let liabilitiesCents = 0n;
    for (const acc of accounts) {
      if (acc.archivedAt !== null && acc.archivedAt <= end) continue; // parou de contribuir
      const list = byAccount.get(acc.id);
      if (!list) continue;
      let latest: bigint | undefined; // último snapshot <= fim de M
      for (const s of list) {
        if (s.capturedOn <= end) latest = s.balanceCents;
        else break;
      }
      if (latest === undefined) continue; // sem snapshot ainda → 0
      if (acc.kind === "asset") assetsCents += latest;
      else liabilitiesCents += latest;
    }
    return { year, month, assetsCents, liabilitiesCents, netCents: assetsCents - liabilitiesCents };
  });
}
