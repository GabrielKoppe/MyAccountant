import type { SerializedGoal } from "@/lib/serializers/goal";

/**
 * Mapeia o ritmo da meta (GOAL-06, `Pace` de goal-service.ts) para a variante visual do
 * `StatusBadge` (§5.5) — cor = significado, nunca decoração. Compartilhado entre
 * `GoalsManager.tsx` (cards da grid/seção Arquivadas) e `GoalDetailDrawer.tsx` (header
 * do detalhe) para não duplicar o mesmo mapeamento em dois lugares.
 */
export const PACE_VARIANT: Record<SerializedGoal["pace"], "success" | "warning" | "neutral"> = {
  achieved: "success",
  on_track: "success",
  ahead: "success",
  behind: "warning",
  no_contribution: "neutral",
};
