"use server";

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
import { revalidateMembers } from "@/server/api/revalidate";
import { requireUser } from "@/server/auth/session";
import { logger } from "@/server/logger";
import * as memberService from "@/server/services/member-service";

const log = logger.child({ module: "member-actions" });

export const inviteMemberAction = defineAction({
  schema: inviteMemberSchema,
  requireRoles: ["owner"],
  handler: async (input, ctx) => {
    const result = await memberService.inviteMember(input, ctx);
    revalidateMembers(ctx.accountId);
    return result;
  },
});

export const revokeInviteAction = defineAction({
  schema: revokeInviteSchema,
  requireRoles: ["owner"],
  handler: async (input, ctx) => {
    await memberService.revokeInvite(input, ctx);
    revalidateMembers(ctx.accountId);
  },
});

export const removeMemberAction = defineAction({
  schema: removeMemberSchema,
  requireRoles: ["owner"],
  handler: async (input, ctx) => {
    await memberService.removeMember(input, ctx);
    revalidateMembers(ctx.accountId);
  },
});

export const updateMemberRoleAction = defineAction({
  schema: updateMemberRoleSchema,
  requireRoles: ["owner"],
  handler: async (input, ctx) => {
    await memberService.updateMemberRole(input, ctx);
    revalidateMembers(ctx.accountId);
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

type InviteRef = { token?: string; inviteId?: string };

export async function acceptInviteAction(
  ref: InviteRef,
): Promise<ActionResult<{ accountId: string }>> {
  try {
    const user = await requireUser().catch(() => null);
    if (!user) return actionError("UNAUTHORIZED", "Você precisa estar logado.");

    const result = ref.inviteId
      ? await memberService.acceptInviteById(ref.inviteId, user.id)
      : await memberService.acceptInvite(ref.token ?? "", user.id);
    return actionSuccess(result);
  } catch (error) {
    if (error instanceof AppError) {
      return actionError(error.code, error.message, error.fieldErrors);
    }
    log.error({ err: error }, "Accept invite failed");
    return actionError("INTERNAL", "Erro inesperado. Tente novamente.");
  }
}

export async function declineInviteAction(ref: InviteRef): Promise<ActionResult<void>> {
  try {
    const user = await requireUser().catch(() => null);
    if (!user) return actionError("UNAUTHORIZED", "Você precisa estar logado.");

    if (ref.inviteId) await memberService.declineInviteById(ref.inviteId, user.id);
    else await memberService.declineInvite(ref.token ?? "", user.id);
    return actionSuccess(undefined);
  } catch (error) {
    if (error instanceof AppError) {
      return actionError(error.code, error.message, error.fieldErrors);
    }
    log.error({ err: error }, "Decline invite failed");
    return actionError("INTERNAL", "Erro inesperado. Tente novamente.");
  }
}
