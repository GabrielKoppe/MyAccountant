"use client";

import AttachFileOutlinedIcon from "@mui/icons-material/AttachFileOutlined";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import { m } from "@/lib/messages";

type Props = {
  count: number;
  onClick: () => void;
  expanded?: boolean;
};

const BTN_SX = { p: 1, minWidth: 32, minHeight: 32 } as const;

/** Indicador de anexos (📎N) — abre a gaveta de leitura da linha (spec 62 §2.1). */
export function AttachmentIndicator({ count, onClick, expanded }: Props) {
  const label = m.transactions.attachments.view(count);
  return (
    <Tooltip title={label}>
      <IconButton
        size="small"
        aria-label={label}
        aria-expanded={expanded}
        onClick={onClick}
        sx={{ ...BTN_SX, color: "text.secondary", mr: 1 }}
      >
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.25 }}>
          <AttachFileOutlinedIcon sx={{ fontSize: 18 }} />
          <Typography component="span" variant="caption" sx={{ color: "text.secondary" }}>
            {count}
          </Typography>
        </Box>
      </IconButton>
    </Tooltip>
  );
}
