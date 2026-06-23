"use server";

import { defineAction } from "@/server/api/define-action";
import { getSandboxData } from "@/server/queries/sandbox";
import { getSandboxDataSchema } from "@/lib/schemas/sandbox";
import type { SandboxConfig } from "@/lib/schemas/sandbox";

export const getSandboxDataAction = defineAction({
  schema: getSandboxDataSchema,
  handler: async (input, ctx) => {
    const result = await getSandboxData(ctx.accountId, input.config, {
      currentMonthId: input.currentMonthId,
    });
    return {
      series: result.series,
      rows: result.rows,
      grandTotalCents: result.grandTotalCents.toString(),
    };
  },
});

// Convenience wrapper for direct client use
export async function getSandboxDataClientAction(
  accountId: string,
  config: SandboxConfig,
  currentMonthId?: string,
) {
  return getSandboxDataAction(accountId, { config, currentMonthId });
}
