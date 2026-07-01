import bcrypt from "bcryptjs";

import { ConflictError } from "@/server/api/errors";
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";
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
