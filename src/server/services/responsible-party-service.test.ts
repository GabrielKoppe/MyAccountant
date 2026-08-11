import { describe, expect, it } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";
import { TEST_CTX } from "@/../tests/fixtures/account";
import { AppError } from "@/server/api/errors";
import { updateResponsiblePartySchema } from "@/lib/schemas/responsible-party";
import { createTransactionSchema } from "@/lib/schemas/transaction";

import {
  archivePersonalPartyForUser,
  createResponsibleParty,
  ensurePersonalParty,
  updateResponsibleParty,
  deleteResponsibleParty,
} from "./responsible-party-service";

describe("createResponsibleParty", () => {
  it("cria responsável com N membros e os links, sempre kind 'group', escopo por accountId", async () => {
    prismaMock.accountMember.count.mockResolvedValue(2);
    prismaMock.responsibleParty.create.mockResolvedValue({ id: "party1" } as never);

    const r = await createResponsibleParty(
      {
        name: "Casal",
        icon: "home",
        color: "green",
        memberUserIds: ["user-test-1", "u2"],
      },
      TEST_CTX,
    );

    expect(r.id).toBe("party1");
    const arg = prismaMock.responsibleParty.create.mock.calls[0][0] as any;
    expect(arg.data.accountId).toBe("acc-test-1"); // multi-tenancy
    expect(arg.data.kind).toBe("group");
    expect(arg.data.icon).toBe("home");
    expect(arg.data.color).toBe("green");
    expect(arg.data.members.create).toHaveLength(2);
  });

  // "Tudo é responsável" — nascer sem membro é o caminho de "nomear alguém externo"
  // (o antigo `kind: "external""); o `kind` gravado continua sendo `group`.
  it("cria responsável sem membros (era o caminho de 'pessoa externa')", async () => {
    prismaMock.responsibleParty.create.mockResolvedValue({ id: "party2" } as never);

    await createResponsibleParty(
      { name: "Filho", icon: "child", memberUserIds: [] },
      TEST_CTX,
    );

    const arg = prismaMock.responsibleParty.create.mock.calls[0][0] as any;
    expect(arg.data.kind).toBe("group");
    expect(arg.data.members.create).toHaveLength(0);
  });

  it("rejeita responsável cujo membro não pertence à Account", async () => {
    prismaMock.accountMember.count.mockResolvedValue(1); // só 1 dos 2 é membro

    await expect(
      createResponsibleParty(
        { name: "Casal", memberUserIds: ["user-test-1", "estranho"] },
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

  it("exclui responsável comum (onDelete SetNull preserva transações)", async () => {
    prismaMock.responsibleParty.findFirst.mockResolvedValue({ kind: "group" } as never);
    prismaMock.responsibleParty.delete.mockResolvedValue({ id: "grp-1" } as never);

    await deleteResponsibleParty({ partyId: "grp-1" }, TEST_CTX);

    expect(prismaMock.responsibleParty.delete).toHaveBeenCalledWith({ where: { id: "grp-1" } });
  });
});

// Regressão: parties do backfill inicial têm id UUID (gen_random_uuid), não cuid.
// A validação de id de party deve aceitá-los (senão dá "Dados inválidos" ao
// vincular/editar o responsável de um usuário já existente).
describe("aceita id de party UUID (backfill) na validação", () => {
  const UUID = "1324c835-23bd-480d-a877-6658a3d7ab84";

  it("updateResponsiblePartySchema aceita partyId UUID", () => {
    const r = updateResponsiblePartySchema.safeParse({ partyId: UUID, color: "green" });
    expect(r.success).toBe(true);
  });

  it("createTransactionSchema aceita responsiblePartyId UUID", () => {
    const r = createTransactionSchema.safeParse({
      tableId: "cmpvfry9x0009pl10himipan7",
      occurredOn: new Date("2026-01-01"),
      amountCents: 1000n,
      isPending: false,
      isFavorite: false,
      responsiblePartyId: UUID,
    });
    expect(r.success).toBe(true);
  });
});

describe("ensurePersonalParty", () => {
  it("cria personal party com 1 vínculo quando não existe", async () => {
    prismaMock.responsibleParty.findFirst.mockResolvedValue(null);
    prismaMock.responsibleParty.create.mockResolvedValue({ id: "p-new" } as never);

    const id = await ensurePersonalParty(prismaMock, "acc-test-1", "user-x", "Fulano");

    expect(id).toBe("p-new");
    const arg = prismaMock.responsibleParty.create.mock.calls[0][0] as any;
    expect(arg.data).toMatchObject({
      accountId: "acc-test-1",
      kind: "personal",
      name: "Fulano",
      members: { create: { userId: "user-x" } },
    });
  });

  it("é idempotente: não recria se já existe ativa", async () => {
    prismaMock.responsibleParty.findFirst.mockResolvedValue({
      id: "p-existing",
      archivedAt: null,
    } as never);

    const id = await ensurePersonalParty(prismaMock, "acc-test-1", "user-x", "Fulano");

    expect(id).toBe("p-existing");
    expect(prismaMock.responsibleParty.create).not.toHaveBeenCalled();
    expect(prismaMock.responsibleParty.update).not.toHaveBeenCalled();
  });

  it("reativa a personal party arquivada quando o membro volta", async () => {
    prismaMock.responsibleParty.findFirst.mockResolvedValue({
      id: "p-arch",
      archivedAt: new Date(),
    } as never);
    prismaMock.responsibleParty.update.mockResolvedValue({ id: "p-arch" } as never);

    await ensurePersonalParty(prismaMock, "acc-test-1", "user-x", "Fulano");

    expect(prismaMock.responsibleParty.update).toHaveBeenCalledWith({
      where: { id: "p-arch" },
      data: { archivedAt: null },
    });
    expect(prismaMock.responsibleParty.create).not.toHaveBeenCalled();
  });
});

describe("archivePersonalPartyForUser", () => {
  it("arquiva a personal party do usuário na Account (escopo por tenant)", async () => {
    prismaMock.responsibleParty.updateMany.mockResolvedValue({ count: 1 } as never);

    await archivePersonalPartyForUser(prismaMock, "acc-test-1", "user-x");

    const arg = prismaMock.responsibleParty.updateMany.mock.calls[0][0] as any;
    expect(arg.where).toMatchObject({
      accountId: "acc-test-1",
      kind: "personal",
      members: { some: { userId: "user-x" } },
    });
    expect(arg.data.archivedAt).toBeInstanceOf(Date);
  });
});
