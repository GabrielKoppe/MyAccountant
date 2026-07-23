import Box from "@mui/material/Box";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { SettingsNav, type CollapsibleNavEntry } from "@/components/settings/SettingsNav";
import { m } from "@/lib/messages";
import { requireAccountAccess } from "@/server/auth/session";

type Props = {
  children: ReactNode;
  params: Promise<{ accountId: string }>;
};

const visualizationEntry: CollapsibleNavEntry = {
  type: "collapsible",
  label: m.settings.nav.visualization,
  subLinks: [
    { href: "dashboards/monthly", label: m.settings.nav.dashboards.monthly },
    { href: "dashboards/yearly", label: m.settings.nav.dashboards.yearly },
    { href: "dashboards/month-summary", label: m.settings.nav.dashboards.monthSummary },
  ],
};

const editorLinks = [
  { href: "general", label: m.settings.nav.general },
  { href: "sections", label: m.settings.nav.sections },
  { href: "categories", label: m.settings.nav.categories },
  { href: "institutions", label: m.settings.nav.institutions },
  { href: "responsibles", label: m.settings.nav.responsibles },
  { href: "aliases", label: m.settings.nav.aliases },
  { href: "checklist", label: m.settings.nav.checklist },
  { href: "table-types", label: m.settings.nav.tableTypes },
  { href: "models", label: "Modelos de tabela" },
  { href: "templates", label: m.settings.nav.templates },
  { href: "forecast", label: m.settings.nav.forecast },
  visualizationEntry,
  { href: "connectors", label: m.settings.nav.connectors },
];

export default async function SettingsLayout({ children, params }: Props) {
  const { accountId } = await params;
  const { member } = await requireAccountAccess(accountId).catch(() => redirect("/home"));

  if (member.role === "viewer") redirect(`/${accountId}`);

  const isOwner = member.role === "owner";
  const ownerLinks = isOwner
    ? [
        { href: "members", label: m.settings.nav.members },
        { href: "audit", label: m.settings.nav.audit },
      ]
    : [];

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "calc(100vh - 48px)",
        flexDirection: { xs: "column", md: "row" },
      }}
    >
      <SettingsNav accountId={accountId} editorLinks={editorLinks} ownerLinks={ownerLinks} />
      <Box sx={{ flex: 1, overflow: "auto" }}>{children}</Box>
    </Box>
  );
}
