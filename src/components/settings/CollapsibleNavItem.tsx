"use client";

import { useState } from "react";
import Collapse from "@mui/material/Collapse";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import { NavCount } from "@/components/settings/NavCount";
import { AppLink } from "@/components/ui/AppLink";

type SubLink = { href: string; label: string; count?: string };

type Props = {
  label: string;
  subLinks: SubLink[];
  accountId: string;
  pathname: string;
  /** Contagem barata do grupo (Spec 67 §4 SET-01). */
  count?: string;
  defaultOpen?: boolean;
  onNavigate?: () => void;
};

export function CollapsibleNavItem({
  label,
  subLinks,
  accountId,
  pathname,
  count,
  defaultOpen = false,
  onNavigate,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <>
      <ListItem disablePadding>
        <ListItemButton onClick={() => setOpen((v) => !v)} sx={{ borderRadius: 0 }}>
          {/* Idem `SettingsNav`: rótulo truncável para a contagem (que não
              encolhe) não colidir com ele nos 220px do nav. */}
          <ListItemText
            primary={label}
            primaryTypographyProps={{ fontSize: "0.82rem", fontWeight: 500, noWrap: true }}
            sx={{ minWidth: 0, my: 0 }}
          />
          {count !== undefined && <NavCount value={count} />}
          {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </ListItemButton>
      </ListItem>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <List dense disablePadding>
          {subLinks.map(({ href, label: subLabel, count: subCount }) => {
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
                    pl: 4,
                    borderRadius: 0,
                    "&.Mui-selected": {
                      bgcolor: "background.subtle",
                      borderRight: 2,
                      borderColor: "primary.main",
                      "& .MuiListItemText-primary": { color: "primary.main", fontWeight: 600 },
                    },
                  }}
                >
                  <ListItemText
                    primary={subLabel}
                    primaryTypographyProps={{ variant: "body2", noWrap: true }}
                    sx={{ minWidth: 0, my: 0 }}
                  />
                  {subCount !== undefined && <NavCount value={subCount} />}
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Collapse>
    </>
  );
}
