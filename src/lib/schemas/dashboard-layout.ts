import { z } from "zod";

export const dashboardContextSchema = z.enum(["monthly", "yearly", "month_summary"]);

export type DashboardContextInput = z.infer<typeof dashboardContextSchema>;

export const updateDashboardLayoutSchema = z.object({
  accountId: z.string().min(1),
  context: dashboardContextSchema,
  widgets: z.array(z.string().min(1)),
});

export type UpdateDashboardLayoutInput = z.infer<typeof updateDashboardLayoutSchema>;
