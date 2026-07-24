"use client";

import MenuIcon from "@mui/icons-material/Menu";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { CollapsibleNavItem } from "@/components/settings/CollapsibleNavItem";
import { isCollapsibleNavEntry } from "@/components/settings/settings-nav-groups";
import type { NavEntry, NavGroup } from "@/components/settings/settings-nav-groups";
import { AppLink } from "@/components/ui/AppLink";

export type {
  CollapsibleNavEntry,
  NavEntry,
  NavGroup,
  NavLink,
} from "@/components/settings/settings-nav-groups";

const DRAWER_WIDTH = 220;

type Props = {
  accountId: string;
  groups: NavGroup[];
};

function renderEntry(
  entry: NavEntry,
  accountId: string,
  pathname: string,
  onNavigate?: () => void,
) {
  if (isCollapsibleNavEntry(entry)) {
    const isAnySubActive = entry.subLinks.some((sub) => {
      const fullHref = `/${accountId}/settings/${sub.href}`;
      return pathname === fullHref || pathname.startsWith(`${fullHref}/`);
    });
    return (
      <CollapsibleNavItem
        key={entry.label}
        label={entry.label}
        subLinks={entry.subLinks}
        accountId={accountId}
        pathname={pathname}
        defaultOpen={isAnySubActive}
        onNavigate={onNavigate}
      />
    );
  }

  const { href, label } = entry;
  const fullHref = `/${accountId}/settings/${href}`;
  const isActive = pathname === fullHref || pathname.startsWith(`${fullHref}/`);
  return (
    <ListItem key={href} disablePadding>
      <ListItemButton
        component={AppLink}
        href={fullHref}
        selected={isActive}
        onClick={onNavigate}
        sx={{
          borderRadius: 0,
          "&.Mui-selected": {
            bgcolor: "background.subtle",
            borderRight: 2,
            borderColor: "primary.main",
            "& .MuiListItemText-primary": { color: "primary.main", fontWeight: 600 },
          },
        }}
      >
        <ListItemText primary={label} />
      </ListItemButton>
    </ListItem>
  );
}

function NavItems({
  accountId,
  groups,
  pathname,
  onNavigate,
}: Props & { pathname: string; onNavigate?: () => void }) {
  return (
    <Box sx={{ pt: 2 }}>
      {groups.map((group) => (
        <Box key={group.label} sx={{ mb: 1 }}>
          <Typography variant="overline" sx={{ px: 2, color: "text.secondary" }}>
            {group.label}
          </Typography>
          <List dense disablePadding sx={{ mt: 1 }}>
            {group.entries.map((entry) => renderEntry(entry, accountId, pathname, onNavigate))}
          </List>
        </Box>
      ))}
    </Box>
  );
}

export function SettingsNav({ accountId, groups }: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Hamburger — mobile only */}
      <Box
        sx={{
          display: { xs: "flex", md: "none" },
          alignItems: "center",
          px: 2,
          py: 1,
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <IconButton
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menu de configurações"
          size="small"
        >
          <MenuIcon />
        </IconButton>
        <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
          Configurações
        </Typography>
      </Box>

      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box" },
        }}
      >
        <NavItems
          accountId={accountId}
          groups={groups}
          pathname={pathname}
          onNavigate={() => setMobileOpen(false)}
        />
      </Drawer>

      {/* Desktop permanent sidebar */}
      <Box
        component="nav"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          borderRight: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
          display: { xs: "none", md: "block" },
        }}
      >
        <NavItems accountId={accountId} groups={groups} pathname={pathname} />
      </Box>
    </>
  );
}
