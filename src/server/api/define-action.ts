import type { AccountMemberRole } from "@prisma/client";
import { z } from "zod";

import { type ActionResult, actionError, actionSuccess } from "@/lib/action-result";
import { AppError } from "@/server/api/errors";
import { requireAccountAccess } from "@/server/auth/session";
import { logger } from "@/server/logger";

export type ActionContext = {
  userId: string;
  accountId: string;
  role: AccountMemberRole;
};

type DefineActionConfig<TInput, TOutput> = {
  schema: z.ZodType<TInput>;
  requireRoles?: AccountMemberRole[];
  handler: (input: TInput, ctx: ActionContext) => Promise<TOutput>;
};

export function defineAction<TInput, TOutput>(config: DefineActionConfig<TInput, TOutput>) {
  return async (accountId: string, rawInput: unknown): Promise<ActionResult<TOutput>> => {
    try {
      const { user, member } = await requireAccountAccess(accountId);

      if (config.requireRoles && !config.requireRoles.includes(member.role)) {
        return actionError("FORBIDDEN", "Seu papel não permite esta ação");
      }

      const parsed = config.schema.safeParse(rawInput);
      if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const path = issue.path.join(".");
          if (path && !fieldErrors[path]) {
            fieldErrors[path] = issue.message;
          }
        }
        return actionError("VALIDATION", "Dados inválidos", fieldErrors);
      }

      const ctx: ActionContext = {
        userId: user.id,
        accountId,
        role: member.role,
      };

      const result = await config.handler(parsed.data, ctx);
      return actionSuccess(result);
    } catch (error) {
      if (error instanceof AppError) {
        return actionError(error.code, error.message, error.fieldErrors);
      }

      logger.error({ err: error, accountId }, "Server action failed");
      return actionError("INTERNAL", "Erro inesperado. Tente novamente.");
    }
  };
}
