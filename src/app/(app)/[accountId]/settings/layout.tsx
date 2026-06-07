import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import Box from "@mui/material/Box";

import { requireAccountAccess } from "@/server/auth/session";
import { m } from "@/lib/messages";
import { SettingsNav } from "@/components/settings/SettingsNav";

type Props = {
  children: ReactNode;
  params: Promise<{ accountId: string }>;
};

const editorLinks = [
  { href: "general", label: m.settings.nav.general },
  { href: "sections", label: m.settings.nav.sections },
  { href: "categories", label: m.settings.nav.categories },
  { href: "institutions", label: m.settings.nav.institutions },
  { href: "table-types", label: m.settings.nav.tableTypes },
  { href: "models", label: "Modelos de tabela" },
  { href: "templates", label: m.settings.nav.templates },
  { href: "analyses", label: m.settings.nav.analyses },
];

export default async function SettingsLayout({ children, params }: Props) {
  const { accountId } = await params;
  const { member } = await requireAccountAccess(accountId).catch(() => redirect("/home"));

  if (member.role === "viewer") redirect(`/${accountId}`);

  const isOwner = member.role === "owner";
  // Conta (danger zone) e Membros ficam agrupados como links de owner
  const ownerLinks = isOwner
    ? [
        { href: "account", label: m.settings.nav.account },
        { href: "members", label: m.settings.nav.members },
      ]
    : [];

  return (
    <Box sx={{ display: "flex", minHeight: "calc(100vh - 48px)", flexDirection: { xs: "column", md: "row" } }}>
      <SettingsNav
        accountId={accountId}
        editorLinks={editorLinks}
        ownerLinks={ownerLinks}
      />
      <Box sx={{ flex: 1, overflow: "auto" }}>{children}</Box>
    </Box>
  );
}
