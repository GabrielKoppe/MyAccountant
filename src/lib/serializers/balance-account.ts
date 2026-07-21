// Serialização centralizada de contas patrimoniais: BigInt → string, Date → string ISO.
// Usar em todos os RSC que passam contas patrimoniais para Client Components.
// Nunca converter balanceCents ou datas de snapshot inline — use este helper.

export type SerializedBalanceAccount = {
  id: string;
  kind: "asset" | "liability";
  name: string;
  institutionId: string | null;
  institutionName: string | null;
  archivedAt: string | null; // ISO
  latestSnapshot: { balanceCents: string; capturedOn: string } | null; // capturedOn "YYYY-MM-DD"
};

type PrismaBalanceAccount = {
  id: string;
  kind: "asset" | "liability";
  name: string;
  institutionId: string | null;
  archivedAt: Date | null;
  institution?: { name: string } | null;
  snapshots?: { balanceCents: bigint; capturedOn: Date }[]; // esperado: take:1 desc
};

export function serializeBalanceAccount(
  a: PrismaBalanceAccount,
): SerializedBalanceAccount {
  const snap = a.snapshots?.[0];
  return {
    id: a.id,
    kind: a.kind,
    name: a.name,
    institutionId: a.institutionId,
    institutionName: a.institution?.name ?? null,
    archivedAt: a.archivedAt?.toISOString() ?? null,
    latestSnapshot: snap
      ? {
          balanceCents: snap.balanceCents.toString(),
          capturedOn: snap.capturedOn.toISOString().slice(0, 10),
        }
      : null,
  };
}
