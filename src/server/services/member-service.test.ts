import { describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";
import { buildAccountInvite } from "@/../tests/fixtures/account";
import { TEST_CTX } from "@/../tests/fixtures/account";
import { ConflictError, ForbiddenError, NotFoundError } from "@/server/api/errors";

import {
  acceptInvite,
  inviteMember,
  leaveAccount,
  removeMember,
  revokeInvite,
  updateMemberRole,
} from "./member-service";

vi.mock("@/server/email/email-service", () => ({
  emailService: { send: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock("@/emails", () => ({
  inviteEmailTemplate: {},
}));

describe("inviteMember", () => {
  it("deve criar convite e disparar email", async () => {
    prismaMock.account.findUnique.mockResolvedValue({ name: "Conta Teste" } as any);
    prismaMock.accountMember.findFirst.mockResolvedValue(null);
    prismaMock.accountInvite.findFirst.mockResolvedValue(null);
    prismaMock.user.findUnique.mockResolvedValue({ name: "Convidador", email: "host@test.com" } as any);
    prismaMock.accountInvite.create.mockResolvedValue({ id: "invite-novo-1" } as any);

    const result = await inviteMember({ email: "novo@test.com", role: "editor" }, TEST_CTX);

    expect(result.inviteId).toBe("invite-novo-1");
    expect(prismaMock.accountInvite.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "novo@test.com",
          role: "editor",
          accountId: "acc-test-1",
          invitedById: "user-test-1",
        }),
      }),
    );
  });

  it("deve lançar ConflictError se usuário já é membro da account", async () => {
    prismaMock.account.findUnique.mockResolvedValue({ name: "Conta" } as any);
    prismaMock.accountMember.findFirst.mockResolvedValue({ id: "member-existente" } as any);

    await expect(
      inviteMember({ email: "existente@test.com", role: "editor" }, TEST_CTX),
    ).rejects.toThrow(ConflictError);
  });

  it("deve lançar ConflictError se já há convite pendente para o email", async () => {
    prismaMock.account.findUnique.mockResolvedValue({ name: "Conta" } as any);
    prismaMock.accountMember.findFirst.mockResolvedValue(null);
    prismaMock.accountInvite.findFirst.mockResolvedValue({ id: "invite-pendente" } as any);

    await expect(
      inviteMember({ email: "pendente@test.com", role: "editor" }, TEST_CTX),
    ).rejects.toThrow(ConflictError);
  });
});

describe("revokeInvite", () => {
  it("deve revogar convite pendente com sucesso", async () => {
    prismaMock.accountInvite.findUnique.mockResolvedValue(
      buildAccountInvite({ id: "invite-1", accountId: "acc-test-1", status: "pending" }) as any,
    );
    prismaMock.accountInvite.update.mockResolvedValue({} as any);

    await revokeInvite({ inviteId: "invite-1" }, TEST_CTX);

    expect(prismaMock.accountInvite.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "revoked" } }),
    );
  });

  it("não deve revogar convite de outra account (segurança multi-tenancy)", async () => {
    prismaMock.accountInvite.findUnique.mockResolvedValue(
      buildAccountInvite({ accountId: "acc-OUTRA" }) as any,
    );

    await expect(revokeInvite({ inviteId: "invite-1" }, TEST_CTX)).rejects.toThrow(NotFoundError);
  });

  it("deve lançar ConflictError se convite não está mais pendente", async () => {
    prismaMock.accountInvite.findUnique.mockResolvedValue(
      buildAccountInvite({ accountId: "acc-test-1", status: "accepted" }) as any,
    );

    await expect(revokeInvite({ inviteId: "invite-1" }, TEST_CTX)).rejects.toThrow(ConflictError);
  });
});

describe("acceptInvite", () => {
  it("deve criar membro e marcar convite como aceito", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ email: "novo@test.com" } as any);
    prismaMock.accountInvite.findUnique.mockResolvedValue({
      ...buildAccountInvite(),
      email: "novo@test.com",
      status: "pending",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      account: { id: "acc-test-1", name: "Conta" },
    } as any);
    prismaMock.accountMember.findUnique.mockResolvedValue(null);
    prismaMock.accountMember.create.mockResolvedValue({} as any);
    prismaMock.accountInvite.update.mockResolvedValue({} as any);
    prismaMock.$transaction.mockResolvedValue([{}, {}]);

    const result = await acceptInvite("token-valido", "user-novo");

    expect(result.accountId).toBe("acc-test-1");
  });

  it("deve lançar ForbiddenError se convite expirou", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ email: "novo@test.com" } as any);
    prismaMock.accountInvite.findUnique.mockResolvedValue({
      ...buildAccountInvite(),
      email: "novo@test.com",
      status: "pending",
      expiresAt: new Date(Date.now() - 1000), // expirado
      account: { id: "acc-test-1", name: "Conta" },
    } as any);

    await expect(acceptInvite("token-expirado", "user-novo")).rejects.toThrow(ForbiddenError);
  });

  it("deve lançar ForbiddenError se email do usuário não corresponde ao convite", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ email: "outro@test.com" } as any);
    prismaMock.accountInvite.findUnique.mockResolvedValue({
      ...buildAccountInvite(),
      email: "convidado@test.com",
      status: "pending",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      account: { id: "acc-test-1", name: "Conta" },
    } as any);

    await expect(acceptInvite("token-valido", "user-outro")).rejects.toThrow(ForbiddenError);
  });

  it("deve lançar ForbiddenError se convite já foi usado", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ email: "novo@test.com" } as any);
    prismaMock.accountInvite.findUnique.mockResolvedValue({
      ...buildAccountInvite(),
      email: "novo@test.com",
      status: "accepted",
      account: { id: "acc-test-1", name: "Conta" },
    } as any);

    await expect(acceptInvite("token-usado", "user-novo")).rejects.toThrow(ForbiddenError);
  });
});

describe("removeMember", () => {
  it("deve remover membro editor com sucesso", async () => {
    prismaMock.accountMember.findUnique.mockResolvedValue({
      role: "editor",
      accountId: "acc-test-1",
      userId: "user-alvo",
    } as any);
    prismaMock.accountMember.delete.mockResolvedValue({} as any);

    await removeMember({ targetUserId: "user-alvo" }, TEST_CTX);

    expect(prismaMock.accountMember.delete).toHaveBeenCalled();
  });

  it("deve lançar ForbiddenError ao tentar remover a si mesmo", async () => {
    // targetUserId === ctx.userId
    await expect(
      removeMember({ targetUserId: "user-test-1" }, TEST_CTX),
    ).rejects.toThrow(ForbiddenError);
  });

  it("deve lançar ForbiddenError ao tentar remover o último owner", async () => {
    prismaMock.accountMember.findUnique.mockResolvedValue({
      role: "owner",
      accountId: "acc-test-1",
      userId: "user-alvo",
    } as any);
    prismaMock.accountMember.count.mockResolvedValue(1); // apenas 1 owner

    await expect(removeMember({ targetUserId: "user-alvo" }, TEST_CTX)).rejects.toThrow(
      ForbiddenError,
    );
  });

  it("deve permitir remover owner quando há outros owners", async () => {
    prismaMock.accountMember.findUnique.mockResolvedValue({
      role: "owner",
      accountId: "acc-test-1",
      userId: "user-alvo",
    } as any);
    prismaMock.accountMember.count.mockResolvedValue(2); // 2 owners
    prismaMock.accountMember.delete.mockResolvedValue({} as any);

    await removeMember({ targetUserId: "user-alvo" }, TEST_CTX);

    expect(prismaMock.accountMember.delete).toHaveBeenCalled();
  });
});

describe("updateMemberRole", () => {
  it("deve atualizar papel de editor para viewer", async () => {
    prismaMock.accountMember.findUnique.mockResolvedValue({
      role: "editor",
      accountId: "acc-test-1",
    } as any);
    prismaMock.accountMember.update.mockResolvedValue({} as any);

    await updateMemberRole({ targetUserId: "user-alvo", role: "viewer" }, TEST_CTX);

    expect(prismaMock.accountMember.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { role: "viewer" } }),
    );
  });

  it("deve lançar ForbiddenError ao rebaixar o último owner", async () => {
    prismaMock.accountMember.findUnique.mockResolvedValue({ role: "owner" } as any);
    prismaMock.accountMember.count.mockResolvedValue(1);

    await expect(
      updateMemberRole({ targetUserId: "user-alvo", role: "editor" }, TEST_CTX),
    ).rejects.toThrow(ForbiddenError);
  });

  it("deve lançar NotFoundError se membro não existe na account", async () => {
    prismaMock.accountMember.findUnique.mockResolvedValue(null);

    await expect(
      updateMemberRole({ targetUserId: "user-inexistente", role: "editor" }, TEST_CTX),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("leaveAccount", () => {
  it("deve remover o próprio usuário da account (editor)", async () => {
    prismaMock.accountMember.findUnique.mockResolvedValue({ role: "editor" } as any);
    prismaMock.accountMember.delete.mockResolvedValue({} as any);

    await leaveAccount(TEST_CTX);

    expect(prismaMock.accountMember.delete).toHaveBeenCalled();
  });

  it("deve lançar ForbiddenError se único owner tentar sair com outros membros", async () => {
    prismaMock.accountMember.findUnique.mockResolvedValue({ role: "owner" } as any);
    prismaMock.accountMember.count
      .mockResolvedValueOnce(1) // ownerCount = 1
      .mockResolvedValueOnce(3); // totalMembers = 3

    await expect(leaveAccount(TEST_CTX)).rejects.toThrow(ForbiddenError);
  });

  it("deve lançar ForbiddenError se único owner e único membro tentar sair", async () => {
    prismaMock.accountMember.findUnique.mockResolvedValue({ role: "owner" } as any);
    prismaMock.accountMember.count
      .mockResolvedValueOnce(1) // ownerCount = 1
      .mockResolvedValueOnce(1); // totalMembers = 1

    await expect(leaveAccount(TEST_CTX)).rejects.toThrow(ForbiddenError);
  });
});
