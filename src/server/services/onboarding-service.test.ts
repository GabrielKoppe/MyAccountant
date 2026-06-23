import { describe, expect, it } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";
import { TEST_CTX } from "@/../tests/fixtures/account";


import { completeOnboarding, resetOnboarding } from "./onboarding-service";

describe("completeOnboarding", () => {
  it("deve marcar onboarding como concluído", async () => {
    prismaMock.accountSettings.update.mockResolvedValue({} as any);

    await completeOnboarding(TEST_CTX);

    expect(prismaMock.accountSettings.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { accountId: "acc-test-1" },
        data: expect.objectContaining({ onboardingCompletedAt: expect.any(Date) }),
      }),
    );
  });

  it("não deve operar em dados de outra account (segurança multi-tenancy)", async () => {
    const otherCtx = { ...TEST_CTX, accountId: "acc-OUTRA" };
    prismaMock.accountSettings.update.mockRejectedValue(new Error("Not found"));

    await expect(completeOnboarding(otherCtx)).rejects.toThrow();
  });
});

describe("resetOnboarding", () => {
  it("deve resetar onboarding (null)", async () => {
    prismaMock.accountSettings.update.mockResolvedValue({} as any);

    await resetOnboarding(TEST_CTX);

    expect(prismaMock.accountSettings.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { accountId: "acc-test-1" },
        data: { onboardingCompletedAt: null },
      }),
    );
  });
});
