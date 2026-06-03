import { beforeEach, vi } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";

import type { PrismaClient } from "@prisma/client";

export const prismaMock = mockDeep<PrismaClient>() as DeepMockProxy<PrismaClient>;

vi.mock("@/server/prisma", () => ({
  prisma: prismaMock,
}));

beforeEach(() => {
  mockReset(prismaMock);
});
