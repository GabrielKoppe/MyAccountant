import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { env } from "@/lib/env";
import { RateLimitError } from "@/server/api/errors";

// Init preguiçoso: o módulo NÃO acessa env no top-level (evita o guard client/server
// do @t3-oss/env-nextjs em ambientes de teste e mantém o import livre de efeitos).
let redisSingleton: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redisSingleton === undefined) {
    redisSingleton =
      env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
        ? new Redis({
            url: env.UPSTASH_REDIS_REST_URL,
            token: env.UPSTASH_REDIS_REST_TOKEN,
          })
        : null;
    // SEC-01: em produção o rate limiting é obrigatório — exceto em E2E (spec 58 DD-08).
    if (env.NODE_ENV === "production" && !env.E2E && !redisSingleton) {
      throw new Error(
        "UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN são obrigatórios em produção (SEC-01).",
      );
    }
  }
  return redisSingleton;
}

type Duration = `${number} ${"s" | "m" | "h" | "d"}`;

const cache = new Map<string, Ratelimit | null>();

function limiter(name: string, requests: number, window: Duration): Ratelimit | null {
  if (!cache.has(name)) {
    const redis = getRedis();
    cache.set(
      name,
      redis
        ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(requests, window), prefix: `rl:${name}` })
        : null,
    );
  }
  return cache.get(name) ?? null;
}

export const loginLimiter = () => limiter("login", 10, "15 m");
export const signupLimiter = () => limiter("signup", 5, "1 h");
export const inviteLimiter = () => limiter("invite", 5, "1 h");
export const resetLimiter = () => limiter("reset", 3, "1 h");

/**
 * Consome uma unidade do limiter para `key`. No-op se o limiter for null
 * (dev/test sem Upstash). Lança RateLimitError (→ 429) quando a janela estoura.
 */
export async function enforceRateLimit(
  limiter: Ratelimit | null,
  key: string,
): Promise<void> {
  if (!limiter) return;
  const { success } = await limiter.limit(key);
  if (!success) throw new RateLimitError();
}
