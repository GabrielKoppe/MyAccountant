import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    DATABASE_URL: z.string().url(),
    DIRECT_URL: z.string().url().optional(),

    NEXTAUTH_URL: z.string().url(),
    NEXTAUTH_SECRET: z.string().min(32, "NEXTAUTH_SECRET deve ter pelo menos 32 caracteres"),

    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),

    BREVO_SMTP_USER: z.string().email(),
    BREVO_SMTP_KEY: z.string().min(1),
    EMAIL_FROM: z
      .string()
      .regex(/^.+ <.+@.+>$|^.+@.+\..+$/, "EMAIL_FROM deve ser email ou 'Nome <email>'"),

    LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).optional(),

    // Lista de emails permitidos para registro, separados por vírgula.
    // Quando não definido ou vazio, qualquer email pode se cadastrar.
    ALLOWED_EMAILS: z.string().optional(),
  },

  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
  },

  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    BREVO_SMTP_USER: process.env.BREVO_SMTP_USER,
    BREVO_SMTP_KEY: process.env.BREVO_SMTP_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    LOG_LEVEL: process.env.LOG_LEVEL,
    ALLOWED_EMAILS: process.env.ALLOWED_EMAILS,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
