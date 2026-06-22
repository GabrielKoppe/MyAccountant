import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Box from "@mui/material/Box";

import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";
import { MONTH_NAMES } from "@/lib/dates";
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
} from "@/lib/queries/month-page";

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

  const { member } = await requireAccountAccess(accountId).catch(() => redirect("/home"));
  const canEdit = member.role === "owner" || member.role === "editor";

  const [currentMonth, allMonths, sections, categories, institutions, membersRaw] = await Promise.all([
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
  ]);

  const filterOptions = {
    categories,
    institutions,
    members: membersRaw.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      image: m.user.image,
    })),
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

        <MonthTabs
          accountId={accountId}
          monthId={monthId}
          sections={sections}
          activeTab={tab}
        />

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
