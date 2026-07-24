"use client";

import AddIcon from "@mui/icons-material/Add";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Divider from "@mui/material/Divider";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AppLink } from "@/components/ui/AppLink";
import { m } from "@/lib/messages";

type Account = { id: string; name: string };

type Props = {
  currentAccountId: string;
  currentAccountName: string;
  otherAccounts: Account[];
  /**
   * Spec 65 §7.6/§10.3 (P1) — prop-gated: **ausente** (`undefined`) preserva
   * o render legado (usado hoje na AppBar interina — intocado). `false` =
   * sidebar expandida (nome truncado com ellipsis). `true` = rail recolhido
   * (só as iniciais da conta + `Tooltip` com o nome completo).
   */
  collapsed?: boolean;
};

/** Iniciais da conta para o rail recolhido (ex.: "Família Koppe" → "FK"). */
function getAccountInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0].charAt(0)}${words[1].charAt(0)}`.toUpperCase();
}

const railAvatarSx = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 36,
  height: 36,
  borderRadius: "50%",
  bgcolor: "background.subtle",
  color: "text.primary",
  fontSize: 14,
  fontWeight: 600,
} as const;

const truncatedNameSx = {
  fontWeight: 600,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  minWidth: 0,
} as const;

export function AccountSwitcher({
  currentAccountId,
  currentAccountName,
  otherAccounts,
  collapsed,
}: Props) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const router = useRouter();

  // undefined = render legado (AppBar interina — intocado até a troca de shell em P2).
  const isLegacy = collapsed === undefined;
  const isRail = collapsed === true;
  const initials = getAccountInitials(currentAccountName);

  if (otherAccounts.length === 0) {
    if (isLegacy) {
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

    if (isRail) {
      return (
        <Tooltip title={currentAccountName} placement="right">
          <Typography
            component={AppLink}
            href={`/${currentAccountId}`}
            sx={{ ...railAvatarSx, mx: "auto", textDecoration: "none" }}
          >
            {initials}
          </Typography>
        </Tooltip>
      );
    }

    // Conta única: nome ocupando a largura total (sem ícone — nada a alternar).
    return (
      <Typography
        variant="subtitle1"
        component={AppLink}
        href={`/${currentAccountId}`}
        sx={{ display: "block", width: "100%", textDecoration: "none", color: "inherit", ...truncatedNameSx }}
      >
        {currentAccountName}
      </Typography>
    );
  }

  return (
    <Box
      sx={{
        minWidth: 0,
        ...(isLegacy && { flexGrow: 1 }),
        ...(isRail && { display: "flex", justifyContent: "center" }),
        ...(!isLegacy && !isRail && { width: "100%" }),
      }}
    >
      {isRail ? (
        <Tooltip title={currentAccountName} placement="right">
          <ButtonBase onClick={(e) => setAnchorEl(e.currentTarget)} sx={railAvatarSx}>
            {initials}
          </ButtonBase>
        </Tooltip>
      ) : (
        <ButtonBase
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            borderRadius: 1,
            color: "inherit",
            transition: "background-color 120ms",
            "&:hover": { bgcolor: "action.hover" },
            // Sidebar expandida: linha em largura total (nome à esquerda, ícone à direita — frame).
            ...(isLegacy
              ? { px: 1, py: 0.5, ml: -1, maxWidth: "100%", minWidth: 0 }
              : { width: "100%", justifyContent: "space-between", px: 1, py: 0.75, minWidth: 0 }),
          }}
        >
          <Typography
            variant={isLegacy ? "h4" : "subtitle1"}
            component="span"
            color="inherit"
            sx={isLegacy ? undefined : truncatedNameSx}
          >
            {currentAccountName}
          </Typography>
          <UnfoldMoreIcon fontSize="small" sx={{ opacity: 0.6, flexShrink: 0, ml: 1 }} />
        </ButtonBase>
      )}

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
