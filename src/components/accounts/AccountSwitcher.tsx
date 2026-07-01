"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Divider from "@mui/material/Divider";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";

import { AppLink } from "@/components/ui/AppLink";
import { m } from "@/lib/messages";

type Account = { id: string; name: string };

type Props = {
  currentAccountId: string;
  currentAccountName: string;
  otherAccounts: Account[];
};

export function AccountSwitcher({ currentAccountId, currentAccountName, otherAccounts }: Props) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const router = useRouter();

  if (otherAccounts.length === 0) {
    return (
      <Typography
        variant="h4"
        component={AppLink}
        href={`/${currentAccountId}`}
        sx={{ flexGrow: 1, textDecoration: "none", color: "inherit" }}
      >
        {currentAccountName}
      </Typography>
    );
  }

  return (
    <Box sx={{ flexGrow: 1 }}>
      <ButtonBase
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          borderRadius: 1,
          px: 1,
          py: 0.5,
          ml: -1,
          color: "inherit",
          transition: "background-color 120ms",
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        <Typography variant="h4" component="span" color="inherit">
          {currentAccountName}
        </Typography>
        <ArrowDropDownIcon fontSize="small" sx={{ opacity: 0.7 }} />
      </ButtonBase>

      <Menu
        anchorEl={anchorEl}
        open={!!anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        disableScrollLock
        slotProps={{ paper: { sx: { minWidth: 220 } } }}
      >
        {/* Conta ativa — não interativa */}
        <MenuItem disabled sx={{ opacity: "1 !important" }}>
          <ListItemText
            primary={currentAccountName}
            primaryTypographyProps={{ variant: "body2", fontWeight: "medium" }}
          />
          <Typography variant="caption" color="text.disabled" sx={{ ml: 1, flexShrink: 0 }}>
            ativa
          </Typography>
        </MenuItem>

        <Divider />

        {otherAccounts.map((account) => (
          <MenuItem
            key={account.id}
            onClick={() => {
              setAnchorEl(null);
              router.push(`/${account.id}`);
            }}
          >
            <ListItemText primary={account.name} primaryTypographyProps={{ variant: "body2" }} />
          </MenuItem>
        ))}

        <Divider />

        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            router.push(`/accounts/new?from=/${currentAccountId}`);
          }}
        >
          <ListItemIcon>
            <AddIcon fontSize="small" sx={{ color: "primary.main" }} />
          </ListItemIcon>
          <ListItemText
            primary={m.account.newAccount}
            primaryTypographyProps={{ variant: "body2", color: "primary.main" }}
          />
        </MenuItem>
      </Menu>
    </Box>
  );
}
