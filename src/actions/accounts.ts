"use server";

import { AppError } from "@/server/api/errors";
import { logger } from "@/server/logger";
import { requireUser } from "@/server/auth/session";
import { createAccount } from "@/server/services/account-service";
import { type ActionResult, actionError, actionSuccess } from "@/lib/action-result";
import { createAccountSchema } from "@/lib/schemas/account";

const log = logger.child({ module: "account-actions" });

export async function createAccountAction(
  rawInput: unknown,
): Promise<ActionResult<{ accountId: string }>> {
  const user = await requireUser().catch(() => null);
  if (!user) return actionError("UNAUTHORIZED", "Você precisa estar logado.");

  const parsed = createAccountSchema.safeParse(rawInput);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return actionError("VALIDATION", "Dados inválidos", fieldErrors);
  }

  try {
    const account = await createAccount({ ...parsed.data, createdById: user.id });
    return actionSuccess({ accountId: account.id });
  } catch (error) {
    if (error instanceof AppError) {
      return actionError(error.code, error.message, error.fieldErrors);
    }
    log.error({ err: error }, "Create account action failed");
    return actionError("INTERNAL", "Erro ao criar conta. Tente novamente.");
  }
}
