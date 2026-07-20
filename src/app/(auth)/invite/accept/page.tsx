import Button from "@mui/material/Button";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

import { auth } from "@/server/auth";
import { prisma } from "@/server/prisma";
import { getInviteById, getInviteByToken } from "@/server/services/member-service";
import { m } from "@/lib/messages";
import { InviteConfirmView, InviteInfoState, InvitePromptView } from "./InviteViews";

type SearchParams = Promise<{ token?: string; inviteId?: string }>;

export default async function AcceptInvitePage({ searchParams }: { searchParams: SearchParams }) {
  const { token = "", inviteId = "" } = await searchParams;
  const invite = token
    ? await getInviteByToken(token)
    : inviteId
      ? await getInviteById(inviteId)
      : null;

  const goHome = (
    <Button variant="outlined" href="/home">
      {m.account.acceptInvite.goToApp}
    </Button>
  );

  // Token inexistente
  if (!invite) {
    return (
      <InviteInfoState
        tone="danger"
        icon={<ErrorOutlineIcon sx={{ fontSize: 30 }} />}
        message={m.account.acceptInvite.invalidToken}
      />
    );
  }

  // Estados terminais do convite
  if (invite.status === "accepted") {
    return (
      <InviteInfoState
        tone="success"
        icon={<CheckCircleOutlineIcon sx={{ fontSize: 30 }} />}
        message={m.account.acceptInvite.alreadyAccepted}
        action={goHome}
      />
    );
  }
  if (invite.status === "revoked") {
    return (
      <InviteInfoState
        tone="danger"
        icon={<ErrorOutlineIcon sx={{ fontSize: 30 }} />}
        message={m.account.acceptInvite.revoked}
      />
    );
  }
  if (invite.isExpired) {
    return (
      <InviteInfoState
        tone="warning"
        icon={<WarningAmberIcon sx={{ fontSize: 30 }} />}
        message={m.account.acceptInvite.expired}
      />
    );
  }

  // Convite válido e pendente
  const roleLabel = m.account.roles[invite.role];
  const session = await auth();

  // Cenário A — usuário sem sessão
  if (!session?.user?.id) {
    return (
      <InvitePromptView
        inviterName={invite.inviterName}
        accountName={invite.accountName}
        roleLabel={roleLabel}
        callbackUrl={
          token
            ? `/invite/accept?token=${encodeURIComponent(token)}`
            : `/invite/accept?inviteId=${encodeURIComponent(inviteId)}`
        }
      />
    );
  }

  // Usuário logado — confirmar email do convite == email da sessão
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true },
  });

  if (!user || user.email.toLowerCase() !== invite.email.toLowerCase()) {
    return (
      <InviteInfoState
        tone="warning"
        icon={<WarningAmberIcon sx={{ fontSize: 30 }} />}
        message={m.account.acceptInvite.wrongEmailDetail(invite.email)}
        action={goHome}
      />
    );
  }

  // Cenário B — logado com o email certo: confirmação explícita
  return (
    <InviteConfirmView
      inviterName={invite.inviterName}
      accountName={invite.accountName}
      roleLabel={roleLabel}
      token={token || undefined}
      inviteId={inviteId || undefined}
    />
  );
}
