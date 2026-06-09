import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireAccountAccess } from "@/server/auth/session";
import { getBudgetsForSettings, getBudgetFormOptions } from "@/lib/queries/budgets";
import { BudgetsManager } from "./BudgetsManager";

type Props = { params: Promise<{ accountId: string }> };

export const metadata: Metadata = { title: "Metas de Orçamento | MyAccountant" };

export default async function BudgetsPage({ params }: Props) {
  const { accountId } = await params;
  await requireAccountAccess(accountId).catch(() => redirect("/home"));

  const [budgets, formOptions] = await Promise.all([
    getBudgetsForSettings(accountId),
    getBudgetFormOptions(accountId),
  ]);

  return (
    <BudgetsManager
      accountId={accountId}
      initialBudgets={budgets}
      formOptions={formOptions}
    />
  );
}
