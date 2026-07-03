import { describe, expect, it } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";
import { TEST_CTX } from "@/../tests/fixtures/account";
import { AppError } from "@/server/api/errors";

import {
  createResponsibleParty,
  updateResponsibleParty,
  deleteResponsibleParty,
} from "./responsible-party-service";

describe("createResponsibleParty", () => {
  it("cria party group com >= 2 membros e os links, escopo por accountId", async () => {
    prismaMock.accountMember.count.mockResolvedValue(2);
    prismaMock.responsibleParty.create.mockResolvedValue({ id: "party1" } as never);

    const r = await createResponsibleParty(
      { kind: "group", name: "Casal", icon: "🏠", memberUserIds: ["user-test-1", "u2"] },
      TEST_CTX,
    );

    expect(r.id).toBe("party1");
    const arg = prismaMock.responsibleParty.create.mock.calls[0][0] as any;
    expect(arg.data.accountId).toBe("acc-test-1"); // multi-tenancy
    expect(arg.data.kind).toBe("group");
    expect(arg.data.members.create).toHaveLength(2);
  });

  it("cria party external sem membros", async () => {
    prismaMock.responsibleParty.create.mockResolvedValue({ id: "party2" } as never);

    await createResponsibleParty({ kind: "external", name: "Filho", icon: "👶" }, TEST_CTX);

    const arg = prismaMock.responsibleParty.create.mock.calls[0][0] as any;
    expect(arg.data.kind).toBe("external");
    expect(arg.data.members).toBeUndefined();
  });

  it("rejeita group cujo membro não pertence à Account", async () => {
    prismaMock.accountMember.count.mockResolvedValue(1); // só 1 dos 2 é membro

    await expect(
      createResponsibleParty(
        { kind: "group", name: "Casal", memberUserIds: ["user-test-1", "estranho"] },
        TEST_CTX,
      ),
    ).rejects.toBeInstanceOf(AppError);
  });
});

describe("updateResponsibleParty", () => {
  it("rejeita party de outra Account (multi-tenancy)", async () => {
    prismaMock.responsibleParty.findFirst.mockResolvedValue(null);

    await expect(
      updateResponsibleParty({ partyId: "other-acc-party", name: "x" }, TEST_CTX),
    ).rejects.toBeInstanceOf(AppError);
  });
});

describe("deleteResponsibleParty", () => {
  it("rejeita excluir party personal", async () => {
    prismaMock.responsibleParty.findFirst.mockResolvedValue({ kind: "personal" } as never);

    await expect(
      deleteResponsibleParty({ partyId: "personal-party" }, TEST_CTX),
    ).rejects.toBeInstanceOf(AppError);
  });
});
