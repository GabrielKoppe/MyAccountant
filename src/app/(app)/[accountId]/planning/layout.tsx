import Box from "@mui/material/Box";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { PlanningNav } from "@/components/planning/PlanningNav";
import { PageHeader } from "@/components/ui/PageHeader";
import { containers, layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import { requireAccountAccess } from "@/server/auth/session";

type Props = {
  children: ReactNode;
  params: Promise<{ accountId: string }>;
};

/**
 * Shell do hub "Planejamento" (spec 47 §3.3/§5.1). Espelha `settings/layout.tsx`
 * (`requireAccountAccess` + nav), mas a nav é o `<PlanningNav>` horizontal
 * (`<Tabs>`) em vez do `SettingsNav` vertical — e, ao contrário de settings,
 * `viewer` também acessa (só perde as ações de mutação dentro de cada aba,
 * §5.2), então não há redirect por role aqui.
 *
 * `PageHeader` só tem título (nível hub, "Planejamento") — sem `actions`: o
 * botão contextual ("Nova meta" / "Novo orçamento", §5.1) fica por-aba, dentro
 * de cada página filha (`GoalsManager`/`BudgetsPlanningManager`, Fases 8/11), que já
 * vai espelhar o próprio PageHeader+ação de `NetWorthManager`/`ForecastManager`.
 * Decisão: evita inventar um mecanismo de slot cross-boundary para injetar uma
 * ação num header do shell quando o dialog/estado dessa ação só existe dentro
 * do client component de cada aba (que ainda não existe nesta fase).
 *
 * Sem padding embaixo (só `px`/`pt`): cada página filha já aplica seu próprio
 * `Box sx={{ p: layout.page, maxWidth: containers.lg, mx: "auto" }}` (mesmo
 * padrão de `NetWorthManager`/`ForecastManager`) — evita dobrar o padding.
 */
export default async function PlanningLayout({ children, params }: Props) {
  const { accountId } = await params;
  await requireAccountAccess(accountId).catch(() => redirect("/home"));

  return (
    <>
      <Box sx={{ px: layout.page, pt: layout.page, maxWidth: containers.lg, mx: "auto" }}>
        <PageHeader title={m.goals.hubTitle} />
        <PlanningNav accountId={accountId} />
      </Box>
      {children}
    </>
  );
}
