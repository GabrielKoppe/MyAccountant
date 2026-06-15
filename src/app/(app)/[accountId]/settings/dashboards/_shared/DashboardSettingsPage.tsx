import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { requireAccountAccess } from "@/server/auth/session";
import { getLayout } from "@/server/services/dashboard-layout-service";
import { m } from "@/lib/messages";
import { DashboardLayoutEditor } from "@/components/settings/DashboardLayoutEditor";
import PageSettingsContainer from "@/components/settings/PageSettingsContainer";
import type { DashboardContext } from "@/components/dashboards/_core/widget-registry";

type Props = { accountId: string; context: DashboardContext };

function buildWidgetMeta(
  context: DashboardContext,
): Record<string, { label: string; description: string }> {
  const labels = m.dashboards.widgets[context] as Record<string, string>;
  const descriptions = m.dashboards.widgets.descriptions[context] as Record<string, string>;
  return Object.fromEntries(
    Object.keys(labels).map((id) => [
      id,
      { label: labels[id] ?? id, description: descriptions[id] ?? "" },
    ]),
  );
}

const CONTEXT_TITLES: Record<DashboardContext, string> = {
  monthly: m.settings.nav.dashboards.monthly,
  yearly: m.settings.nav.dashboards.yearly,
  month_summary: m.settings.nav.dashboards.monthSummary,
};

export async function DashboardSettingsPage({ accountId, context }: Props) {
  const { member } = await requireAccountAccess(accountId).catch(() => redirect("/home"));
  if (member.role === "viewer") redirect(`/${accountId}`);

  const resolved = await getLayout(accountId, context);
  const title = CONTEXT_TITLES[context];
  const widgetMeta = buildWidgetMeta(context);

  return (
    <PageSettingsContainer title={title} secondary={null}>
      <DashboardLayoutEditor
        accountId={accountId}
        context={context}
        initialActive={resolved.active}
        initialAvailable={resolved.available}
        widgetMeta={widgetMeta}
      />
    </PageSettingsContainer>
  );
}

export function generateDashboardSettingsMetadata(context: DashboardContext): Metadata {
  return { title: `${CONTEXT_TITLES[context]} — MyAccountant` };
}
