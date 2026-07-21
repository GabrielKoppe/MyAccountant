import { PrismaClient } from "@prisma/client";
import { assertSafeSeedTarget } from "./seed-guard";

const prisma = new PrismaClient();

async function main() {
  assertSafeSeedTarget();

  console.log("Seeding database...");

  // Reset via cascade: account.deleteMany() apaga (onDelete: Cascade) todo dado account-scoped
  // (sections, months, finance_tables, transactions, categories, subcategories, institutions,
  // budgets, installment_groups, pending_installments, balance_accounts, balance_snapshots,
  // account_settings, account_members, account_invites, etc. — ver schema.prisma).
  // Verificado no schema: nenhuma FK aponta para Account com onDelete: Restrict, e toda FK
  // onDelete: Restrict (para User ou Section) está numa tabela que é ela própria account-scoped
  // e já é cascade-deletada junto com o account (Postgres checa constraints não-deferráveis ao
  // fim do statement, então o cascade inteiro resolve antes da checagem de Restrict).
  await prisma.account.deleteMany();
  // Neste ponto nenhuma linha aponta para User com onDelete: Restrict (todas eram account-scoped
  // e já foram cascade-deletadas acima) — user.deleteMany() cascade limpa sessions/oauth/user_settings.
  await prisma.user.deleteMany();

  const user = await prisma.user.create({
    data: {
      email: "dev@example.com",
      name: "Dev User",
      settings: { create: { theme: "system", locale: "pt-BR", timezone: "America/Sao_Paulo" } },
    },
  });

  const account = await prisma.account.create({
    data: {
      name: "Minha Conta",
      createdById: user.id,
      settings: { create: { currency: "BRL", monthStartDay: 1 } },
      members: { create: { userId: user.id, role: "owner" } },
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
      tableTypes: {
        createMany: {
          data: [
            { name: "Manual", isDefault: true, hiddenColumns: {} },
            { name: "Cartão de crédito", isDefault: false, hiddenColumns: { investmentType: true } },
            { name: "Investimentos", isDefault: false, hiddenColumns: { cardInstallment: true } },
          ],
        },
      },
    },
    select: { id: true },
  });

  // Categorias com subcategorias (criadas separadamente para evitar problema com accountId)
  const defaultCategories = [
    { name: "Alimentação", subs: ["Mercado", "Restaurante", "Delivery"] },
    { name: "Transporte", subs: ["Combustível", "Uber/Táxi", "Manutenção"] },
    { name: "Moradia", subs: ["Aluguel", "Condomínio", "Contas"] },
    { name: "Saúde", subs: ["Plano de saúde", "Medicamentos", "Consultas"] },
    { name: "Lazer", subs: ["Streaming", "Cinema", "Viagem"] },
  ];

  for (const { name, subs } of defaultCategories) {
    const cat = await prisma.category.create({
      data: { accountId: account.id, name, createdById: user.id },
    });
    await prisma.subcategory.createMany({
      data: subs.map((subName) => ({ accountId: account.id, categoryId: cat.id, name: subName })),
    });
  }

  console.log(`Seed concluído. Account: ${account.id}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
