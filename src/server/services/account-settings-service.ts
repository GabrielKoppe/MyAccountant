import type { ActionContext } from "@/server/api/define-action";
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";
import type { UpdateAccountSettingsInput } from "@/lib/schemas/settings";

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
