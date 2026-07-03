// Async Server Component — aba de Seção da página de mês.
// Busca dados com getSectionTabData e renderiza SectionView.
// Envolvido em <Suspense> pelo page.tsx.

import {
  getSectionTabData,
  getMonthCategories,
  getMonthInstitutions,
  getMonthMembers,
  getMonthResponsibleParties,
  getMonthAccountSettings,
  getMonthTableTypes,
  getSourceTables,
} from "@/server/queries/month-page";
import type { ResponsiblePartyOption } from "@/components/transactions/types";
import { getSectionTotals } from "@/server/services/month-service";
import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";
import { SectionView } from "./SectionView";

type Props = {
  accountId: string;
  monthId: string;
  sectionId: string;
  canEdit: boolean;
};

export async function SectionTab({ accountId, monthId, sectionId, canEdit }: Props) {
  const { user } = await requireAccountAccess(accountId);

  const [
    data,
    categories,
    institutions,
    membersRaw,
    partiesRaw,
    accountSettings,
    tableTypes,
    sourceTables,
    sectionTotalsRaw,
    userSettings,
  ] = await Promise.all([
    getSectionTabData(accountId, monthId, sectionId),
    getMonthCategories(accountId),
    getMonthInstitutions(accountId),
    getMonthMembers(accountId),
    getMonthResponsibleParties(accountId),
    getMonthAccountSettings(accountId),
    getMonthTableTypes(accountId),
    getSourceTables(accountId),
    getSectionTotals(accountId, monthId, [sectionId]),
    prisma.userSettings.findUnique({
      where: { userId: user.id },
      select: { timezone: true },
    }),
  ]);

  if (!data.section) return null;

  const members = membersRaw.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
    image: m.user.image,
  }));

  // Resolve nome de exibição da party (Spec 60 §2.4): personal com membro atual →
  // nome ao vivo do User; group/external → snapshot party.name.
  const currentMemberIds = new Set(membersRaw.map((mm) => mm.user.id));
  const parties: ResponsiblePartyOption[] = partiesRaw.map((p) => {
    let name = p.name;
    if (p.kind === "personal" && p.members.length === 1) {
      const link = p.members[0];
      if (currentMemberIds.has(link.userId)) {
        name = link.user.name ?? link.user.email;
      }
    }
    return { id: p.id, name, kind: p.kind, icon: p.icon };
  });

  const allSections = await prisma.section.findMany({
    where: { accountId, isActive: true },
    orderBy: { order: "asc" },
    select: { id: true, name: true },
  });

  const section = {
    ...data.section,
    isActive: true, // só é renderizado se a seção existe
  };

  return (
    <SectionView
      section={section as Parameters<typeof SectionView>[0]["section"]}
      tables={data.tables}
      sectionTotal={(sectionTotalsRaw[sectionId] ?? 0n).toString()}
      accountId={accountId}
      monthId={monthId}
      currentUserId={user.id}
      canEdit={canEdit}
      timezone={userSettings?.timezone ?? "America/Sao_Paulo"}
      allSections={allSections}
      tableTypes={tableTypes}
      sourceTables={sourceTables}
      transactionsByTable={data.transactionsByTable}
      categories={categories}
      institutions={institutions}
      members={members}
      parties={parties}
      defaultResponsiblePartyId={accountSettings?.defaultResponsiblePartyId ?? null}
    />
  );
}
