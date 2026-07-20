import type { DefaultSession, NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

import { env } from "@/lib/env";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      loginAt?: number;
    } & DefaultSession["user"];
  }
}

// Edge-compatible — sem Prisma nem bcrypt.
// Usado pelo middleware. A verificação real de credenciais fica em index.ts (Node.js).
export const authConfig = {
  providers: [
    Google({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize() {
        return null;
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
        token.loginAt = Date.now();
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.loginAt = typeof token.loginAt === "number" ? token.loginAt : undefined;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
