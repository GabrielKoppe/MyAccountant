"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { defineAction } from "@/server/api/define-action";
import { AppError } from "@/server/api/errors";
import { updateDashboardLayoutSchema } from "@/lib/schemas/dashboard-layout";
import type { StoredWidget } from "@/lib/schemas/dashboard-layout";
import { sandboxConfigSchema } from "@/lib/schemas/sandbox";
import { WIDGET_REGISTRY, GRID_CONFIG } from "@/components/dashboards/_core/widget-registry";
import type { DashboardContext } from "@/components/dashboards/_core/widget-registry";
import * as dashboardLayoutService from "@/server/services/dashboard-layout-service";
import { m } from "@/lib/messages";

const EDITOR_ROLES = ["owner", "editor"] as const;

export const updateDashboardLayoutAction = defineAction({
  schema: updateDashboardLayoutSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await dashboardLayoutService.upsertLayout(input, ctx);
    // Invalida dashboards (RSCs cacheados) e a própria página de settings
    revalidatePath(`/${ctx.accountId}/dashboards`, "layout");
    revalidatePath(`/${ctx.accountId}/settings/dashboards`, "layout");
    revalidatePath(`/${ctx.accountId}/months`, "layout");
  },
});

// ─── Adicionar widget analysis ao dashboard a partir do Sandbox ───────────────

function buildOccupancy(items: StoredWidget[]): Set<string> {
  const occ = new Set<string>();
  for (const it of items) {
    for (let dy = 0; dy < it.h; dy++) {
      for (let dx = 0; dx < it.w; dx++) {
        occ.add(`${it.x + dx},${it.y + dy}`);
      }
    }
  }
  return occ;
}

function findNextFreePosition(
  existing: StoredWidget[],
  w: number,
  h: number,
  cols: number,
  maxRows: number,
): { x: number; y: number } | null {
  const occ = buildOccupancy(existing);
  const yLimit = maxRows - h;
  for (let y = 0; y <= yLimit; y++) {
    for (let x = 0; x + w <= cols; x++) {
      let fits = true;
      outer: for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
          if (occ.has(`${x + dx},${y + dy}`)) {
            fits = false;
            break outer;
          }
        }
      }
      if (fits) return { x, y };
    }
  }
  return null;
}

export const addAnalysisToDashboardAction = defineAction({
  schema: z.object({
    context: z.enum(["monthly", "yearly"]),
    config: sandboxConfigSchema,
  }),
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    const context = input.context as DashboardContext;
    const { cols, maxRows } = GRID_CONFIG[context];

    const existing = await dashboardLayoutService.getLayout(ctx.accountId, context);

    const analysisDef = WIDGET_REGISTRY[context].find((w) => w.id === "analysis");
    if (!analysisDef) {
      throw new AppError("NOT_FOUND", `Widget analysis não disponível no contexto ${context}`);
    }
    const defaultVariant = analysisDef.sizeVariants[0];

    const nextPos = findNextFreePosition(
      existing,
      defaultVariant.w,
      defaultVariant.h,
      cols,
      maxRows,
    );
    if (!nextPos) {
      throw new AppError("CONFLICT", m.settings.dashboards.gridFull);
    }

    const newInstance: StoredWidget = {
      instanceId: crypto.randomUUID(),
      widgetId: "analysis",
      visible: true,
      x: nextPos.x,
      y: nextPos.y,
      w: defaultVariant.w,
      h: defaultVariant.h,
      sizeVariantId: defaultVariant.id,
      config: input.config,
    };

    const updated = [...existing, newInstance];
    await dashboardLayoutService.upsertLayout({ context, widgets: updated }, ctx);
    revalidatePath(`/${ctx.accountId}/dashboards`, "layout");
    revalidatePath(`/${ctx.accountId}/settings/dashboards`, "layout");
  },
});
