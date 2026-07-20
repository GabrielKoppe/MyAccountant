import crypto from "crypto";

import bcrypt from "bcryptjs";

import { ConflictError, ForbiddenError } from "@/server/api/errors";
import { emailService } from "@/server/email/email-service";
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";
import { hashToken } from "@/server/security/hash-token";
import { recordAudit } from "@/server/services/audit-service";
import { passwordResetEmailTemplate, oauthOnlyResetEmailTemplate } from "@/emails";
import { env } from "@/lib/env";
import type { SignupInput } from "@/lib/schemas/auth";

const log = logger.child({ module: "auth-service" });

const BCRYPT_ROUNDS = 12;

/**
 * Verifica se um email tem permissão para se cadastrar na plataforma.
 * Quando ALLOWED_EMAILS não está definida ou está vazia, o registro é aberto.
 */
export function isEmailAllowed(email: string): boolean {
  const raw = env.ALLOWED_EMAILS;
  if (!raw) return true;
  const allowed = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) return true;
  return allowed.includes(email.toLowerCase());
}

/**
 * Verifica se há um convite pendente e não expirado para o email.
 */
export async function hasPendingInvite(email: string): Promise<boolean> {
  const invite = await prisma.accountInvite.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      status: "pending",
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  return invite !== null;
}

/**
 * Um email pode se cadastrar se estiver na allowlist OU se tiver um convite pendente.
 * Convite pendente libera o acesso mesmo fora de `ALLOWED_EMAILS` — senão o convidado
 * externo nunca conseguiria aceitar o convite.
 */
export async function isSignupAllowed(email: string): Promise<boolean> {
  if (isEmailAllowed(email)) return true;
  return hasPendingInvite(email);
}

export async function createUser(input: SignupInput) {
  const { name, email, password } = input;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ConflictError("Este email já está cadastrado.", {
      email: "Este email já está cadastrado.",
    });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      settings: {
        create: {
          theme: "system",
          locale: "pt-BR",
          timezone: "America/Sao_Paulo",
        },
      },
    },
    select: { id: true, email: true, name: true },
  });

  log.info({ userId: user.id }, "User created");
  return user;
}

export async function verifyPassword(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, image: true, passwordHash: true },
  });

  if (!user?.passwordHash) return null;

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;

  return { id: user.id, email: user.email, name: user.name, image: user.image };
}

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1h (SEC-09)

/**
 * SEC-09: solicita reset de senha. SEMPRE silencioso (anti-enumeração) — a
 * diferenciação acontece só no conteúdo do email.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true },
  });

  if (!user) {
    log.info({ email: "[hidden]" }, "Password reset requested for unknown email");
    return;
  }

  if (!user.passwordHash) {
    void emailService.send({
      to: user.email,
      template: oauthOnlyResetEmailTemplate,
      props: {},
    });
    log.info({ userId: user.id }, "Password reset requested for OAuth-only account");
    return;
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  const resetUrl = `${env.NEXT_PUBLIC_APP_URL}/reset-password?token=${rawToken}`;
  void emailService.send({
    to: user.email,
    template: passwordResetEmailTemplate,
    props: { resetUrl, expiresInMinutes: 60 },
  });
  log.info({ userId: user.id }, "Password reset email sent");
}

/**
 * SEC-09: redefine a senha a partir do token raw. Uso único + expiração.
 * Invalida sessões antigas via passwordChangedAt (checado em requireUser).
 */
export async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new ForbiddenError("Link de redefinição inválido ou expirado.");
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: record.userId },
      data: { passwordHash, passwordChangedAt: now },
    });
    await tx.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: now },
    });
    await tx.passwordResetToken.deleteMany({
      where: { userId: record.userId, usedAt: null, id: { not: record.id } },
    });
  });

  // SEC-08a: audita o reset em cada Account de que o usuário é membro.
  const memberships = await prisma.accountMember.findMany({
    where: { userId: record.userId },
    select: { accountId: true },
  });
  for (const { accountId } of memberships) {
    void recordAudit({
      accountId,
      actorUserId: record.userId,
      action: "auth.password_reset",
      targetType: "user",
      targetId: record.userId,
    });
  }

  log.info({ userId: record.userId }, "Password reset completed");
}
