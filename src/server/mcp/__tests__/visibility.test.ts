import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/server/auth/membership", () => ({ ensureMembership: vi.fn() }));

import { ensureMembership } from "@/server/auth/membership";
import { resolveReadContext } from "@/server/mcp/visibility";

beforeEach(() => vi.clearAllMocks());

describe("resolveReadContext", () => {
  it("reconfirma membership e devolve o contexto", async () => {
    (ensureMembership as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "m1" });

    const ctx = await resolveReadContext("a1", "u1");

    expect(ensureMembership).toHaveBeenCalledWith("u1", "a1");
    expect(ctx).toEqual({ accountId: "a1", userId: "u1" });
  });
});
