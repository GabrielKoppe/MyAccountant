import Box from "@mui/material/Box";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { buildSettingsNavGroups } from "@/components/settings/settings-nav-groups";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { requireAccountAccess } from "@/server/auth/session";
import { getSettingsCounts } from "@/server/queries/settings-counts";

type Props = {
  children: ReactNode;
  params: Promise<{ accountId: string }>;
};

export default async function SettingsLayout({ children, params }: Props) {
  const { accountId } = await params;
  const { member, user } = await requireAccountAccess(accountId).catch(() => redirect("/home"));

  // Carve-out do viewer (Spec 65 §4 NAV-04, §10.5 Opção 2): o redirect global
  // para viewer foi removido daqui — "Membros" passa a ser visível a todos os
  // papéis (em modo leitura). As demais páginas de conteúdo (connectors,
  // models, templates) se auto-protegem com guard próprio; `members` fica sem
  // guard de propósito.
  // Spec 67 §4 (SET-01): contagem barata à direita de cada link. Mesma função
  // consumida pelo hub — o React.cache dedupa na render.
  const counts = await getSettingsCounts(accountId, member.role, user.id);
  const groups = buildSettingsNavGroups(member.role, counts);

  return (
    <Box
      sx={{
        display: "flex",
        height: "100%",
        flexDirection: { xs: "column", md: "row" },
      }}
    >
      <SettingsNav accountId={accountId} groups={groups} />
      {/*
        `overflow: hidden` + coluna flex: o scroll passa a ser da ÁREA DE CONTEÚDO do
        `SettingsPageShell`, não deste wrapper. Enquanto ele rolava, o cabeçalho da
        página (breadcrumb, título, propósito) e a toolbar subiam junto com as linhas —
        numa lista de 37 categorias, o usuário perdia de vista onde estava e o campo de
        busca que acabou de usar.
      */}
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
