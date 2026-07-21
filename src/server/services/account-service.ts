import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";
import { ConflictError } from "@/server/api/errors";
import { ensurePersonalParty } from "@/server/services/responsible-party-service";
import type { CreateAccountInput } from "@/lib/schemas/account";

const log = logger.child({ module: "account-service" });

const DEFAULT_CATEGORIES = [
  { name: "Alimentação", subs: ["Mercado", "Restaurante", "Delivery"] },
  { name: "Transporte", subs: ["Combustível", "Uber/Táxi", "Manutenção"] },
  { name: "Moradia", subs: ["Aluguel", "Condomínio", "Contas"] },
  { name: "Saúde", subs: ["Plano de saúde", "Medicamentos", "Consultas"] },
  { name: "Lazer", subs: ["Streaming", "Cinema", "Viagem"] },
];

const DEFAULT_TABLE_TYPES = [
  { name: "Manual", isDefault: true, hiddenColumns: {} },
  { name: "Cartão de crédito", isDefault: false, hiddenColumns: { investmentType: true } },
  { name: "Investimentos", isDefault: false, hiddenColumns: { cardInstallment: true } },
];

export async function createAccount(input: CreateAccountInput & { createdById: string }) {
  const { name, createdById } = input;

  const duplicate = await prisma.account.findFirst({
    where: { name, members: { some: { userId: createdById } } },
    select: { id: true },
  });
  if (duplicate) {
    throw new ConflictError("Você já tem uma conta com este nome.", {
      name: "Você já tem uma conta com este nome.",
    });
  }

  const account = await prisma.$transaction(async (tx) => {
    const created = await tx.account.create({
      data: {
        name,
        createdById,
        settings: {
          create: {
            currency: "BRL",
            monthStartDay: 1,
          },
        },
        tableTypes: {
          createMany: {
            data: DEFAULT_TABLE_TYPES.map((tt) => ({
              name: tt.name,
              isDefault: tt.isDefault,
              hiddenColumns: tt.hiddenColumns,
            })),
          },
        },
        members: {
          create: { userId: createdById, role: "owner" },
        },
        sections: {
          createMany: {
            data: [
              { name: "Entradas", countType: "add", order: 0 },
              { name: "Saídas", countType: "subtract", order: 1 },
              { name: "Cartão", countType: "subtract", order: 2 },
              { name: "Investimentos", countType: "neutral", order: 3 },
            ],
          },
        },
      },
      select: { id: true, name: true },
    });

    for (const { name: catName, subs } of DEFAULT_CATEGORIES) {
      await tx.category.create({
        data: {
          accountId: created.id,
          name: catName,
          createdById,
          subcategories: {
            createMany: {
              data: subs.map((subName) => ({ accountId: created.id, name: subName })),
            },
          },
        },
      });
    }

    // Personal party do dono (Spec 60 §2) — auto-criada junto da conta.
    const owner = await tx.user.findUnique({
      where: { id: createdById },
      select: { name: true, email: true },
    });
    await ensurePersonalParty(tx, created.id, createdById, owner?.name ?? owner?.email ?? "Você");

    return created;
  });

  log.info({ accountId: account.id, userId: createdById }, "Account created with defaults");
  return account;
}

/**
 * Cria uma Account "vazia" (spec 64 DD-02, modo `new` do import): apenas
 * Account + AccountSettings (defaults) + AccountMember owner. Ao contrário de
 * `createAccount`, NÃO cria os defaults de onboarding (sections, categorias,
 * tableTypes, personal party) — eles colidiriam com o snapshot importado
 * (`@@unique([accountId, name])`).
 *
 * Se o nome colidir com uma conta que o usuário já possui, adiciona " (importado)"
 * (e um contador se ainda colidir) — evita o `ConflictError` de nome duplicado.
 */
export async function createBareAccount(userId: string, name: string): Promise<{ id: string }> {
  const existing = await prisma.account.findMany({
    where: { members: { some: { userId } } },
    select: { name: true },
  });
  const taken = new Set(existing.map((a) => a.name));

  let finalName = name;
  if (taken.has(finalName)) {
    finalName = `${name} (importado)`;
    let counter = 2;
    while (taken.has(finalName)) {
      finalName = `${name} (importado ${counter})`;
      counter += 1;
    }
  }

  const created = await prisma.account.create({
    data: {
      name: finalName,
      createdById: userId,
      settings: { create: { currency: "BRL", monthStartDay: 1 } },
      members: { create: { userId, role: "owner" } },
    },
    select: { id: true },
  });

  log.info({ accountId: created.id, userId }, "Bare account created (import)");
  return created;
}
