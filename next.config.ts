import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone para prod (Docker). Em E2E servimos via `next start`, que NÃO funciona com
  // output standalone (assets/hidratação inconsistentes → flakiness no login) — então
  // desabilitamos standalone quando E2E=true.
  output: process.env.E2E === "true" ? undefined : "standalone",
  // pino e pino-pretty precisam ser tratados como pacotes externos no servidor
  serverExternalPackages: ["pino", "pino-pretty"],
};

export default nextConfig;
