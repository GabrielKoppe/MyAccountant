import Box from "@mui/material/Box";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { buildSettingsNavGroups } from "@/components/settings/settings-nav-groups";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { requireAccountAccess } from "@/server/auth/session";

type Props = {
  children: ReactNode;
  params: Promise<{ accountId: string }>;
};

export default async function SettingsLayout({ children, params }: Props) {
  const { accountId } = await params;
  const { member } = await requireAccountAccess(accountId).catch(() => redirect("/home"));

  // Carve-out do viewer (Spec 65 §4 NAV-04, §10.5 Opção 2): o redirect global
  // para viewer foi removido daqui — "Membros" passa a ser visível a todos os
  // papéis (em modo leitura). As demais páginas de conteúdo (connectors,
  // models, templates) se auto-protegem com guard próprio; `members` fica sem
  // guard de propósito.
  const groups = buildSettingsNavGroups(member.role);

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "calc(100vh - 48px)",
        flexDirection: { xs: "column", md: "row" },
      }}
    >
      <SettingsNav accountId={accountId} groups={groups} />
      <Box sx={{ flex: 1, overflow: "auto" }}>{children}</Box>
    </Box>
  );
}
