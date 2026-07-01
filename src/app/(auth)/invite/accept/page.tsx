import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import MailOutlineIcon from "@mui/icons-material/MailOutline";

import { auth } from "@/server/auth";
import { prisma } from "@/server/prisma";
import { getInviteByToken } from "@/server/services/member-service";
import { m } from "@/lib/messages";
import { InviteActions } from "./InviteActions";

type SearchParams = Promise<{ token?: string }>;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <Paper sx={{ p: 4, borderRadius: 2, textAlign: "center" }}>
      <MailOutlineIcon sx={{ fontSize: 56, color: "primary.main", mb: 2 }} />
      {children}
    </Paper>
  );
}

export default async function AcceptInvitePage({ searchParams }: { searchParams: SearchParams }) {
  const { token = "" } = await searchParams;
  const invite = await getInviteByToken(token);

  // Token inexistente
  if (!invite) {
    return (
      <Shell>
        <Alert severity="error">{m.account.acceptInvite.invalidToken}</Alert>
      </Shell>
    );
  }

  // Estados terminais do convite
  if (invite.status === "accepted") {
    return (
      <Shell>
        <Alert severity="info" sx={{ mb: 3 }}>
          {m.account.acceptInvite.alreadyAccepted}
        </Alert>
        <Button variant="outlined" href="/home">
          {m.account.acceptInvite.goToApp}
        </Button>
      </Shell>
    );
  }
  if (invite.status === "revoked") {
    return (
      <Shell>
        <Alert severity="error">{m.account.acceptInvite.revoked}</Alert>
      </Shell>
    );
  }
  if (invite.isExpired) {
    return (
      <Shell>
        <Alert severity="error">{m.account.acceptInvite.expired}</Alert>
      </Shell>
    );
  }

  // Convite válido e pendente
  const roleLabel = m.account.roles[invite.role];
  const session = await auth();

  // Cenário A — usuário sem sessão: oferecer criar conta ou entrar (token preservado no callbackUrl)
  if (!session?.user?.id) {
    const callbackUrl = `/invite/accept?token=${encodeURIComponent(token)}`;
    return (
      <Shell>
        <Typography variant="h5" mb={1}>
          {m.account.acceptInvite.welcomeTitle}
        </Typography>
        <Typography color="text.secondary" mb={0.5}>
          {m.account.acceptInvite.invitedBy(invite.inviterName, invite.accountName)}
        </Typography>
        <Typography color="text.secondary" mb={3}>
          {m.account.acceptInvite.roleLine(roleLabel)}
        </Typography>
        <Stack spacing={1.5}>
          <Button
            variant="contained"
            href={`/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          >
            {m.account.acceptInvite.createAccountCta}
          </Button>
          <Button variant="text" href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}>
            {m.account.acceptInvite.loginCta}
          </Button>
        </Stack>
      </Shell>
    );
  }

  // Usuário logado — confirmar email do convite == email da sessão
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true },
  });

  if (!user || user.email.toLowerCase() !== invite.email.toLowerCase()) {
    return (
      <Shell>
        <Alert severity="warning" sx={{ mb: 3, textAlign: "left" }}>
          {m.account.acceptInvite.wrongEmailDetail(invite.email)}
        </Alert>
        <Button variant="outlined" href="/home">
          {m.account.acceptInvite.goToApp}
        </Button>
      </Shell>
    );
  }

  // Cenário B (ou retorno do signup) — logado com o email certo: confirmação explícita
  return (
    <Shell>
      <Typography variant="h5" mb={1}>
        {m.account.acceptInvite.welcomeTitle}
      </Typography>
      <Typography color="text.secondary" mb={0.5}>
        {m.account.acceptInvite.invitedBy(invite.inviterName, invite.accountName)}
      </Typography>
      <Typography color="text.secondary" mb={0.5}>
        {m.account.acceptInvite.roleLine(roleLabel)}
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        {m.account.acceptInvite.confirmHint}
      </Typography>
      <Box>
        <InviteActions token={token} />
      </Box>
    </Shell>
  );
}
