import { describe, expect, it } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";
import { TEST_CTX } from "@/../tests/fixtures/account";

import { updateAccountSettings } from "./account-settings-service";

describe("updateAccountSettings", () => {
  const baseInput = {
    accountName: "Minha Conta",
    currency: "BRL" as const,
    monthStartDay: 1,
    defaultResponsibleUserId: null,
    invertSignOnMoveByDefault: false,
  };

  it("deve persistir invertSignOnMoveByDefault em AccountSettings (spec 59)", async () => {
    prismaMock.$transaction.mockResolvedValue([] as any);

    await updateAccountSettings(baseInput, TEST_CTX);

    // $transaction recebe um array com account.update e accountSettings.update
    expect(prismaMock.accountSettings.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { accountId: "acc-test-1" },
        data: expect.objectContaining({ invertSignOnMoveByDefault: false }),
      }),
    );
  });

  it("deve restringir o update por accountId do contexto (multi-tenancy)", async () => {
    prismaMock.$transaction.mockResolvedValue([] as any);

    await updateAccountSettings({ ...baseInput, invertSignOnMoveByDefault: true }, TEST_CTX);

    expect(prismaMock.account.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "acc-test-1" } }),
    );
    expect(prismaMock.accountSettings.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { accountId: "acc-test-1" },
        data: expect.objectContaining({ invertSignOnMoveByDefault: true }),
      }),
    );
  });
});
