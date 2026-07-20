import { ConflictError } from "@/server/api/errors";

/**
 * Rate limit por connector MCP (spec 63, Task 4.2 — base para `spec 23 SEC-01`).
 *
 * ⚠️ LIMITAÇÃO INTENCIONAL: esta é uma implementação **in-memory (por processo)**.
 * Cada instância do app (ou execução serverless) mantém seu próprio contador —
 * num deploy com múltiplas instâncias o limite efetivo vira `max * nº de
 * instâncias`, não um limite global consistente. Isso é aceitável para a fase
 * atual (single-instance / MVP do conector), mas NÃO é multi-instância-safe.
 *
 * A `spec 23 SEC-01` substituirá este módulo por um store compartilhado
 * (Upstash Redis) para rate-limit correto entre instâncias. Até lá, este é o
 * único gate de abuso do endpoint MCP.
 */

const MCP_RATE_LIMIT_MAX = 60;
const MCP_RATE_LIMIT_WINDOW_MS = 60_000;

/** `grantId` → timestamps (ms) das chamadas dentro da janela atual. */
const hitsByGrant = new Map<string, number[]>();

export interface McpRateLimitConfig {
  /** Máximo de chamadas permitidas na janela. Default: `MCP_RATE_LIMIT_MAX` (produção). */
  max?: number;
  /** Duração da janela deslizante em ms. Default: `MCP_RATE_LIMIT_WINDOW_MS` (produção). */
  windowMs?: number;
  /** Relógio injetável (epoch ms) — usado pelos testes para não depender de timers reais. */
  now?: number;
}

/**
 * Sliding-window rate limit por `grantId`. Lança `ConflictError` (código
 * `CONFLICT`) quando o connector excede `max` chamadas dentro de `windowMs`.
 *
 * Config é injetável apenas para testes — chamadas de produção usam
 * `checkMcpRateLimit(grantId)` sem segundo argumento, aplicando os defaults
 * do módulo.
 */
export function checkMcpRateLimit(grantId: string, config: McpRateLimitConfig = {}): void {
  const max = config.max ?? MCP_RATE_LIMIT_MAX;
  const windowMs = config.windowMs ?? MCP_RATE_LIMIT_WINDOW_MS;
  const now = config.now ?? Date.now();
  const windowStart = now - windowMs;

  const recentHits = (hitsByGrant.get(grantId) ?? []).filter((t) => t > windowStart);

  if (recentHits.length >= max) {
    hitsByGrant.set(grantId, recentHits);
    throw new ConflictError(
      `Limite de ${max} chamadas por ${windowMs}ms excedido para este connector MCP`,
    );
  }

  recentHits.push(now);
  hitsByGrant.set(grantId, recentHits);
}
