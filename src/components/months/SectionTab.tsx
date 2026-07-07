// Async Server Component — aba de Seção da página de mês.
// Busca dados com getSectionTabData e renderiza SectionView.
// Envolvido em <Suspense> pelo page.tsx.

import type { ResponsiblePartyOption } from "@/components/transactions/types";
import { toResponsiblePartyOption } from "@/lib/party-display";
import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";
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
import { getActiveTransactionAliases } from "@/server/queries/transaction-aliases";
import { getSectionTotals } from "@/server/services/month-service";

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
    aliases,
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
    getActiveTransactionAliases(accountId), // DD-10: uma vez por Account, via prop até a linha manual
  ]);

  if (!data.section) return null;

  const members = membersRaw.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
    image: m.user.image,
  }));

  // Resolve exibição da party (Spec 60 §2.4): personal com membro atual → nome/foto
  // ao vivo do User; group/external → snapshot party.name.
  const currentMemberIds = new Set(membersRaw.map((mm) => mm.user.id));
  const parties: ResponsiblePartyOption[] = partiesRaw.map((p) =>
    toResponsiblePartyOption(p, currentMemberIds),
  );

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
      aliases={aliases}
      defaultResponsiblePartyId={accountSettings?.defaultResponsiblePartyId ?? null}
    />
  );
}
