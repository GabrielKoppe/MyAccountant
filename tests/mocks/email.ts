import { vi } from "vitest";

vi.mock("@/server/email/email-service", () => ({
  emailService: {
    send: vi.fn().mockResolvedValue(undefined),
  },
}));
