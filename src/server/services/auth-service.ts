import bcrypt from "bcryptjs";

import { ConflictError } from "@/server/api/errors";
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";
import type { SignupInput } from "@/lib/schemas/auth";

const log = logger.child({ module: "auth-service" });

const BCRYPT_ROUNDS = 12;

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
