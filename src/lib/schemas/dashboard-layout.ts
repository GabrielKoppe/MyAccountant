import { z } from "zod";

export const dashboardContextSchema = z.enum(["monthly", "yearly", "month_summary"]);

export type DashboardContextInput = z.infer<typeof dashboardContextSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Formato legado (spec 33) — mantido como compat shim enquanto o editor/renderer
// antigos coexistem. Será removido nas fases 2/3, junto com o resto da API antiga.
// ─────────────────────────────────────────────────────────────────────────────

export const updateDashboardLayoutSchema = z.object({
  accountId: z.string().min(1),
  context: dashboardContextSchema,
  widgets: z.array(z.string().min(1)),
});

export type UpdateDashboardLayoutInput = z.infer<typeof updateDashboardLayoutSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Formato novo (spec 36) — StoredWidget: instâncias configuráveis em grade 2D.
// Ver §7.1 da spec 36.
// ─────────────────────────────────────────────────────────────────────────────

export const storedWidgetSchema = z.object({
  instanceId: z.string().min(1),
  widgetId: z.string().min(1),
  visible: z.boolean().default(true), // false = ghost no editor; não renderizado no dashboard
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1),
  h: z.number().int().min(1),
  sizeVariantId: z.string().min(1),
  config: z.unknown().optional(), // validado contra o configSchema do widget no service
});

// accountId vem do ctx na action (multi-tenancy) — não incluso no body.
export const gridLayoutUpdateSchema = z.object({
  context: dashboardContextSchema,
  widgets: z.array(storedWidgetSchema),
});

export type StoredWidget = z.infer<typeof storedWidgetSchema>;
export type GridLayoutUpdateInput = z.infer<typeof gridLayoutUpdateSchema>;
