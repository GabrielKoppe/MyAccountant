"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { type ActionResult, actionError, actionSuccess } from "@/lib/action-result";
import {
  inviteMemberSchema,
  removeMemberSchema,
  revokeInviteSchema,
  updateMemberRoleSchema,
} from "@/lib/schemas/account";
import { AppError } from "@/server/api/errors";
import { defineAction } from "@/server/api/define-action";
import { requireUser } from "@/server/auth/session";
import { logger } from "@/server/logger";
import * as memberService from "@/server/services/member-service";

const log = logger.child({ module: "member-actions" });

export const inviteMemberAction = defineAction({
  schema: inviteMemberSchema,
  requireRoles: ["owner"],
  handler: async (input, ctx) => {
    const result = await memberService.inviteMember(input, ctx);
    revalidatePath(`/${ctx.accountId}/settings/members`);
    return result;
  },
});

export const revokeInviteAction = defineAction({
  schema: revokeInviteSchema,
  requireRoles: ["owner"],
  handler: async (input, ctx) => {
    await memberService.revokeInvite(input, ctx);
    revalidatePath(`/${ctx.accountId}/settings/members`);
  },
});

export const removeMemberAction = defineAction({
  schema: removeMemberSchema,
  requireRoles: ["owner"],
  handler: async (input, ctx) => {
    await memberService.removeMember(input, ctx);
    revalidatePath(`/${ctx.accountId}/settings/members`);
  },
});

export const updateMemberRoleAction = defineAction({
  schema: updateMemberRoleSchema,
  requireRoles: ["owner"],
  handler: async (input, ctx) => {
    await memberService.updateMemberRole(input, ctx);
    revalidatePath(`/${ctx.accountId}/settings/members`);
  },
});

export const leaveAccountAction = defineAction({
  schema: z.object({}),
  handler: async (_, ctx) => {
    await memberService.leaveAccount(ctx);
  },
});

export const deleteAccountAction = defineAction({
  schema: z.object({}),
  requireRoles: ["owner"],
  handler: async (_, ctx) => {
    await memberService.deleteAccount(ctx);
  },
});

export async function acceptInviteAction(
  token: string,
): Promise<ActionResult<{ accountId: string }>> {
  try {
    const user = await requireUser().catch(() => null);
    if (!user) return actionError("UNAUTHORIZED", "Você precisa estar logado.");

    const result = await memberService.acceptInvite(token, user.id);
    return actionSuccess(result);
  } catch (error) {
    if (error instanceof AppError) {
      return actionError(error.code, error.message, error.fieldErrors);
    }
    log.error({ err: error, token }, "Accept invite failed");
    return actionError("INTERNAL", "Erro inesperado. Tente novamente.");
  }
}

export async function declineInviteAction(token: string): Promise<ActionResult<void>> {
  try {
    const user = await requireUser().catch(() => null);
    if (!user) return actionError("UNAUTHORIZED", "Você precisa estar logado.");

    await memberService.declineInvite(token, user.id);
    return actionSuccess(undefined);
  } catch (error) {
    if (error instanceof AppError) {
      return actionError(error.code, error.message, error.fieldErrors);
    }
    log.error({ err: error, token }, "Decline invite failed");
    return actionError("INTERNAL", "Erro inesperado. Tente novamente.");
  }
}
