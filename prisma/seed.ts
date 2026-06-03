import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Limpar em ordem de dependência
  await prisma.transaction.deleteMany();
  await prisma.financeTable.deleteMany();
  await prisma.month.deleteMany();
  await prisma.tableType.deleteMany();
  await prisma.subcategory.deleteMany();
  await prisma.category.deleteMany();
  await prisma.institution.deleteMany();
  await prisma.section.deleteMany();
  await prisma.accountSettings.deleteMany();
  await prisma.accountMember.deleteMany();
  await prisma.account.deleteMany();
  await prisma.userSettings.deleteMany();
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
