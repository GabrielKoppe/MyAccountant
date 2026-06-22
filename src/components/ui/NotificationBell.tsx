"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Popover from "@mui/material/Popover";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { default as NotificationsNoneIcon } from "@mui/icons-material/Notifications";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

import { listAndMarkAllReadAction } from "@/actions/notifications";
import { m } from "@/lib/messages";
import type { NotificationItem } from "@/server/services/notification-service";

const POLL_INTERVAL_MS = 5 * 60_000; // 5 minutos
const FOCUS_DEBOUNCE_MS = 30_000; // 30 segundos

type Props = {
  accountId: string;
  initialUnreadCount: number;
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
      return <NotificationsNoneIcon fontSize="small" sx={{ color: "text.secondary" }} />;
  }
}

export function NotificationBell({ accountId, initialUnreadCount }: Props) {
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const lastFetchRef = useRef<number>(0);

  const refreshCount = useCallback(async () => {
    // Não faz fetch se a aba está oculta
    if (document.visibilityState === "hidden") return;
    try {
      const res = await fetch(`/api/v1/accounts/${accountId}/notifications`);
      if (res.ok) {
        const data = (await res.json()) as { unreadCount: number };
        setUnreadCount(data.unreadCount);
        lastFetchRef.current = Date.now();
      }
    } catch {
      // polling — falha silenciosa
    }
  }, [accountId]);

  useEffect(() => {
    const id = setInterval(() => void refreshCount(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refreshCount]);

  useEffect(() => {
    const onFocus = () => {
      // Só refetch se último fetch tem mais de 30 segundos
      if (Date.now() - lastFetchRef.current > FOCUS_DEBOUNCE_MS) {
        void refreshCount();
      }
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshCount]);

  async function handleOpen(event: React.MouseEvent<HTMLButtonElement>) {
    setAnchorEl(event.currentTarget);
    setLoading(true);
    const result = await listAndMarkAllReadAction(accountId, {});
    setLoading(false);
    if (result.ok) {
      setNotifications(result.data);
      setUnreadCount(0);
    }
  }

  function handleClose() {
    setAnchorEl(null);
  }

  function handleNotificationClick(notification: NotificationItem) {
    handleClose();
    if (notification.link) {
      router.push(`/${accountId}/months/${notification.link}`);
    }
  }

  const open = Boolean(anchorEl);

  return (
    <>
      <Tooltip title={m.notifications.title}>
        <IconButton color="inherit" aria-label={m.notifications.title} onClick={handleOpen}>
          <Badge badgeContent={unreadCount > 0 ? unreadCount : undefined} color="error" max={99}>
            <NotificationsNoneIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        disableScrollLock
        slotProps={{ paper: { sx: { width: 360, maxHeight: 480 } } }}
      >
        {/* Header */}
        <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: "divider" }}>
          <Typography variant="subtitle2">{m.notifications.title}</Typography>
        </Box>

        {/* Content */}
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : notifications.length === 0 ? (
          <Box sx={{ py: 4, px: 2, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              {m.notifications.empty}
            </Typography>
            <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 0.5 }}>
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
                      sx: { pr: unreadDot ? 1.5 : 0 },
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
                      sx={{ py: 1.5, px: 2 }}
                    >
                      {itemContent}
                    </ListItemButton>
                  ) : (
                    <ListItem sx={{ py: 1.5, px: 2 }}>{itemContent}</ListItem>
                  )}
                </Box>
              );
            })}
          </List>
        )}
      </Popover>
    </>
  );
}
