import type { ForecastSettings } from "@/lib/schemas/forecast";
import type { UpdateAccountSettingsInput } from "@/lib/schemas/settings";
import type { ActionContext } from "@/server/api/define-action";
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";

const log = logger.child({ module: "account-settings-service" });

export async function updateAccountSettings(input: UpdateAccountSettingsInput, ctx: ActionContext) {
  const {
    accountName,
    currency,
    monthStartDay,
    defaultResponsiblePartyId,
    invertSignOnMoveByDefault,
  } = input;

  await prisma.$transaction([
    prisma.account.update({
      where: { id: ctx.accountId },
      data: { name: accountName },
    }),
    prisma.accountSettings.update({
      where: { accountId: ctx.accountId },
      data: {
        currency,
        monthStartDay,
        defaultResponsiblePartyId: defaultResponsiblePartyId ?? null,
        invertSignOnMoveByDefault,
      },
    }),
  ]);

  log.info({ accountId: ctx.accountId }, "Account settings updated");
}

export async function updateForecastSettings(input: ForecastSettings, ctx: ActionContext) {
  await prisma.accountSettings.update({
    where: { accountId: ctx.accountId },
    data: {
      forecastHorizonMonths: input.forecastHorizonMonths,
      forecastScenario: input.forecastScenario,
      forecastOptimisticPct: input.forecastOptimisticPct,
      forecastConservativePct: input.forecastConservativePct,
      forecastVariableWindow: input.forecastVariableWindow,
      forecastStartBalanceCents: input.forecastStartBalanceCents,
    },
  });

  log.info({ accountId: ctx.accountId }, "Forecast settings updated");
}
