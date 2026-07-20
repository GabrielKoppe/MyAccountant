import { describe, it, expect } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";

import { ensureMembership } from "@/server/auth/membership";
import { ForbiddenError } from "@/server/api/errors";

describe("ensureMembership", () => {
  it("lança ForbiddenError quando não é membro", async () => {
    prismaMock.accountMember.findUnique.mockResolvedValue(null);
    await expect(ensureMembership("u1", "a1")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("retorna o member quando é membro", async () => {
    prismaMock.accountMember.findUnique.mockResolvedValue({ id: "m1", role: "viewer" } as never);
    await expect(ensureMembership("u1", "a1")).resolves.toMatchObject({ id: "m1" });
  });
});
