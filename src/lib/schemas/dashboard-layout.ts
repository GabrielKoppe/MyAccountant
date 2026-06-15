import { z } from "zod";

export const dashboardContextSchema = z.enum(["monthly", "yearly", "month_summary"]);

export type DashboardContextInput = z.infer<typeof dashboardContextSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Spec 36 — StoredWidget: instâncias configuráveis em grade 2D. Ver §7.1.
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
export const updateDashboardLayoutSchema = z.object({
  context: dashboardContextSchema,
  widgets: z.array(storedWidgetSchema),
});

export type StoredWidget = z.infer<typeof storedWidgetSchema>;
// z.input (não z.infer): storedWidgetSchema.visible tem .default(), então o tipo
// que `defineAction` infere para o handler é o INPUT (visible opcional). Usar
// z.input mantém o tipo do service alinhado ao da action. Ver skill server-actions.
export type UpdateDashboardLayoutInput = z.input<typeof updateDashboardLayoutSchema>;
