import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";

import { requireAccountAccess } from "@/server/auth/session";
import { AppLink } from "@/components/ui/AppLink";
import { m } from "@/lib/messages";

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

const ownerLinks = [
  { href: "members", label: m.settings.nav.members },
  { href: "account", label: m.settings.nav.account },
];

export default async function SettingsLayout({ children, params }: Props) {
  const { accountId } = await params;
  const { member } = await requireAccountAccess(accountId).catch(() => redirect("/home"));

  if (member.role === "viewer") redirect(`/${accountId}`);

  const isOwner = member.role === "owner";

  return (
    <Box sx={{ display: "flex", minHeight: "calc(100vh - 48px)" }}>
      {/* Sidebar */}
      <Box
        component="nav"
        sx={{
          width: 220,
          flexShrink: 0,
          borderRight: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
          pt: 2,
        }}
      >
        <Typography variant="overline" sx={{ px: 2, color: "text.secondary" }}>
          Configurações
        </Typography>
        <List dense disablePadding sx={{ mt: 1 }}>
          {editorLinks.map(({ href, label }) => (
            <ListItem key={href} disablePadding>
              <ListItemButton
                component={AppLink}
                href={`/${accountId}/settings/${href}`}
                sx={{ borderRadius: 0 }}
              >
                <ListItemText primary={label} />
              </ListItemButton>
            </ListItem>
          ))}

          {isOwner && (
            <>
              <Divider sx={{ my: 1 }} />
              {ownerLinks.map(({ href, label }) => (
                <ListItem key={href} disablePadding>
                  <ListItemButton
                    component={AppLink}
                    href={`/${accountId}/settings/${href}`}
                    sx={{ borderRadius: 0 }}
                  >
                    <ListItemText primary={label} />
                  </ListItemButton>
                </ListItem>
              ))}
            </>
          )}
        </List>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: "auto" }}>{children}</Box>
    </Box>
  );
}
