import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Box from "@mui/material/Box";

import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";
import {
  getMonthSections,
  getSectionTotals,
  calculateMonthTotal,
} from "@/server/services/month-service";
import { getBudgetsWithProgress } from "@/lib/queries/budgets";
import { getLayout } from "@/server/services/dashboard-layout-service";
import { formatMonthLabel, MONTH_NAMES } from "@/lib/dates";
import { parseHiddenColumns } from "@/lib/schemas/settings";
import { MonthHeader } from "@/components/months/MonthHeader";
import { MonthTabs } from "@/components/months/MonthTabs";
import { MonthSummary } from "@/components/months/MonthSummary";
import { SectionView } from "@/components/months/SectionView";
import { MonthFilterProvider, type MonthFilterState } from "@/components/months/MonthFilterContext";
import { ActiveFilterChips } from "@/components/transactions/ActiveFilterChips";
import type { TransactionRow } from "@/components/transactions/types";

type Props = {
  params: Promise<{ accountId: string; monthId: string }>;
  searchParams: Promise<{
    tab?: string;
    categories?: string;
    institutions?: string;
    responsible?: string;
    pending?: string;
    favorite?: string;
  }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { accountId, monthId } = await params;
  const [month, account] = await Promise.all([
    prisma.month.findUnique({ where: { id: monthId }, select: { year: true, month: true } }),
    prisma.account.findUnique({ where: { id: accountId }, select: { name: true } }),
  ]);
  if (!month || !account) return { title: "MyAccountant" };
  const monthName = `${MONTH_NAMES[month.month - 1]} ${month.year}`;
  return { title: `${monthName} | ${account.name} | MyAccountant` };
}

export default async function MonthPage({ params, searchParams }: Props) {
  const { accountId, monthId } = await params;
  const {
    tab = "summary",
    categories: categoriesParam,
    institutions: institutionsParam,
    responsible: responsibleParam,
    pending: pendingParam,
    favorite: favoriteParam,
  } = await searchParams;

  const initialFilters: MonthFilterState = {
    categories: categoriesParam ? categoriesParam.split(",").filter(Boolean) : [],
    institutions: institutionsParam ? institutionsParam.split(",").filter(Boolean) : [],
    responsible: responsibleParam ? responsibleParam.split(",").filter(Boolean) : [],
    pending: pendingParam === "1",
    favorite: favoriteParam === "1",
  };

  const { user, member } = await requireAccountAccess(accountId).catch(() => redirect("/home"));
  const canEdit = member.role === "owner" || member.role === "editor";

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

  const { year: monthYear, month: monthMonth } = currentMonth;

  // Dados em paralelo
  const [sections, tablesRaw, allTransactionsRaw, categories, institutions, accountMembers, accountSettings, accountTableTypes, summaryBudgets, userSettings, summaryLayout] =
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
          createdAt: true,
          updatedById: true,
          updatedAt: true,
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
      getBudgetsWithProgress(accountId, monthYear, monthMonth, true),
      prisma.userSettings.findUnique({
        where: { userId: user.id },
        select: { timezone: true },
      }),
      getLayout(accountId, "month_summary"),
    ]);

  const timezone = userSettings?.timezone ?? "America/Sao_Paulo";

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
      createdAt: tx.createdAt.toISOString(),
      updatedById: tx.updatedById,
      updatedAt: tx.updatedAt.toISOString(),
    };
    if (!transactionsByTable[tx.tableId]) transactionsByTable[tx.tableId] = [];
    transactionsByTable[tx.tableId].push(row);
  }

  // Totais por tabela
  const tableTotalsMap: Record<string, string> = {};
  for (const [tableId, txList] of Object.entries(transactionsByTable)) {
    const total = txList.reduce((sum, tx) => sum + BigInt(tx.amountCents), 0n);
    tableTotalsMap[tableId] = total.toString();
  }

  const tables = tablesRaw.map((t: any) => ({
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
  const sectionTotalsRaw = await getSectionTotals(accountId, monthId, sections.map((s: any) => s.id));
  const monthTotalRaw = calculateMonthTotal(sections, sectionTotalsRaw);

  const sectionTotals: Record<string, string> = {};
  for (const [id, val] of Object.entries(sectionTotalsRaw)) {
    sectionTotals[id] = val.toString();
  }
  const monthTotal = monthTotalRaw.toString();

  // Mês anterior (para deltas)
  const sortedMonthsList = [...allMonths];
  const currentIdx = sortedMonthsList.findIndex((m) => m.id === monthId);
  const prevMonthItem = currentIdx > 0 ? sortedMonthsList[currentIdx - 1] : null;

  let prevSectionTotals: Record<string, string> | undefined;
  if (prevMonthItem) {
    const prevTotalsRaw = await getSectionTotals(accountId, prevMonthItem.id, sections.map((s: any) => s.id));
    prevSectionTotals = Object.fromEntries(
      Object.entries(prevTotalsRaw).map(([id, val]) => [id, val.toString()]),
    );
  }

  // Listas para o resumo
  type QuickTx = { id: string; description: string | null; amountCents: string; sectionId: string };

  const pendingTransactions: QuickTx[] = allTransactionsRaw
    .filter((tx: any) => tx.isPending)
    .slice(0, 20)
    .map((tx: any) => ({ id: tx.id, description: tx.description, amountCents: tx.amountCents.toString(), sectionId: tx.sectionId }));

  const favoriteTransactions: QuickTx[] = allTransactionsRaw
    .filter((tx: any) => tx.isFavorite)
    .slice(0, 20)
    .map((tx: any) => ({ id: tx.id, description: tx.description, amountCents: tx.amountCents.toString(), sectionId: tx.sectionId }));

  const recentTransactions: QuickTx[] = allTransactionsRaw
    .slice(0, 8)
    .map((tx: any) => ({ id: tx.id, description: tx.description, amountCents: tx.amountCents.toString(), sectionId: tx.sectionId }));

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
  const sourceTables = allAccountTablesRaw.map((t: any) => ({
    id: t.id,
    name: t.name,
    sectionName: t.section.name,
    monthYear: formatMonthLabel(t.month.year, t.month.month),
  }));

  const allSections = sections.filter((s: any) => s.isActive).map((s: any) => ({ id: s.id, name: s.name }));
  const members = accountMembers.map((m: any) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
    image: m.user.image,
  }));

  const activeSection = tab !== "summary" ? sections.find((s: any) => s.id === tab) : null;

  return (
    <MonthFilterProvider
      initialFilters={initialFilters}
      options={{ categories, institutions, members }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", height: "calc(100vh - 49px)" }}>
        <MonthHeader
          accountId={accountId}
          currentMonth={currentMonth}
          months={allMonths}
          role={member.role}
          monthTotal={monthTotal}
          hasTransactions={allTransactionsRaw.length > 0}
        />

        <ActiveFilterChips />

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
              recentTransactions={recentTransactions}
              prevSectionTotals={prevSectionTotals}
              summaryBudgets={summaryBudgets}
              activeWidgets={summaryLayout.active}
            />
          ) : (
            <SectionView
              section={activeSection}
              tables={tables.filter((t: any) => t.sectionId === activeSection.id)}
              sectionTotal={sectionTotals[activeSection.id] ?? "0"}
              accountId={accountId}
              monthId={monthId}
              currentUserId={user.id}
              canEdit={canEdit}
              timezone={timezone}
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
    </MonthFilterProvider>
  );
}
