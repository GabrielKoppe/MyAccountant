import { redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";

import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";
import { InviteForm } from "@/components/members/InviteForm";
import { InvitesList } from "@/components/members/InvitesList";
import { MembersTable } from "@/components/members/MembersTable";
import { m } from "@/lib/messages";
import { layout, containers } from "@/lib/design-tokens";
import { PageHeader } from "@/components/ui/PageHeader";

type Props = { params: Promise<{ accountId: string }> };

export default async function MembersPage({ params }: Props) {
  const { accountId } = await params;

  const { user, member: currentMember } = await requireAccountAccess(accountId).catch(() =>
    redirect("/home"),
  );

  const members = await prisma.accountMember.findMany({
    where: { accountId },
    include: {
      user: { select: { name: true, email: true, image: true } },
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });

  const pendingInvites = await prisma.accountInvite.findMany({
    where: {
      accountId,
      status: "pending",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  const isOwner = currentMember.role === "owner";

  return (
    <Box sx={{ p: layout.page, maxWidth: containers.md }}>
      <PageHeader
        title={m.account.members.title}
        actions={isOwner ? <InviteForm accountId={accountId} /> : undefined}
      />

      <MembersTable
        accountId={accountId}
        members={members}
        currentUserId={user.id}
        currentUserRole={currentMember.role}
      />

      {isOwner && (
        <>
          <Divider sx={{ my: 4 }} />
          <Typography variant="h6" fontWeight="medium" mb={2}>
            {m.account.members.pendingInvites}
          </Typography>
          <InvitesList accountId={accountId} invites={pendingInvites} />
        </>
      )}
    </Box>
  );
}
