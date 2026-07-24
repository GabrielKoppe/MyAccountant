"use client";

import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import NotificationsIcon from "@mui/icons-material/Notifications";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { listAndMarkAllReadAction } from "@/actions/notifications";
import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import type { NotificationItem } from "@/server/services/notification-service";

/** Altura máxima da região de scroll da lista dentro do Menu (o Popover antigo era 480px;
 * dentro do Menu de 240px a lista precisa do seu próprio scroll, mais compacto). */
const NOTIFICATIONS_SCROLL_MAX_HEIGHT = 320;

type Props = {
  accountId: string;
  /** Chamado quando a lista é carregada e marcada como lida (host zera o badge). */
  onAllRead: () => void;
  /** Fecha o Menu do usuário inteiro antes de navegar (NAV-02b). */
  onCloseMenu: () => void;
};

function NotificationIcon({ type }: { type: string }) {
  switch (type) {
    case "transactions_added":
      return <AddCircleOutlineIcon fontSize="small" sx={{ color: "success.main" }} />;
    case "transaction_deleted":
      return <DeleteOutlineIcon fontSize="small" sx={{ color: "danger.main" }} />;
    case "invite_accepted":
      return <PersonAddAlt1Icon fontSize="small" sx={{ color: "accent.primary" }} />;
    default:
      return <NotificationsIcon fontSize="small" sx={{ color: "text.secondary" }} />;
  }
}

/**
 * Seção "Notificações" que vive DENTRO do Menu do usuário (rodapé da sidebar / AppBar interina).
 *
 * Fronteira (NAV-02b): a contagem/badge/polling vivem no host sempre-montado (UserMenuButton),
 * FORA do Menu que desmonta ao fechar. Aqui moram apenas a LISTA e o estado de expansão.
 *
 * Marcação como lida dispara SÓ ao expandir a seção (`onChange`-expand) — abrir o Menu para
 * outro fim (tema/cor/conta/logout) não pode zerar o badge sem o usuário ver as notificações.
 */
export function NotificationsMenuSection({ accountId, onAllRead, onCloseMenu }: Props) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function handleChange(_event: React.SyntheticEvent, expanded: boolean) {
    // Carrega + marca como lido apenas na primeira expansão desta sessão de Menu.
    if (!expanded || loaded) return;
    setLoading(true);
    const result = await listAndMarkAllReadAction(accountId, {});
    setLoading(false);
    setLoaded(true);
    if (result.ok) {
      setNotifications(result.data);
      onAllRead();
    }
  }

  function handleNotificationClick(notification: NotificationItem) {
    if (!notification.link) return;
    // NAV-02b: fecha o Menu inteiro ANTES do push. `link` É o monthId (sem `?tab`).
    onCloseMenu();
    router.push(`/${accountId}/months/${notification.link}`);
  }

  return (
    <Accordion
      elevation={0}
      disableGutters
      onChange={handleChange}
      sx={{
        bgcolor: "transparent",
        "&:before": { display: "none" },
        "&.Mui-expanded": { margin: 0 },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon sx={{ fontSize: 16, color: "text.disabled" }} />}
        aria-label={m.notifications.title}
        sx={{
          px: layout.inline,
          minHeight: 44,
          "&.Mui-expanded": { minHeight: 44 },
          "& .MuiAccordionSummary-content": {
            my: layout.micro,
            "&.Mui-expanded": { my: layout.micro },
          },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: layout.inline }}>
          <NotificationsIcon fontSize="small" sx={{ color: "text.secondary" }} />
          <Typography variant="body2">{m.notifications.title}</Typography>
        </Box>
      </AccordionSummary>

      <AccordionDetails
        sx={{ p: 0, maxHeight: NOTIFICATIONS_SCROLL_MAX_HEIGHT, overflowY: "auto" }}
      >
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: layout.card }}>
            <CircularProgress size={24} />
          </Box>
        ) : notifications.length === 0 ? (
          <Box sx={{ py: layout.card, px: layout.inline, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              {m.notifications.empty}
            </Typography>
            <Typography
              variant="caption"
              color="text.disabled"
              display="block"
              sx={{ mt: layout.micro }}
            >
              {m.notifications.emptyHint}
            </Typography>
          </Box>
        ) : (
          <List dense disablePadding>
            {notifications.map((notification, index) => {
              const hasLink = Boolean(notification.link);
              const unreadDot = !notification.isRead;
              const timeAgo = formatDistanceToNow(new Date(notification.createdAt), {
                locale: ptBR,
                addSuffix: true,
              });

              const itemContent = (
                <>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <NotificationIcon type={notification.type} />
                  </ListItemIcon>
                  <ListItemText
                    primary={notification.title}
                    secondary={timeAgo}
                    primaryTypographyProps={{
                      variant: "body2",
                      fontWeight: unreadDot ? 600 : 400,
                      sx: { pr: unreadDot ? layout.inline : 0 },
                    }}
                    secondaryTypographyProps={{ variant: "caption" }}
                  />
                  {unreadDot && (
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        bgcolor: "accent.primary",
                        flexShrink: 0,
                        alignSelf: "center",
                      }}
                    />
                  )}
                </>
              );

              return (
                <Box key={notification.id}>
                  {index > 0 && <Divider />}
                  {hasLink ? (
                    <ListItemButton
                      onClick={() => handleNotificationClick(notification)}
                      sx={{ py: layout.inline, px: layout.inline }}
                    >
                      {itemContent}
                    </ListItemButton>
                  ) : (
                    <ListItem sx={{ py: layout.inline, px: layout.inline }}>{itemContent}</ListItem>
                  )}
                </Box>
              );
            })}
          </List>
        )}
      </AccordionDetails>
    </Accordion>
  );
}
