import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // pino e pino-pretty precisam ser tratados como pacotes externos no servidor
  serverExternalPackages: ["pino", "pino-pretty", "nodemailer"],
};

export default nextConfig;
