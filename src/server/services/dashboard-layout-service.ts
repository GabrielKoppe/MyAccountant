import { prisma } from "@/server/prisma";
import { WIDGET_REGISTRY, resolveLayout, type DashboardContext } from "@/components/dashboards/widget-registry";
import type { UpdateDashboardLayoutInput } from "@/lib/schemas/dashboard-layout";
import type { ActionContext } from "@/server/api/define-action";

export async function getLayout(accountId: string, context: DashboardContext) {
  const record = await prisma.dashboardLayout.findUnique({
    where: { accountId_context: { accountId, context } },
    select: { widgets: true },
  });

  const stored = record ? (record.widgets as string[]) : null;
  return resolveLayout(context, stored);
}

export async function upsertLayout(
  input: UpdateDashboardLayoutInput,
  ctx: ActionContext,
) {
  const { accountId, context, widgets } = input;
  const knownIds = new Set(WIDGET_REGISTRY[context as DashboardContext].map((w) => w.id));
  const filtered = widgets.filter((id) => knownIds.has(id));

  await prisma.dashboardLayout.upsert({
    where: { accountId_context: { accountId: ctx.accountId, context } },
    create: { accountId: ctx.accountId, context, widgets: filtered },
    update: { widgets: filtered },
  });
}
