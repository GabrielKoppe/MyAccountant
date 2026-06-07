import type { Metadata } from "next";
import { generateSettingsMetadata } from "@/lib/generate-settings-metadata";
import { redirect } from "next/navigation";

import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";
import { m } from "@/lib/messages";
import { GeneralSettingsForm } from "./GeneralSettingsForm";
import PageSettingsContainer from "@/components/settings/PageSettingsContainer";
import { Divider, Paper, Typography } from "@mui/material";
import { AccountDangerZone } from "./AccountDangerZone";

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

  const [account, settings, members] = await Promise.all([
    prisma.account.findUnique({ where: { id: accountId }, select: { name: true } }),
    prisma.accountSettings.findUnique({ where: { accountId } }),
    prisma.accountMember.findMany({
      where: { accountId },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
  ]);

  const membersList = members.map(
    (m: { user: { id: string; name: string | null; email: string } }) => ({
      id: m.user.id,
      label: m.user.name ?? m.user.email,
    }),
  );

  if (!account || !settings) redirect("/home");

  return (
    <PageSettingsContainer title={m.settings.general.title}>
      <AccountDangerZone accountId={accountId} accountName={account.name} role={member.role} />

      <Divider sx={{ my: 3 }} />

      <GeneralSettingsForm
        accountId={accountId}
        defaultValues={{
          accountName: account.name,
          currency: settings.currency as "BRL",
          monthStartDay: settings.monthStartDay,
          defaultResponsibleUserId: settings.defaultResponsibleUserId ?? null,
        }}
        members={membersList}
      />
    </PageSettingsContainer>
  );
}
