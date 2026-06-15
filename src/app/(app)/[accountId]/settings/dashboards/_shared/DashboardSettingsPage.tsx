import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { requireAccountAccess } from "@/server/auth/session";
import { getLayout } from "@/server/services/dashboard-layout-service";
import { m } from "@/lib/messages";
import { containers } from "@/lib/design-tokens";
import { DashboardGridEditor } from "@/components/settings/DashboardGridEditor";
import PageSettingsContainer from "@/components/settings/PageSettingsContainer";
import type { DashboardContext } from "@/components/dashboards/_core/widget-registry";

type Props = { accountId: string; context: DashboardContext };

const CONTEXT_TITLES: Record<DashboardContext, string> = {
  monthly: m.settings.nav.dashboards.monthly,
  yearly: m.settings.nav.dashboards.yearly,
  month_summary: m.settings.nav.dashboards.monthSummary,
};

export async function DashboardSettingsPage({ accountId, context }: Props) {
  const { member } = await requireAccountAccess(accountId).catch(() => redirect("/home"));
  if (member.role === "viewer") redirect(`/${accountId}`);

  const widgets = await getLayout(accountId, context);
  const title = CONTEXT_TITLES[context];

  return (
    <PageSettingsContainer title={title} secondary={null} maxWidth={containers.lg}>
      <DashboardGridEditor accountId={accountId} context={context} initialWidgets={widgets} />
    </PageSettingsContainer>
  );
}

export function generateDashboardSettingsMetadata(context: DashboardContext): Metadata {
  return { title: `${CONTEXT_TITLES[context]} — MyAccountant` };
}
