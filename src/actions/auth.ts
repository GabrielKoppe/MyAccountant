"use server";

import { AppError, RateLimitError } from "@/server/api/errors";
import { signOut } from "@/server/auth";
import { logger } from "@/server/logger";
import { enforceRateLimit, resetLimiter, signupLimiter } from "@/server/security/rate-limit";
import { getRequestIp } from "@/server/security/request-ip";
import { createUser, isSignupAllowed, requestPasswordReset, resetPassword } from "@/server/services/auth-service";
import { type ActionResult, actionError, actionSuccess } from "@/lib/action-result";
import { m } from "@/lib/messages";
import { requestPasswordResetSchema, resetPasswordSchema, signupSchema } from "@/lib/schemas/auth";

const log = logger.child({ module: "auth-actions" });

export async function signupAction(rawInput: unknown): Promise<ActionResult<{ userId: string }>> {
  try {
    await enforceRateLimit(signupLimiter(), `signup:${await getRequestIp()}`);
  } catch (err) {
    if (err instanceof RateLimitError) return actionError("TOO_MANY_REQUESTS", err.message);
    throw err;
  }

  const parsed = signupSchema.safeParse(rawInput);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return actionError("VALIDATION", "Dados inválidos", fieldErrors);
  }

  if (!(await isSignupAllowed(parsed.data.email))) {
    log.warn({ email: parsed.data.email }, "Signup blocked: email not in allowed list");
    return actionError("FORBIDDEN", m.auth.emailNotAllowed);
  }

  try {
    const user = await createUser(parsed.data);
    return actionSuccess({ userId: user.id });
  } catch (error) {
    if (error instanceof AppError) {
      return actionError(error.code, error.message, error.fieldErrors);
    }
    log.error({ err: error }, "Signup action failed");
    return actionError("INTERNAL", "Erro ao criar conta. Tente novamente.");
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

const GENERIC_RESET_MESSAGE =
  "Se existe uma conta com esse email, enviamos instruções de redefinição.";

export async function requestPasswordResetAction(
  rawInput: unknown,
): Promise<ActionResult<{ message: string }>> {
  const parsed = requestPasswordResetSchema.safeParse(rawInput);
  if (!parsed.success) {
    return actionSuccess({ message: GENERIC_RESET_MESSAGE });
  }

  try {
    const ip = await getRequestIp();
    await enforceRateLimit(resetLimiter(), `reset:${parsed.data.email.toLowerCase()}`);
    await enforceRateLimit(resetLimiter(), `reset-ip:${ip}`);
  } catch (err) {
    if (err instanceof RateLimitError) {
      return actionSuccess({ message: GENERIC_RESET_MESSAGE });
    }
    throw err;
  }

  try {
    await requestPasswordReset(parsed.data.email);
  } catch (error) {
    log.error({ err: error }, "Password reset request failed");
  }

  return actionSuccess({ message: GENERIC_RESET_MESSAGE });
}

export async function resetPasswordAction(rawInput: unknown): Promise<ActionResult<void>> {
  const parsed = resetPasswordSchema.safeParse(rawInput);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return actionError("VALIDATION", "Dados inválidos", fieldErrors);
  }

  try {
    await resetPassword(parsed.data.token, parsed.data.password);
    return actionSuccess(undefined);
  } catch (error) {
    if (error instanceof AppError) return actionError(error.code, error.message, error.fieldErrors);
    log.error({ err: error }, "Password reset failed");
    return actionError("INTERNAL", "Erro ao redefinir senha. Tente novamente.");
  }
}
