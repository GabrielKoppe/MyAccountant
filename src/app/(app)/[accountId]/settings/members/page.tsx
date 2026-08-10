import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { InvitesList } from "@/components/members/InvitesList";
import { MembersSettingsShell } from "@/components/members/MembersSettingsShell";
import { MembersTable } from "@/components/members/MembersTable";
import { generateSettingsMetadata } from "@/lib/generate-settings-metadata";
import { m } from "@/lib/messages";
import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";

type Props = { params: Promise<{ accountId: string }> };

type MetaProps = { params: Promise<{ accountId: string }> };
export async function generateMetadata({ params }: MetaProps): Promise<Metadata> {
  const { accountId } = await params;
  return generateSettingsMetadata(accountId, "Membros");
}

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
    // Sem `ownerOnly`: a página é acessível a todos os papéis em leitura
    // (Spec 65 §4 NAV-04 / Spec 67 §4). O gate de escrita continua dentro de
    // `MembersTable` e da ação de convidar.
    <MembersSettingsShell
      accountId={accountId}
      count={String(members.length)}
      memberCount={members.length}
      canInvite={isOwner}
    >
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
    </MembersSettingsShell>
  );
}
