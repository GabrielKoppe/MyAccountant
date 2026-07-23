import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireAccountAccess } from "@/server/auth/session";
import {
  getArchivedGoals,
  getGoalDimensionOptions,
  getGoalsOverview,
} from "@/server/queries/goals";

import { GoalsManager } from "./GoalsManager";

type Props = { params: Promise<{ accountId: string }> };

export const metadata: Metadata = { title: "Metas | MyAccountant" };

/**
 * Aba Metas do hub Planejamento (spec 47 §5.2, Fase 8). Espelha
 * `net-worth/page.tsx` (`requireAccountAccess` + `Promise.all` + `canEdit` por
 * role) — o shell (PageHeader "Planejamento" + `PlanningNav`) já vem de
 * `planning/layout.tsx`; esta página é só o conteúdo de `{children}` da aba.
 */
export default async function GoalsPage({ params }: Props) {
  const { accountId } = await params;
  const { member } = await requireAccountAccess(accountId).catch(() => redirect("/home"));

  const [overview, archived, dimensionOptions] = await Promise.all([
    getGoalsOverview(accountId),
    getArchivedGoals(accountId),
    getGoalDimensionOptions(accountId),
  ]);

  const canEdit = member.role === "owner" || member.role === "editor";

  return (
    <GoalsManager
      accountId={accountId}
      overview={overview}
      archived={archived}
      dimensionOptions={dimensionOptions}
      canEdit={canEdit}
    />
  );
}
