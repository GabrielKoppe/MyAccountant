import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireAccountAccess } from "@/server/auth/session";
import { getBudgetFormOptions, getBudgetsConfigWithHistory } from "@/server/queries/budgets";

import { BudgetsPlanningManager } from "./BudgetsPlanningManager";

type Props = { params: Promise<{ accountId: string }> };

export const metadata: Metadata = { title: "Orçamento | MyAccountant" };

/**
 * Aba Orçamento do hub Planejamento (Spec 25 — visão CONFIG + HISTÓRICO). O
 * `Budget` é agnóstico de mês: não existe mais "o mês vigente" nesta rota. Em vez
 * de resolver o mês fiscal corrente e computar progresso de UM mês
 * (`getBudgetsWithProgress`), esta página lê a CONFIG de cada orçamento mais o
 * histórico de status por mês existente da account (`getBudgetsConfigWithHistory`)
 * — daí o `page.tsx` não depender mais de `getCurrentFiscalMonth`/`accountSettings`.
 *
 * `requireAccountAccess` + `canEdit` por role; o shell (PageHeader "Planejamento"
 * + `PlanningNav`) vem de `planning/layout.tsx`.
 */
export default async function BudgetsPlanningPage({ params }: Props) {
  const { accountId } = await params;
  const { member } = await requireAccountAccess(accountId).catch(() => redirect("/home"));

  const [budgets, formOptions] = await Promise.all([
    getBudgetsConfigWithHistory(accountId),
    getBudgetFormOptions(accountId),
  ]);

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
