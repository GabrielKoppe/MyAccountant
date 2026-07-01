import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";
import { ConflictError } from "@/server/api/errors";

import { createUser, hasPendingInvite, isSignupAllowed, verifyPassword } from "./auth-service";

// vi.hoisted permite usar as fns mock na factory e nos testes sem problemas de hoisting
const mockHash = vi.hoisted(() => vi.fn());
const mockCompare = vi.hoisted(() => vi.fn());
const envMock = vi.hoisted(() => ({ ALLOWED_EMAILS: undefined as string | undefined }));

vi.mock("bcryptjs", () => ({
  default: { hash: mockHash, compare: mockCompare },
}));
vi.mock("@/lib/env", () => ({ env: envMock }));

beforeEach(() => {
  vi.clearAllMocks();
  mockHash.mockResolvedValue("$2b$12$hashedpassword");
  mockCompare.mockResolvedValue(true);
  envMock.ALLOWED_EMAILS = undefined;
});

describe("createUser", () => {
  it("deve criar usuário com UserSettings padrão", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({
      id: "user-new-1",
      email: "novo@test.com",
      name: "Novo Usuário",
    } as any);

    const result = await createUser({
      name: "Novo Usuário",
      email: "novo@test.com",
      password: "senha123",
    });

    expect(result.id).toBe("user-new-1");
    expect(result.email).toBe("novo@test.com");
    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "novo@test.com",
          name: "Novo Usuário",
          settings: expect.objectContaining({ create: expect.anything() }),
        }),
      }),
    );
  });

  it("deve fazer hash da senha antes de salvar", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({
      id: "user-1",
      email: "test@test.com",
      name: "T",
    } as any);

    await createUser({ name: "T", email: "test@test.com", password: "minhasenha" });

    expect(mockHash).toHaveBeenCalledWith("minhasenha", 12);
    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ passwordHash: "$2b$12$hashedpassword" }),
      }),
    );
  });

  it("deve lançar ConflictError se email já está cadastrado", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "user-existente" } as any);

    await expect(
      createUser({ name: "Test", email: "existente@test.com", password: "senha" }),
    ).rejects.toThrow(ConflictError);
  });
});

describe("verifyPassword", () => {
  it("deve retornar dados do usuário quando credenciais válidas", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "user@test.com",
      name: "User",
      image: null,
      passwordHash: "$2b$12$hashedpassword",
    } as any);

    const result = await verifyPassword("user@test.com", "senhaCorreta");

    expect(result).not.toBeNull();
    expect(result?.id).toBe("user-1");
    expect(result?.email).toBe("user@test.com");
  });

  it("deve retornar null quando usuário não existe", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const result = await verifyPassword("naoexiste@test.com", "senha");

    expect(result).toBeNull();
  });

  it("deve retornar null quando senha está incorreta", async () => {
    mockCompare.mockResolvedValueOnce(false);
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "user@test.com",
      name: "User",
      image: null,
      passwordHash: "$2b$12$hashedpassword",
    } as any);

    const result = await verifyPassword("user@test.com", "senhaErrada");

    expect(result).toBeNull();
  });

  it("deve retornar null para usuário OAuth sem passwordHash", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "oauth@test.com",
      passwordHash: null,
    } as any);

    const result = await verifyPassword("oauth@test.com", "qualquersenha");

    expect(result).toBeNull();
    expect(mockCompare).not.toHaveBeenCalled();
  });
});

describe("hasPendingInvite", () => {
  it("deve retornar true quando existe convite pendente e não expirado", async () => {
    prismaMock.accountInvite.findFirst.mockResolvedValue({ id: "invite-1" } as any);

    await expect(hasPendingInvite("convidado@test.com")).resolves.toBe(true);
  });

  it("deve retornar false quando não há convite pendente", async () => {
    prismaMock.accountInvite.findFirst.mockResolvedValue(null);

    await expect(hasPendingInvite("qualquer@test.com")).resolves.toBe(false);
  });
});

describe("isSignupAllowed", () => {
  it("libera qualquer email quando ALLOWED_EMAILS não está definida", async () => {
    envMock.ALLOWED_EMAILS = undefined;

    await expect(isSignupAllowed("qualquer@test.com")).resolves.toBe(true);
    expect(prismaMock.accountInvite.findFirst).not.toHaveBeenCalled();
  });

  it("libera email presente na allowlist sem consultar convites", async () => {
    envMock.ALLOWED_EMAILS = "permitido@test.com";

    await expect(isSignupAllowed("permitido@test.com")).resolves.toBe(true);
    expect(prismaMock.accountInvite.findFirst).not.toHaveBeenCalled();
  });

  it("libera email fora da allowlist quando há convite pendente", async () => {
    envMock.ALLOWED_EMAILS = "permitido@test.com";
    prismaMock.accountInvite.findFirst.mockResolvedValue({ id: "invite-1" } as any);

    await expect(isSignupAllowed("convidado@test.com")).resolves.toBe(true);
  });

  it("bloqueia email fora da allowlist e sem convite", async () => {
    envMock.ALLOWED_EMAILS = "permitido@test.com";
    prismaMock.accountInvite.findFirst.mockResolvedValue(null);

    await expect(isSignupAllowed("estranho@test.com")).resolves.toBe(false);
  });
});
