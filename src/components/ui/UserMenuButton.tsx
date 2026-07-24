"use client";

import CheckIcon from "@mui/icons-material/Check";
import ComputerIcon from "@mui/icons-material/Computer";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LightModeIcon from "@mui/icons-material/LightMode";
import LogoutIcon from "@mui/icons-material/Logout";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Avatar from "@mui/material/Avatar";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { logoutAction } from "@/actions/auth";
import { useThemeMode, type ThemeMode } from "@/components/providers/ThemeContext";
import { NotificationsMenuSection } from "@/components/ui/NotificationsMenuSection";
import { ACCENT_COLORS, type AccentColorKey } from "@/lib/accent-colors";

const POLL_INTERVAL_MS = 5 * 60_000; // 5 minutos
const FOCUS_DEBOUNCE_MS = 30_000; // 30 segundos

type Props = {
  userName: string | null | undefined;
  userImage: string | null | undefined;
  /** Quando presente, o host passa a hospedar as notificações (badge/polling + seção-lista). */
  accountId?: string;
  initialUnreadCount?: number;
  /**
   * Direção de abertura do menu. `"top"` abre para CIMA (uso no rodapé da
   * `AppSidebar`, onde não há espaço abaixo); `"bottom"` (default) para baixo
   * (uso em barras de topo — accounts/select-account).
   */
  menuPlacement?: "top" | "bottom";
};

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
  { value: "light", label: "Claro", icon: <LightModeIcon fontSize="small" /> },
  { value: "dark", label: "Escuro", icon: <DarkModeIcon fontSize="small" /> },
  { value: "system", label: "Automático (sistema)", icon: <ComputerIcon fontSize="small" /> },
];

export function UserMenuButton({
  userName,
  userImage,
  accountId,
  initialUnreadCount,
  menuPlacement = "bottom",
}: Props) {
  const opensUp = menuPlacement === "top";
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const router = useRouter();
  const { mode, setMode, accentColor, setAccentColor } = useThemeMode();

  const initials = userName?.charAt(0).toUpperCase() ?? "?";

  // ─── Notificações: contagem/badge/polling vivem AQUI (host sempre-montado), fora do Menu
  //     que desmonta ao fechar e pararia o polling (NAV-02b). A lista mora na seção do Menu. ──
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount ?? 0);
  const lastFetchRef = useRef(0);

  const refreshCount = useCallback(async () => {
    if (!accountId) return;
    // Não faz fetch se a aba está oculta.
    if (document.visibilityState === "hidden") return;
    try {
      const res = await fetch(`/api/v1/accounts/${accountId}/notifications`);
      if (res.ok) {
        // A rota responde { ok, data: { unreadCount } } — ler json.data.unreadCount
        // (o bell antigo lia json.unreadCount → sempre undefined; bug corrigido aqui).
        const json = (await res.json()) as { data: { unreadCount: number } };
        setUnreadCount(json.data.unreadCount);
        lastFetchRef.current = Date.now();
      }
    } catch {
      // polling — falha silenciosa
    }
  }, [accountId]);

  useEffect(() => {
    if (!accountId) return;
    const id = setInterval(() => void refreshCount(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [accountId, refreshCount]);

  useEffect(() => {
    if (!accountId) return;
    const onFocus = () => {
      // Só refetch se o último fetch tem mais de 30 segundos.
      if (Date.now() - lastFetchRef.current > FOCUS_DEBOUNCE_MS) void refreshCount();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [accountId, refreshCount]);

  async function handleLogout() {
    setAnchorEl(null);
    await logoutAction();
  }

  function handleAccentClick(key: AccentColorKey, e: React.MouseEvent) {
    e.stopPropagation();
    setAccentColor(key);
  }

  return (
    <>
      <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} size="small">
        <Badge badgeContent={unreadCount > 0 ? unreadCount : undefined} color="error" max={99}>
          <Avatar src={userImage ?? undefined} sx={{ width: 32, height: 32, fontSize: 14 }}>
            {initials}
          </Avatar>
        </Badge>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={!!anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={
          opensUp
            ? { vertical: "top", horizontal: "left" }
            : { vertical: "bottom", horizontal: "right" }
        }
        transformOrigin={
          opensUp
            ? { vertical: "bottom", horizontal: "left" }
            : { vertical: "top", horizontal: "right" }
        }
        disableScrollLock
        slotProps={{ paper: { sx: { minWidth: 240 } } }}
      >
        {/* User name */}
        {userName && (
          <MenuItem disabled sx={{ opacity: "1 !important" }}>
            <Typography variant="body2" color="text.secondary" fontWeight="medium">
              {userName}
            </Typography>
          </MenuItem>
        )}

        {/* Notificações — logo ABAIXO do nome do usuário. Só quando há conta em
            contexto (layouts sem conta não recebem accountId). */}
        {accountId && [
          <Divider key="notifications-divider" />,
          <NotificationsMenuSection
            key="notifications"
            accountId={accountId}
            onAllRead={() => setUnreadCount(0)}
            onCloseMenu={() => setAnchorEl(null)}
          />,
        ]}

        <Divider />

        {/* Theme section label */}
        <MenuItem disabled sx={{ opacity: "1 !important", pb: 0 }}>
          <Typography
            variant="caption"
            color="text.disabled"
            fontWeight="bold"
            sx={{ textTransform: "uppercase", letterSpacing: 0.5, fontSize: 10 }}
          >
            Aparência
          </Typography>
        </MenuItem>

        {/* Mode options */}
        {THEME_OPTIONS.map((opt) => (
          <MenuItem
            key={opt.value}
            onClick={() => setMode(opt.value)}
            selected={mode === opt.value}
            sx={{ pl: 2 }}
          >
            <ListItemIcon sx={{ color: mode === opt.value ? "primary.main" : "text.secondary" }}>
              {opt.icon}
            </ListItemIcon>
            <ListItemText
              primary={opt.label}
              primaryTypographyProps={{
                variant: "body2",
                fontWeight: mode === opt.value ? "bold" : "normal",
              }}
            />
            {mode === opt.value && (
              <CheckIcon sx={{ fontSize: 16, color: "primary.main", ml: 1 }} />
            )}
          </MenuItem>
        ))}

        {/* Accent color accordion */}
        <Accordion
          elevation={0}
          disableGutters
          sx={{
            bgcolor: "transparent",
            "&:before": { display: "none" },
            "&.Mui-expanded": { margin: 0 },
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon sx={{ fontSize: 16, color: "text.disabled" }} />}
            sx={{
              px: 2,
              minHeight: "36px !important",
              "& .MuiAccordionSummary-content": { my: 0.5 },
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography
                variant="caption"
                color="text.disabled"
                fontWeight="bold"
                sx={{ textTransform: "uppercase", letterSpacing: 0.5, fontSize: 10 }}
              >
                Cor de destaque
              </Typography>
              {/* Preview of current accent color */}
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  bgcolor:
                    ACCENT_COLORS.find((c) => c.key === accentColor)?.swatch ?? "primary.main",
                  flexShrink: 0,
                }}
              />
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 2, pt: 0, pb: 1.5 }}>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {ACCENT_COLORS.map((color) => {
                const isSelected = accentColor === color.key;
                return (
                  <Tooltip key={color.key} title={color.label} arrow placement="top">
                    <Box
                      component="button"
                      onClick={(e: React.MouseEvent) => handleAccentClick(color.key, e)}
                      sx={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        bgcolor: color.swatch,
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                        position: "relative",
                        flexShrink: 0,
                        outline: isSelected ? `3px solid` : "2px solid transparent",
                        outlineColor: isSelected ? color.swatch : "transparent",
                        outlineOffset: 2,
                        boxShadow: isSelected ? `0 0 0 5px ${color.swatch}22` : "none",
                        transition: "transform 120ms, box-shadow 120ms",
                        "&:hover": { transform: "scale(1.2)" },
                      }}
                    >
                      {isSelected && (
                        <CheckIcon
                          sx={{
                            position: "absolute",
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%, -50%)",
                            fontSize: 12,
                            color: "#fff",
                            pointerEvents: "none",
                          }}
                        />
                      )}
                    </Box>
                  </Tooltip>
                );
              })}
            </Box>
            <Typography variant="caption" color="text.disabled" sx={{ mt: 0.75, display: "block" }}>
              {ACCENT_COLORS.find((c) => c.key === accentColor)?.label ?? ""}
            </Typography>
          </AccordionDetails>
        </Accordion>

        <Divider />

        {/* Account actions */}
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            router.push("/select-account");
          }}
        >
          <ListItemIcon>
            <SwapHorizIcon fontSize="small" />
          </ListItemIcon>
          Trocar conta
        </MenuItem>

        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          Sair
        </MenuItem>
      </Menu>
    </>
  );
}
