"use client";

import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import Box from "@mui/material/Box";
import { useState, type ReactNode } from "react";

import { InviteForm } from "@/components/members/InviteForm";
import { SettingsPageShell } from "@/components/settings/SettingsPageShell";
import { containers } from "@/lib/design-tokens";
import { m } from "@/lib/messages";

type Props = {
  accountId: string;
  /** Contagem já formatada pela página (RSC); o shell só a exibe no chip. */
  count: string;
  /** Nº de membros — alimenta o gate da toolbar (>12 itens) do shell. */
  memberCount: number;
  /**
   * Só o owner convida. Editor e viewer abrem a página em leitura (Spec 67 §4,
   * "Papéis"), então a ação primária simplesmente não existe para eles — mesmo
   * gate que o `secondary` do container antigo aplicava.
   */
  canInvite: boolean;
  children: ReactNode;
};

/**
 * Casca client da página de Membros (Spec 67 §2.2 / SET-03, pacote P4).
 *
 * Existe porque `page.tsx` é RSC e `primaryAction.onClick` do
 * `SettingsPageShell` é uma função — não atravessa a fronteira server→client.
 * O estado do diálogo de convite mora aqui; o conteúdo (tabela de membros e
 * convites pendentes) continua sendo renderizado no servidor e chega por
 * `children`.
 */
export function MembersSettingsShell({
  accountId,
  count,
  memberCount,
  canInvite,
  children,
}: Props) {
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <SettingsPageShell
      family="Conta"
      title={m.settings.nav.members}
      count={count}
      purpose={m.settings.purposes.members}
      itemCount={memberCount}
      primaryAction={
        canInvite
          ? {
              label: m.account.inviteMember,
              icon: <PersonAddAltOutlinedIcon fontSize="small" />,
              onClick: () => setInviteOpen(true),
            }
          : undefined
      }
    >
      {/* As tabelas de membros e de convites já eram limitadas a `containers.md`
          pelo container antigo; o shell não impõe largura, então ela fica aqui. */}
      <Box sx={{ maxWidth: containers.md, display: "flex", flexDirection: "column" }}>
        {children}
      </Box>

      {canInvite && (
        <InviteForm accountId={accountId} open={inviteOpen} onClose={() => setInviteOpen(false)} />
      )}
    </SettingsPageShell>
  );
}
