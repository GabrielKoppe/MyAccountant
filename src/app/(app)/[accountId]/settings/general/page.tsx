import type { Metadata } from "next";
import { generateSettingsMetadata } from "@/lib/generate-settings-metadata";
import { redirect } from "next/navigation";

import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";
import { m } from "@/lib/messages";
import { toResponsiblePartyOption } from "@/lib/party-display";
import { GeneralSettingsForm } from "./GeneralSettingsForm";
import PageSettingsContainer from "@/components/settings/PageSettingsContainer";
import { Divider } from "@mui/material";
import { AccountDangerZone } from "./AccountDangerZone";
import { AccountDataSection } from "./AccountDataSection";
import { TourResetSection } from "./TourResetSection";

type Props = { params: Promise<{ accountId: string }> };

type MetaProps = { params: Promise<{ accountId: string }> };
export async function generateMetadata({ params }: MetaProps): Promise<Metadata> {
  const { accountId } = await params;
  return generateSettingsMetadata(accountId, "Geral");
}

export default async function GeneralSettingsPage({ params }: Props) {
  const { accountId } = await params;
  const { member } = await requireAccountAccess(accountId).catch(() => redirect("/home"));
  if (member.role === "viewer") redirect(`/${accountId}`);

  const [account, settings, members, partiesRaw] = await Promise.all([
    prisma.account.findUnique({ where: { id: accountId }, select: { name: true } }),
    prisma.accountSettings.findUnique({ where: { accountId } }),
    prisma.accountMember.findMany({
      where: { accountId },
      select: { userId: true },
    }),
    prisma.responsibleParty.findMany({
      where: { accountId, archivedAt: null },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        kind: true,
        icon: true,
        color: true,
        members: {
          select: { userId: true, user: { select: { name: true, email: true, image: true } } },
        },
      },
    }),
  ]);

  // Resolve exibição (Spec 60 §2.4): personal atual → nome/foto ao vivo do User.
  const currentMemberIds = new Set(members.map((mm) => mm.userId));
  const parties = partiesRaw.map((p) => toResponsiblePartyOption(p, currentMemberIds));

  if (!account || !settings) redirect("/home");

  return (
    <PageSettingsContainer title={m.settings.general.title}>
      <GeneralSettingsForm
        accountId={accountId}
        defaultValues={{
          accountName: account.name,
          currency: settings.currency as "BRL",
          monthStartDay: settings.monthStartDay,
          defaultResponsiblePartyId: settings.defaultResponsiblePartyId ?? null,
          invertSignOnMoveByDefault: settings.invertSignOnMoveByDefault,
        }}
        parties={parties}
      />

      <Divider sx={{ my: 3 }} />

      <TourResetSection accountId={accountId} />

      <Divider sx={{ my: 3 }} />

      <AccountDataSection accountId={accountId} accountName={account.name} role={member.role} />

      <Divider sx={{ my: 3 }} />

      <AccountDangerZone accountId={accountId} accountName={account.name} role={member.role} />
    </PageSettingsContainer>
  );
}
