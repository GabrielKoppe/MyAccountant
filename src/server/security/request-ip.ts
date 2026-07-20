import { headers } from "next/headers";

/**
 * IP do cliente a partir dos headers de proxy. Usado como chave de rate limit
 * em Server Actions (SEC-01). Retorna "unknown" se nenhum header estiver presente.
 */
export async function getRequestIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}
