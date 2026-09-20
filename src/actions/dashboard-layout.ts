"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { defineAction } from "@/server/api/define-action";
import { AppError } from "@/server/api/errors";
import { revalidateDashboardLayout } from "@/server/api/revalidate";
import {
  dashboardLayoutContextOnlySchema,
  updateDashboardLayoutSchema,
} from "@/lib/schemas/dashboard-layout";
import type { StoredWidget } from "@/lib/schemas/dashboard-layout";
import { sandboxConfigSchema } from "@/lib/schemas/sandbox";
import { WIDGET_REGISTRY, GRID_CONFIG } from "@/components/dashboards/_core/widget-registry";
import type { DashboardContext } from "@/components/dashboards/_core/widget-registry";
import * as dashboardLayoutService from "@/server/services/dashboard-layout-service";
import { m } from "@/lib/messages";

const EDITOR_ROLES = ["owner", "editor"] as const;

/**
 * Autosave do editor — grava o **rascunho** (Spec 69 §2.3). A página real só
 * muda em `publishDashboardLayoutAction`.
 *
 * Sem `revalidate` de propósito: nada que é renderizado no servidor mudou, e
 * esta action dispara a cada debounce do editor.
 */
export const updateDashboardLayoutAction = defineAction({
  schema: updateDashboardLayoutSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await dashboardLayoutService.saveDraft(input, ctx);
  },
});

/** Publica o rascunho: é o único caminho que altera o que o usuário vê. */
export const publishDashboardLayoutAction = defineAction({
  schema: dashboardLayoutContextOnlySchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    const widgets = await dashboardLayoutService.publishDraft(
      input.context as DashboardContext,
      ctx,
    );
    // Invalida dashboards (RSCs cacheados), a página de settings e o hub.
    revalidateDashboardLayout(ctx.accountId);
    // O resumo do mês embute o mesmo layout dentro de `/months/[monthId]`.
    revalidatePath(`/${ctx.accountId}/months`, "layout");
    return { widgets };
  },
});

/** Descarta o rascunho e devolve o publicado — a página real fica intacta. */
export const discardDashboardLayoutAction = defineAction({
  schema: dashboardLayoutContextOnlySchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    const widgets = await dashboardLayoutService.discardDraft(
      input.context as DashboardContext,
      ctx,
    );
    return { widgets };
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

    // Spec 69 §2.3 — se houver rascunho pendente no editor, o gráfico entra NELE:
    // publicar por cima faria o usuário perder este widget ao publicar o rascunho,
    // e mexer no publicado sem ele pedir seria a mesma quebra de contrato ao contrário.
    const editorLayout = await dashboardLayoutService.getEditorLayout(ctx.accountId, context);
    const existing = editorLayout.widgets;

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
    if (editorLayout.hasDraft) {
      await dashboardLayoutService.saveDraft({ context, widgets: updated }, ctx);
      return;
    }
    await dashboardLayoutService.upsertLayout({ context, widgets: updated }, ctx);
    revalidateDashboardLayout(ctx.accountId);
  },
});
