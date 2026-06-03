import { vi } from "vitest";

vi.mock("@/server/auth/session", () => ({
  requireUser: vi.fn().mockResolvedValue({
    id: "user-test-1",
    email: "test@example.com",
    name: "Test User",
  }),
  requireAccountAccess: vi.fn().mockImplementation(async (accountId: string) => ({
    user: { id: "user-test-1", email: "test@example.com", name: "Test User" },
    member: { accountId, userId: "user-test-1", role: "owner" as const },
  })),
}));
