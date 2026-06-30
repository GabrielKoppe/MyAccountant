import bcrypt from "bcryptjs";
import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

import { env } from "@/lib/env";
import { loginSchema } from "@/lib/schemas/auth";
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";
import { isEmailAllowed } from "@/server/services/auth-service";
import { authConfig } from "./config";

const baseAdapter = PrismaAdapter(prisma);

// O schema renomeia Account -> OAuthAccount para evitar conflito com o dominio.
// Os metodos abaixo sobrescrevem os do PrismaAdapter que referenciam prisma.account.
const adapter = {
  ...baseAdapter,
  getUserByAccount: async ({
    provider,
    providerAccountId,
  }: {
    provider: string;
    providerAccountId: string;
  }) => {
    const record = await prisma.oAuthAccount.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId } },
      include: { user: true },
    });
    return record?.user ?? null;
  },
  linkAccount: async (data: Record<string, unknown>) => {
    await prisma.oAuthAccount.create({ data: data as never });
  },
  unlinkAccount: async ({
    provider,
    providerAccountId,
  }: {
    provider: string;
    providerAccountId: string;
  }) => {
    await prisma.oAuthAccount.delete({
      where: { provider_providerAccountId: { provider, providerAccountId } },
    });
  },
  getAccount: async (providerAccountId: string, provider: string) => {
    return prisma.oAuthAccount.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId } },
    });
  },
  createAccount: async (data: Record<string, unknown>) => {
    return prisma.oAuthAccount.create({ data: data as never });
  },
};

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  // Cast necessario pelo rename Account -> OAuthAccount no schema Prisma
  adapter: adapter as ReturnType<typeof PrismaAdapter>,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email as string },
          select: { id: true, email: true, name: true, image: true, passwordHash: true },
        });

        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) {
          logger.warn({ email: parsed.data.email }, "Invalid login attempt");
          return null;
        }

        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
    Google({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      // Bloquear Google OAuth se o email não estiver na lista permitida
      if (account?.provider === "google" && user.email && !isEmailAllowed(user.email)) {
        logger.warn({ email: user.email }, "Google sign-in blocked: email not in allowed list");
        return "/login?error=EmailNotAllowed";
      }
      return true;
    },
  },
  events: {
    async createUser({ user }: { user: { id?: string } }) {
      if (user.id) {
        await prisma.userSettings
          .upsert({
            where: { userId: user.id },
            update: {},
            create: { userId: user.id },
          })
          .catch((err: unknown) =>
            logger.error({ err, userId: user.id }, "Failed to create user settings"),
          );
      }
    },
  },
});
