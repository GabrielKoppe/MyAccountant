import { describe, expect, it, vi } from "vitest";

import { RateLimitError } from "@/server/api/errors";
import { enforceRateLimit } from "./rate-limit";

describe("enforceRateLimit", () => {
  it("no-op quando o limiter é null (Upstash não configurado)", async () => {
    await expect(enforceRateLimit(null, "k")).resolves.toBeUndefined();
  });

  it("passa quando limiter.limit retorna success=true", async () => {
    const limiter = { limit: vi.fn().mockResolvedValue({ success: true }) } as never;
    await expect(enforceRateLimit(limiter, "k")).resolves.toBeUndefined();
  });

  it("lança RateLimitError quando success=false", async () => {
    const limiter = { limit: vi.fn().mockResolvedValue({ success: false }) } as never;
    await expect(enforceRateLimit(limiter, "k")).rejects.toBeInstanceOf(RateLimitError);
  });
});
