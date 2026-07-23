import { redirect } from "next/navigation";

import { requireAccountAccess } from "@/server/auth/session";

type Props = { params: Promise<{ accountId: string }> };

/** `/planning` redireciona para a aba Metas (spec 47 §2.2/§3.3) — espelha `dashboards/page.tsx`. */
export default async function PlanningPage({ params }: Props) {
  const { accountId } = await params;
  await requireAccountAccess(accountId).catch(() => redirect("/home"));

  redirect(`/${accountId}/planning/goals`);
}
