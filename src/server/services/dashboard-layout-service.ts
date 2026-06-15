import type { Prisma } from "@prisma/client";

import { prisma } from "@/server/prisma";
import {
  WIDGET_REGISTRY,
  GRID_CONFIG,
  resolveLayout,
  type DashboardContext,
} from "@/components/dashboards/_core/widget-registry";
import type { UpdateDashboardLayoutInput, StoredWidget } from "@/lib/schemas/dashboard-layout";
import type { ActionContext } from "@/server/api/define-action";
import { AppError } from "@/server/api/errors";

// Spec 36 — layout em grade 2D (StoredWidget[]). Filtra sempre por accountId.
export async function getLayout(
  accountId: string,
  context: DashboardContext,
): Promise<StoredWidget[]> {
  const record = await prisma.dashboardLayout.findUnique({
    where: { accountId_context: { accountId, context } },
    select: { widgets: true },
  });
  const stored = record ? (record.widgets as StoredWidget[]) : null;
  return resolveLayout(context, stored);
}

export async function upsertLayout(
  input: UpdateDashboardLayoutInput,
  ctx: ActionContext,
): Promise<void> {
  const { context, widgets } = input;
  const registry = WIDGET_REGISTRY[context as DashboardContext];

  // Validar cada item: widgetId conhecido + config válida se configSchema presente.
  for (const item of widgets) {
    const def = registry.find((d) => d.id === item.widgetId);
    if (!def) throw new AppError("NOT_FOUND", `Widget desconhecido: ${item.widgetId}`);
    if (def.configSchema && item.config !== undefined) {
      const result = def.configSchema.safeParse(item.config);
      if (!result.success) {
        throw new AppError("VALIDATION", `Config inválida para widget ${item.widgetId}`);
      }
    }
  }

  // Validar que coordenadas não ultrapassam os limites da grade.
  const { cols, maxRows } = GRID_CONFIG[context as DashboardContext];
  for (const item of widgets) {
    if (item.x + item.w > cols || item.y + item.h > maxRows) {
      throw new AppError("VALIDATION", `Widget ${item.instanceId} fora dos limites da grade`);
    }
  }

  await prisma.dashboardLayout.upsert({
    where: { accountId_context: { accountId: ctx.accountId, context } },
    create: {
      accountId: ctx.accountId,
      context,
      widgets: widgets as unknown as Prisma.InputJsonValue,
    },
    update: { widgets: widgets as unknown as Prisma.InputJsonValue },
  });
}
