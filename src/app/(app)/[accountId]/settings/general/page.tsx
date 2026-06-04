import { redirect } from "next/navigation";
import Box from "@mui/material/Box";

import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";
import { m } from "@/lib/messages";
import { layout, containers } from "@/lib/design-tokens";
import { PageHeader } from "@/components/ui/PageHeader";
import { GeneralSettingsForm } from "./GeneralSettingsForm";

type Props = { params: Promise<{ accountId: string }> };

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

  if (!account || !settings) redirect("/home");

  return (
    <Box sx={{ p: layout.page, maxWidth: containers.md }}>
      <PageHeader title={m.settings.general.title} />
      <GeneralSettingsForm
        accountId={accountId}
        defaultValues={{
          accountName: account.name,
          currency: settings.currency as "BRL",
          monthStartDay: settings.monthStartDay,
          defaultResponsibleUserId: settings.defaultResponsibleUserId ?? null,
        }}
        members={members.map((m) => ({
          id: m.user.id,
          label: m.user.name ?? m.user.email,
        }))}
      />
    </Box>
  );
}
