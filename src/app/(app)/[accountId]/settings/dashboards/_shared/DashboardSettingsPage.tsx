import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Box from "@mui/material/Box";

import { requireAccountAccess } from "@/server/auth/session";
import { getLayout } from "@/server/services/dashboard-layout-service";
import { getWidgetConfigOptions } from "@/server/queries/widget-config-options";
import { m } from "@/lib/messages";
import { containers } from "@/lib/design-tokens";
import { DashboardGridEditor } from "@/components/settings/DashboardGridEditor";
import { SettingsPageShell } from "@/components/settings/SettingsPageShell";
import type { DashboardContext } from "@/components/dashboards/_core/widget-registry";

type Props = { accountId: string; context: DashboardContext };

/**
 * Nome de cada sub-rota. Continua servindo ao `generateMetadata` (título da aba)
 * e, desde a Spec 67 §7.5, também ao chip de contagem: as três rotas compartilham
 * o título "Dashboards" e é o chip que diz QUAL delas está aberta.
 */
const CONTEXT_TITLES: Record<DashboardContext, string> = {
  monthly: m.settings.nav.dashboards.monthly,
  yearly: m.settings.nav.dashboards.yearly,
  month_summary: m.settings.nav.dashboards.monthSummary,
};

export async function DashboardSettingsPage({ accountId, context }: Props) {
  const { member } = await requireAccountAccess(accountId).catch(() => redirect("/home"));
  if (member.role === "viewer") redirect(`/${accountId}`);

  const [widgets, configOptions] = await Promise.all([
    getLayout(accountId, context),
    getWidgetConfigOptions(accountId),
  ]);

  return (
    // Sem `primaryAction`: widget entra por arraste da paleta, não por botão.
    // Sem `dirtyCount`: o editor salva sozinho (otimista + debounce), não há rodapé de salvar.
    <SettingsPageShell
      family="Apresentação"
      title={m.settings.nav.groups.dashboardsLabel}
      count={CONTEXT_TITLES[context]}
      purpose={m.settings.purposes.dashboards}
    >
      {/*
        O padding agora é do shell; só o teto de largura precisa ser reposto aqui —
        o `PageSettingsContainer` limitava o editor a `containers.lg`, e sem isso o
        grid esticaria indefinidamente em telas ultralargas.
      */}
      <Box sx={{ maxWidth: containers.lg }}>
        <DashboardGridEditor
          accountId={accountId}
          context={context}
          initialWidgets={widgets}
          configOptions={configOptions}
        />
      </Box>
    </SettingsPageShell>
  );
}

export function generateDashboardSettingsMetadata(context: DashboardContext): Metadata {
  return { title: `${CONTEXT_TITLES[context]} — MyAccountant` };
}
