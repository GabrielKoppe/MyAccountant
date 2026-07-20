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

    BREVO_API_KEY: z.string().min(1),
    EMAIL_FROM: z
      .string()
      .regex(/^.+ <.+@.+>$|^.+@.+\..+$/, "EMAIL_FROM deve ser email ou 'Nome <email>'"),

    LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).optional(),

    // Lista de emails permitidos para registro, separados por vírgula.
    // Quando não definido ou vazio, qualquer email pode se cadastrar.
    ALLOWED_EMAILS: z.string().optional(),

    // ===== Rate limiting (SEC-01) — obrigatórias em produção =====
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

    // ===== MCP Connector =====
    MCP_ENABLED: z.enum(["true", "false"]).transform((v) => v === "true").default("false"),
    MCP_ISSUER_URL: z.string().url().optional(),
    MCP_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
    MCP_REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(90),

    // E2E: quando "true", neutraliza deps externas (email no-op, rate-limit off). Ver spec 58.
    E2E: z.enum(["true", "false"]).transform((v) => v === "true").default("false"),
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
    BREVO_API_KEY: process.env.BREVO_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    LOG_LEVEL: process.env.LOG_LEVEL,
    ALLOWED_EMAILS: process.env.ALLOWED_EMAILS,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    MCP_ENABLED: process.env.MCP_ENABLED,
    MCP_ISSUER_URL: process.env.MCP_ISSUER_URL,
    MCP_ACCESS_TOKEN_TTL_SECONDS: process.env.MCP_ACCESS_TOKEN_TTL_SECONDS,
    MCP_REFRESH_TOKEN_TTL_DAYS: process.env.MCP_REFRESH_TOKEN_TTL_DAYS,
    E2E: process.env.E2E,
  },

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
