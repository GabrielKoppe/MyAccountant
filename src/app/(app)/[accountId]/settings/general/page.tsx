import { redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";
import { m } from "@/lib/messages";
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
    <Box sx={{ p: 4, maxWidth: 700, display: "flex", flexDirection: "column", gap: 3 }}>
      <Typography variant="h5" fontWeight="bold" mb={3}>
        {m.settings.general.title}
      </Typography>
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
