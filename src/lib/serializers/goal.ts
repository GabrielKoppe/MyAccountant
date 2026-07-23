// Serialização centralizada de metas de poupança: BigInt → string, Date → string.
// Usar em todos os RSC que passam metas (Goal) para Client Components.
// Nunca converter *Cents ou datas de meta inline — use este helper.
//
// Espelha serializers/balance-account.ts. Diferença: o input aqui não é o Goal "cru"
// do Prisma — é o Goal já combinado com o resultado de computeProgress/computePace
// (src/server/services/goal-service.ts), que o caller (queries/goals.ts) calcula antes
// de serializar. Este arquivo só formata; não faz nenhuma conta.

export type SerializedGoal = {
  id: string;
  name: string;
  targetCents: string;
  progressCents: string;
  percent: number;
  deadline: string | null; // "YYYY-MM-DD"
  isAchieved: boolean;
  archivedAt: string | null; // ISO
  pace: "achieved" | "on_track" | "ahead" | "behind" | "no_contribution";
  requiredMonthlyCents: string | null;
  projectedMonth: string | null; // "YYYY-MM"
  sectionId: string | null;
  categoryId: string | null;
};

type GoalForSerialization = {
  id: string;
  name: string;
  targetCents: bigint;
  progressCents: bigint;
  percent: number;
  deadline: Date | null;
  isAchieved: boolean;
  archivedAt: Date | null;
  pace: "achieved" | "on_track" | "ahead" | "behind" | "no_contribution";
  requiredMonthlyCents: bigint | null;
  projectedMonth: { year: number; month: number } | null;
  sectionId: string | null;
  categoryId: string | null;
};

function formatYearMonth(fm: { year: number; month: number }): string {
  return `${fm.year}-${String(fm.month).padStart(2, "0")}`;
}

export function serializeGoal(g: GoalForSerialization): SerializedGoal {
  return {
    id: g.id,
    name: g.name,
    targetCents: g.targetCents.toString(),
    progressCents: g.progressCents.toString(),
    percent: g.percent,
    deadline: g.deadline ? g.deadline.toISOString().slice(0, 10) : null,
    isAchieved: g.isAchieved,
    archivedAt: g.archivedAt ? g.archivedAt.toISOString() : null,
    pace: g.pace,
    requiredMonthlyCents: g.requiredMonthlyCents !== null ? g.requiredMonthlyCents.toString() : null,
    projectedMonth: g.projectedMonth ? formatYearMonth(g.projectedMonth) : null,
    sectionId: g.sectionId,
    categoryId: g.categoryId,
  };
}
