import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";
import { ConflictError } from "@/server/api/errors";

import { createUser, verifyPassword } from "./auth-service";

// vi.hoisted permite usar as fns mock na factory e nos testes sem problemas de hoisting
const mockHash = vi.hoisted(() => vi.fn());
const mockCompare = vi.hoisted(() => vi.fn());

vi.mock("bcryptjs", () => ({
  default: { hash: mockHash, compare: mockCompare },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockHash.mockResolvedValue("$2b$12$hashedpassword");
  mockCompare.mockResolvedValue(true);
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
    prismaMock.user.create.mockResolvedValue({ id: "user-1", email: "test@test.com", name: "T" } as any);

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
