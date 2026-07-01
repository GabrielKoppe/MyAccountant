import type { ReactNode } from "react";

import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import MailOutlineIcon from "@mui/icons-material/MailOutline";

import { StatusBadge } from "@/components/ui/StatusBadge";
import { layout, radius, typography } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import { InviteActions } from "./InviteActions";

export type Tone = "accent" | "danger" | "warning" | "success";

const HALO: Record<Tone, { bgcolor: string; color: string }> = {
  accent: { bgcolor: "accent.primarySubtle", color: "accent.primary" },
  danger: { bgcolor: "danger.subtle", color: "danger.main" },
  warning: { bgcolor: "warning.subtle", color: "warning.main" },
  success: { bgcolor: "success.subtle", color: "success.main" },
};

/** Card centrado com halo circular no ícone — moldura compartilhada por todos os estados. */
export function InviteFrame({
  tone,
  icon,
  children,
}: {
  tone: Tone;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardContent sx={{ p: layout.card }}>
        <Stack spacing={layout.cluster} alignItems="center" textAlign="center">
          <Stack
            aria-hidden
            alignItems="center"
            justifyContent="center"
            sx={{ width: 64, height: 64, borderRadius: radius.full, ...HALO[tone] }}
          >
            {icon}
          </Stack>
          {children}
        </Stack>
      </CardContent>
    </Card>
  );
}

/** Bloco de identidade do convite: eyebrow + quem convidou + nome da conta + papel. */
export function InviteIdentity({
  inviterName,
  accountName,
  roleLabel,
}: {
  inviterName: string;
  accountName: string;
  roleLabel: string;
}) {
  return (
    <Stack spacing={layout.micro} alignItems="center">
      <Typography
        sx={{
          fontSize: typography.fontSize.xs,
          fontWeight: typography.fontWeight.semibold,
          letterSpacing: typography.letterSpacing.wide,
          textTransform: "uppercase",
          color: "text.tertiary",
        }}
      >
        {m.account.acceptInvite.eyebrow}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {m.account.acceptInvite.invitedByShort(inviterName)}
      </Typography>
      <Typography variant="h4">{accountName}</Typography>
      <StatusBadge variant="neutral">{m.account.acceptInvite.roleBadge(roleLabel)}</StatusBadge>
    </Stack>
  );
}

/** Estado terminal: halo + mensagem curta + ação opcional. */
export function InviteInfoState({
  tone,
  icon,
  message,
  action,
}: {
  tone: Tone;
  icon: ReactNode;
  message: string;
  action?: ReactNode;
}) {
  return (
    <InviteFrame tone={tone} icon={icon}>
      <Typography variant="body1" color="text.secondary">
        {message}
      </Typography>
      {action}
    </InviteFrame>
  );
}

/** Cenário A — sem sessão: criar conta ou entrar (token preservado no callbackUrl). */
export function InvitePromptView({
  inviterName,
  accountName,
  roleLabel,
  callbackUrl,
}: {
  inviterName: string;
  accountName: string;
  roleLabel: string;
  callbackUrl: string;
}) {
  return (
    <InviteFrame tone="accent" icon={<MailOutlineIcon sx={{ fontSize: 30 }} />}>
      <InviteIdentity inviterName={inviterName} accountName={accountName} roleLabel={roleLabel} />
      <Typography variant="body2" color="text.tertiary">
        {m.account.acceptInvite.newUserHint}
      </Typography>
      <Stack spacing={layout.inline} sx={{ width: "100%" }}>
        <Button
          variant="contained"
          size="large"
          fullWidth
          href={`/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`}
        >
          {m.account.acceptInvite.createAccountCta}
        </Button>
        <Button
          variant="text"
          fullWidth
          href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
        >
          {m.account.acceptInvite.loginCta}
        </Button>
      </Stack>
    </InviteFrame>
  );
}

/** Cenário B (ou retorno do signup) — logado com o email certo: confirmação explícita. */
export function InviteConfirmView({
  inviterName,
  accountName,
  roleLabel,
  token,
}: {
  inviterName: string;
  accountName: string;
  roleLabel: string;
  token: string;
}) {
  return (
    <InviteFrame tone="accent" icon={<MailOutlineIcon sx={{ fontSize: 30 }} />}>
      <InviteIdentity inviterName={inviterName} accountName={accountName} roleLabel={roleLabel} />
      <Typography variant="body2" color="text.tertiary">
        {m.account.acceptInvite.confirmHint}
      </Typography>
      <InviteActions token={token} />
    </InviteFrame>
  );
}
