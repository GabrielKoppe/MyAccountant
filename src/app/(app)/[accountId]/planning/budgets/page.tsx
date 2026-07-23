import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentFiscalMonth } from "@/lib/dates";
import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";
import { getBudgetFormOptions, getBudgetsWithProgress } from "@/server/queries/budgets";

import { BudgetsPlanningManager } from "./BudgetsPlanningManager";

type Props = { params: Promise<{ accountId: string }> };

export const metadata: Metadata = { title: "Orçamento | MyAccountant" };

/**
 * Aba Orçamento do hub Planejamento (spec 47 §5.9/§12 Fase 11) — reconstrói a
 * superfície de gestão do `Budget` (antes `settings/budgets/page.tsx`) com a
 * MESMA estrutura de página que a aba Metas (`planning/goals/page.tsx`):
 * `requireAccountAccess` + `canEdit` por role; o shell (PageHeader "Planejamento"
 * + `PlanningNav`) já vem de `planning/layout.tsx`.
 *
 * Reusa o backend do Budget INTACTO: `getBudgetsWithProgress`/`getBudgetFormOptions`
 * (`server/queries/budgets.ts`, por trás delas o `budget-service.ts` e o schema —
 * nada disso muda). Como esta rota não tem `monthId` (ao contrário do dashboard
 * mensal), o mês fiscal corrente é resolvido aqui do mesmo jeito que
 * `dashboards/monthly/[monthId]/page.tsx` faz (`accountSettings.monthStartDay` +
 * `getCurrentFiscalMonth`) — a aba sempre mostra o progresso do mês vigente.
 */
export default async function BudgetsPlanningPage({ params }: Props) {
  const { accountId } = await params;
  const { member } = await requireAccountAccess(accountId).catch(() => redirect("/home"));

  const [accountSettings, formOptions] = await Promise.all([
    prisma.accountSettings.findUnique({
      where: { accountId },
      select: { monthStartDay: true },
    }),
    getBudgetFormOptions(accountId),
  ]);

  const { year, month } = getCurrentFiscalMonth(new Date(), accountSettings?.monthStartDay ?? 1);
  const budgets = await getBudgetsWithProgress(accountId, year, month);

  const canEdit = member.role === "owner" || member.role === "editor";

  return (
    <BudgetsPlanningManager
      accountId={accountId}
      initialBudgets={budgets}
      formOptions={formOptions}
      canEdit={canEdit}
    />
  );
}
