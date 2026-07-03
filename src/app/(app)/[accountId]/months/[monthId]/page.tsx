import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Box from "@mui/material/Box";

import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";
import { MONTH_NAMES } from "@/lib/dates";
import { toResponsiblePartyOption } from "@/lib/party-display";
import { MonthHeader } from "@/components/months/MonthHeader";
import { MonthTabs } from "@/components/months/MonthTabs";
import { MonthFilterProvider, type MonthFilterState } from "@/components/months/MonthFilterContext";
import { ActiveFilterChips } from "@/components/transactions/ActiveFilterChips";
import { MonthSummaryTab } from "@/components/months/MonthSummaryTab";
import { SectionTab } from "@/components/months/SectionTab";
import { TabContentSkeleton } from "@/components/months/TabContentSkeleton";
import { getMonthSections } from "@/server/services/month-service";
import {
  getMonthCategories,
  getMonthInstitutions,
  getMonthMembers,
  getMonthResponsibleParties,
} from "@/server/queries/month-page";

type Props = {
  params: Promise<{ accountId: string; monthId: string }>;
  searchParams: Promise<{
    tab?: string;
    categories?: string;
    institutions?: string;
    responsible?: string;
    pending?: string;
    favorite?: string;
    expenseTypes?: string;
    sources?: string;
    tagIds?: string;
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
    expenseTypes: expenseTypesParam,
    sources: sourcesParam,
    tagIds: tagIdsParam,
  } = await searchParams;

  const VALID_EXPENSE_TYPES = ["fixed", "variable", "one_time"] as const;
  const VALID_SOURCES = [
    "manual",
    "csv_import",
    "xlsx_import",
    "template",
    "auto_template",
    "duplicate",
  ] as const;

  const initialFilters: MonthFilterState = {
    categories: categoriesParam ? categoriesParam.split(",").filter(Boolean) : [],
    institutions: institutionsParam ? institutionsParam.split(",").filter(Boolean) : [],
    responsible: responsibleParam ? responsibleParam.split(",").filter(Boolean) : [],
    pending: pendingParam === "1",
    favorite: favoriteParam === "1",
    expenseTypes: expenseTypesParam
      ? (expenseTypesParam
          .split(",")
          .filter((v) =>
            VALID_EXPENSE_TYPES.includes(v as (typeof VALID_EXPENSE_TYPES)[number]),
          ) as (typeof VALID_EXPENSE_TYPES)[number][])
      : [],
    sources: sourcesParam
      ? (sourcesParam
          .split(",")
          .filter((v) =>
            VALID_SOURCES.includes(v as (typeof VALID_SOURCES)[number]),
          ) as (typeof VALID_SOURCES)[number][])
      : [],
    tagIds: tagIdsParam ? tagIdsParam.split(",").filter(Boolean) : [],
  };

  const { member } = await requireAccountAccess(accountId).catch(() => redirect("/home"));
  const canEdit = member.role === "owner" || member.role === "editor";

  const [
    currentMonth,
    allMonths,
    sections,
    categories,
    institutions,
    membersRaw,
    partiesRaw,
    accountTags,
  ] =
    await Promise.all([
      prisma.month.findUnique({
        where: { id: monthId },
        select: { id: true, year: true, month: true, accountId: true },
      }),
      prisma.month.findMany({
        where: { accountId },
        orderBy: [{ year: "asc" }, { month: "asc" }],
        select: { id: true, year: true, month: true },
      }),
      getMonthSections(accountId, monthId),
      getMonthCategories(accountId),
      getMonthInstitutions(accountId),
      getMonthMembers(accountId),
      getMonthResponsibleParties(accountId),
      prisma.tag.findMany({
        where: { accountId },
        orderBy: { name: "asc" },
        select: { id: true, name: true, color: true },
      }),
    ]);

  // Resolve exibição das parties (Spec 60 §2.4).
  const currentMemberIds = new Set(membersRaw.map((mm) => mm.user.id));
  const filterParties = partiesRaw.map((p) => toResponsiblePartyOption(p, currentMemberIds));

  const filterOptions = {
    categories,
    institutions,
    parties: filterParties,
    tags: accountTags,
  };

  if (!currentMonth || currentMonth.accountId !== accountId) notFound();

  const { year: monthYear, month: monthMonth } = currentMonth;

  const sortedMonths = [...allMonths];
  const currentIdx = sortedMonths.findIndex((m) => m.id === monthId);
  const prevMonthId = currentIdx > 0 ? sortedMonths[currentIdx - 1].id : null;
  const allMonthIds = allMonths.map((m) => m.id);

  const activeSection = tab !== "summary" ? sections.find((s) => s.id === tab) : null;

  return (
    <MonthFilterProvider initialFilters={initialFilters} options={filterOptions}>
      <Box>
        <MonthHeader
          accountId={accountId}
          currentMonth={currentMonth}
          months={allMonths}
          role={member.role}
        />

        <MonthTabs accountId={accountId} monthId={monthId} sections={sections} activeTab={tab} />

        <ActiveFilterChips />

        {tab === "summary" || !activeSection ? (
          <Suspense fallback={<TabContentSkeleton />}>
            <MonthSummaryTab
              accountId={accountId}
              monthId={monthId}
              monthYear={monthYear}
              monthMonth={monthMonth}
              prevMonthId={prevMonthId}
              allMonthIds={allMonthIds}
              canEdit={canEdit}
            />
          </Suspense>
        ) : (
          <Suspense key={activeSection.id} fallback={<TabContentSkeleton />}>
            <SectionTab
              accountId={accountId}
              monthId={monthId}
              sectionId={activeSection.id}
              canEdit={canEdit}
            />
          </Suspense>
        )}
      </Box>
    </MonthFilterProvider>
  );
}
