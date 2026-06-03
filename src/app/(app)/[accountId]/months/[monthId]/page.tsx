import { notFound, redirect } from "next/navigation";
import Box from "@mui/material/Box";

import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";
import {
  getMonthSections,
  getSectionTotals,
  calculateMonthTotal,
} from "@/server/services/month-service";
import { formatMonthLabel } from "@/lib/dates";
import { parseHiddenColumns } from "@/lib/schemas/settings";
import { MonthHeader } from "@/components/months/MonthHeader";
import { MonthTabs } from "@/components/months/MonthTabs";
import { MonthSummary } from "@/components/months/MonthSummary";
import { SectionView } from "@/components/months/SectionView";
import type { TransactionRow } from "@/components/transactions/types";

type Props = {
  params: Promise<{ accountId: string; monthId: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export default async function MonthPage({ params, searchParams }: Props) {
  const { accountId, monthId } = await params;
  const { tab = "summary" } = await searchParams;

  const { member } = await requireAccountAccess(accountId).catch(() => redirect("/home"));

  const [currentMonth, allMonths] = await Promise.all([
    prisma.month.findUnique({
      where: { id: monthId },
      select: { id: true, year: true, month: true, accountId: true },
    }),
    prisma.month.findMany({
      where: { accountId },
      orderBy: [{ year: "asc" }, { month: "asc" }],
      select: { id: true, year: true, month: true },
    }),
  ]);

  if (!currentMonth || currentMonth.accountId !== accountId) notFound();

  // Dados em paralelo
  const [sections, tablesRaw, allTransactionsRaw, categories, institutions, accountMembers, accountSettings, accountTableTypes] =
    await Promise.all([
      getMonthSections(accountId, monthId),
      prisma.financeTable.findMany({
        where: { accountId, monthId },
        orderBy: { displayOrder: "asc" },
        select: {
          id: true,
          name: true,
          sectionId: true,
          countInMonth: true,
          tableType: { select: { name: true, hiddenColumns: true } },
          _count: { select: { transactions: true } },
        },
      }),
      prisma.transaction.findMany({
        where: { accountId, monthId },
        orderBy: { occurredOn: "desc" },
        take: 300,
        select: {
          id: true,
          tableId: true,
          sectionId: true,
          occurredOn: true,
          amountCents: true,
          description: true,
          notes: true,
          isPending: true,
          isFavorite: true,
          categoryId: true,
          subcategoryId: true,
          institutionId: true,
          institutionText: true,
          responsibleUserId: true,
          cardInstallment: true,
          investmentType: true,
          createdById: true,
        },
      }),
      prisma.category.findMany({
        where: { accountId },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          subcategories: { orderBy: { name: "asc" }, select: { id: true, name: true } },
        },
      }),
      prisma.institution.findMany({
        where: { accountId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.accountMember.findMany({
        where: { accountId },
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
      }),
      prisma.accountSettings.findUnique({
        where: { accountId },
        select: { defaultResponsibleUserId: true },
      }),
      prisma.tableType.findMany({
        where: { accountId },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        select: { id: true, name: true, isDefault: true },
      }),
    ]);

  // Serializar transações (BigInt → string, Date → string)
  const transactionsByTable: Record<string, TransactionRow[]> = {};
  for (const tx of allTransactionsRaw) {
    const row: TransactionRow = {
      id: tx.id,
      occurredOn: tx.occurredOn.toISOString().slice(0, 10),
      amountCents: tx.amountCents.toString(),
      description: tx.description,
      notes: tx.notes,
      isPending: tx.isPending,
      isFavorite: tx.isFavorite,
      categoryId: tx.categoryId,
      subcategoryId: tx.subcategoryId,
      institutionId: tx.institutionId,
      institutionText: tx.institutionText,
      responsibleUserId: tx.responsibleUserId,
      cardInstallment: tx.cardInstallment,
      investmentType: tx.investmentType as import("@/lib/schemas/transaction").InvestmentType | null,
      createdById: tx.createdById,
    };
    if (!transactionsByTable[tx.tableId]) transactionsByTable[tx.tableId] = [];
    transactionsByTable[tx.tableId].push(row);
  }

  // Totais por tabela (para o header do card)
  const tableTotalsMap: Record<string, string> = {};
  for (const [tableId, txList] of Object.entries(transactionsByTable)) {
    const total = txList.reduce((sum, tx) => sum + BigInt(tx.amountCents), 0n);
    tableTotalsMap[tableId] = total.toString();
  }

  const tables = tablesRaw.map((t) => ({
    id: t.id,
    name: t.name,
    sectionId: t.sectionId,
    countInMonth: t.countInMonth,
    tableTypeName: t.tableType?.name ?? null,
    hiddenColumns: parseHiddenColumns(t.tableType?.hiddenColumns),
    total: tableTotalsMap[t.id] ?? "0",
    transactionCount: t._count.transactions,
  }));

  // Totais por seção e mês
  const sectionTotalsRaw = await getSectionTotals(accountId, monthId, sections.map((s) => s.id));
  const monthTotalRaw = calculateMonthTotal(sections, sectionTotalsRaw);

  const sectionTotals: Record<string, string> = {};
  for (const [id, val] of Object.entries(sectionTotalsRaw)) {
    sectionTotals[id] = val.toString();
  }
  const monthTotal = monthTotalRaw.toString();

  // Listas para o resumo (computadas das transações já carregadas)
  type QuickTx = { id: string; description: string | null; amountCents: string; sectionId: string };

  const pendingTransactions: QuickTx[] = allTransactionsRaw
    .filter((tx) => tx.isPending)
    .slice(0, 20)
    .map((tx) => ({ id: tx.id, description: tx.description, amountCents: tx.amountCents.toString(), sectionId: tx.sectionId }));

  const favoriteTransactions: QuickTx[] = allTransactionsRaw
    .filter((tx) => tx.isFavorite)
    .slice(0, 20)
    .map((tx) => ({ id: tx.id, description: tx.description, amountCents: tx.amountCents.toString(), sectionId: tx.sectionId }));

  // Totais por categoria (para o gráfico do resumo)
  const catTotalsMap: Record<string, bigint> = {};
  for (const tx of allTransactionsRaw) {
    if (tx.categoryId) {
      catTotalsMap[tx.categoryId] = (catTotalsMap[tx.categoryId] ?? 0n) + tx.amountCents;
    }
  }
  const categoryTotals = Object.entries(catTotalsMap)
    .map(([id, total]) => ({
      categoryId: id,
      name: categories.find((c) => c.id === id)?.name ?? "—",
      totalCents: total.toString(),
    }))
    .sort((a, b) => Math.abs(Number(BigInt(b.totalCents))) - Math.abs(Number(BigInt(a.totalCents))))
    .slice(0, 8);

  // Source tables para o modal de cópia
  const allAccountTablesRaw = await prisma.financeTable.findMany({
    where: { accountId },
    orderBy: [{ month: { year: "desc" } }, { month: { month: "desc" } }],
    select: {
      id: true,
      name: true,
      section: { select: { name: true } },
      month: { select: { year: true, month: true } },
    },
  });
  const sourceTables = allAccountTablesRaw.map((t) => ({
    id: t.id,
    name: t.name,
    sectionName: t.section.name,
    monthYear: formatMonthLabel(t.month.year, t.month.month),
  }));

  const allSections = sections.filter((s) => s.isActive).map((s) => ({ id: s.id, name: s.name }));
  const members = accountMembers.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
    image: m.user.image,
  }));

  const activeSection = tab !== "summary" ? sections.find((s) => s.id === tab) : null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "calc(100vh - 48px)" }}>
      <MonthHeader
        accountId={accountId}
        currentMonth={currentMonth}
        months={allMonths}
        role={member.role}
      />

      <MonthTabs
        accountId={accountId}
        monthId={monthId}
        sections={sections}
        activeTab={tab}
      />

      <Box sx={{ flex: 1, overflow: "auto" }}>
        {tab === "summary" || !activeSection ? (
          <MonthSummary
            sections={sections}
            sectionTotals={sectionTotals}
            monthTotal={monthTotal}
            tables={tables}
            accountId={accountId}
            monthId={monthId}
            pendingTransactions={pendingTransactions}
            favoriteTransactions={favoriteTransactions}
            categoryTotals={categoryTotals}
          />
        ) : (
          <SectionView
            section={activeSection}
            tables={tables.filter((t) => t.sectionId === activeSection.id)}
            sectionTotal={sectionTotals[activeSection.id] ?? "0"}
            accountId={accountId}
            monthId={monthId}
            allSections={allSections}
            tableTypes={accountTableTypes}
            sourceTables={sourceTables}
            transactionsByTable={transactionsByTable}
            categories={categories}
            institutions={institutions}
            members={members}
            defaultResponsibleUserId={accountSettings?.defaultResponsibleUserId ?? null}
          />
        )}
      </Box>
    </Box>
  );
}
