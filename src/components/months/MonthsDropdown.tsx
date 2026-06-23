"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";

import IconButton from "@mui/material/IconButton";
import Popover from "@mui/material/Popover";
import Typography from "@mui/material/Typography";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Tooltip from "@mui/material/Tooltip";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";

type MonthItem = { id: string; label: string };

type Props = {
  accountId: string;
  months: MonthItem[];
};

export function MonthsDropdown({ accountId, months }: Props) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const router = useRouter();

  return (
    <>
      <Tooltip title="Meses">
        <IconButton
          color="inherit"
          size="small"
          aria-label="Meses"
          onClick={(e) => setAnchor(e.currentTarget)}
        >
          <CalendarTodayIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { mt: 0.5 } } }}
      >
        <Box
          sx={{
            width: 200,
            border: 1,
            borderColor: "border.subtle",
            borderRadius: "8px",
            overflow: "hidden",
          }}
        >
          <Box sx={{ px: 2, py: 1.25, borderBottom: 1, borderColor: "divider" }}>
            <Typography variant="body2" fontWeight={600} color="text.primary">
              Meses recentes
            </Typography>
          </Box>

          {months.length === 0 ? (
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="caption" color="text.disabled">
                Nenhum mês criado
              </Typography>
            </Box>
          ) : (
            <List dense disablePadding>
              {months.map((month) => (
                <ListItemButton
                  key={month.id}
                  onClick={() => {
                    setAnchor(null);
                    router.push(`/${accountId}/months/${month.id}`);
                  }}
                  sx={{ py: 0.75, px: 2, fontSize: 13 }}
                >
                  <ListItemText
                    primary={month.label}
                    primaryTypographyProps={{ variant: "body2", sx: { fontSize: 13 } }}
                  />
                </ListItemButton>
              ))}
            </List>
          )}
        </Box>
      </Popover>
    </>
  );
}
