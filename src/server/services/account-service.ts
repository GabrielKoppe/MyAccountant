import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";
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

    return created;
  });

  log.info({ accountId: account.id, userId: createdById }, "Account created with defaults");
  return account;
}
