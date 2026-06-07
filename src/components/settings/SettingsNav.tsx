"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import MenuIcon from "@mui/icons-material/Menu";

import { AppLink } from "@/components/ui/AppLink";

const DRAWER_WIDTH = 220;

type NavLink = { href: string; label: string };

type Props = {
  accountId: string;
  editorLinks: NavLink[];
  ownerLinks: NavLink[];
};

function NavItems({
  accountId,
  editorLinks,
  ownerLinks,
  pathname,
  onNavigate,
}: Props & { pathname: string; onNavigate?: () => void }) {
  return (
    <Box sx={{ pt: 2 }}>
      <Typography variant="overline" sx={{ px: 2, color: "text.secondary" }}>
        Configurações
      </Typography>
      <List dense disablePadding sx={{ mt: 1 }}>
        {editorLinks.map(({ href, label }) => {
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
        })}

        {ownerLinks.length > 0 && (
          <>
            <Divider sx={{ my: 1 }} />
            {ownerLinks.map(({ href, label }) => {
              const fullHref = `/${accountId}/settings/${href}`;
              const isActive = pathname === fullHref;
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
            })}
          </>
        )}
      </List>
    </Box>
  );
}

export function SettingsNav({ accountId, editorLinks, ownerLinks }: Props) {
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
          editorLinks={editorLinks}
          ownerLinks={ownerLinks}
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
        <NavItems
          accountId={accountId}
          editorLinks={editorLinks}
          ownerLinks={ownerLinks}
          pathname={pathname}
        />
      </Box>
    </>
  );
}
