import type { Metadata } from "next";
import { redirect } from "next/navigation";

import type { DashboardContext } from "@/components/dashboards/_core/widget-registry";
import { DashboardGridEditor } from "@/components/settings/DashboardGridEditor";
import { m } from "@/lib/messages";
import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";
import { getWidgetConfigOptions } from "@/server/queries/widget-config-options";
import { getEditorLayout } from "@/server/services/dashboard-layout-service";

type Props = { accountId: string; context: DashboardContext };

/**
 * Nome de cada sub-rota. Continua servindo ao `generateMetadata` (título da aba).
 * Desde a Spec 69, QUAL das três páginas está aberta é dito pelo
 * `ToggleButtonGroup` da toolbar (DIV-12) — o chip do cabeçalho passou a ser o
 * resumo do layout ("6 widgets · 4 linhas"), como no frame 07.
 */
const CONTEXT_TITLES: Record<DashboardContext, string> = {
  monthly: m.settings.nav.dashboards.monthly,
  yearly: m.settings.nav.dashboards.yearly,
  month_summary: m.settings.nav.dashboards.monthSummary,
};

/**
 * "Ver a página": o destino real de cada dashboard. Mensal e Resumo do mês
 * precisam de um mês; sem nenhum mês na conta a ação simplesmente não aparece,
 * em vez de levar a um 404.
 */
async function resolveViewPageHref(
  accountId: string,
  context: DashboardContext,
): Promise<string | undefined> {
  if (context === "yearly") return `/${accountId}/dashboards`;

  const latestMonth = await prisma.month.findFirst({
    where: { accountId },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    select: { id: true },
  });
  if (!latestMonth) return undefined;

  return context === "monthly"
    ? `/${accountId}/dashboards/monthly/${latestMonth.id}`
    : `/${accountId}/months/${latestMonth.id}`;
}

export async function DashboardSettingsPage({ accountId, context }: Props) {
  const { member } = await requireAccountAccess(accountId).catch(() => redirect("/home"));
  if (member.role === "viewer") redirect(`/${accountId}`);

  const [layout, configOptions, viewPageHref] = await Promise.all([
    getEditorLayout(accountId, context),
    getWidgetConfigOptions(accountId),
    resolveViewPageHref(accountId, context),
  ]);

  // O shell vive DENTRO do editor: o rodapé "Publicar layout" depende do estado
  // de cliente (movimentações pendentes), que esta RSC não tem.
  return (
    <DashboardGridEditor
      accountId={accountId}
      context={context}
      initialWidgets={layout.widgets}
      initialPublished={layout.published}
      configOptions={configOptions}
      title={m.settings.nav.groups.dashboardsLabel}
      purpose={m.settings.purposes.dashboards}
      viewPageHref={viewPageHref}
    />
  );
}

export function generateDashboardSettingsMetadata(context: DashboardContext): Metadata {
  return { title: `${CONTEXT_TITLES[context]} — MyAccountant` };
}
