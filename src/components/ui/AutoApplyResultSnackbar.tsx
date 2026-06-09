"use client";

import { forwardRef, useState } from "react";
import { useSnackbar } from "notistack";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CloseIcon from "@mui/icons-material/Close";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

import type { AutoApplyResult } from "@/lib/schemas/months";
import { m } from "@/lib/messages";
import { layout } from "@/lib/design-tokens";

type Props = {
  snackbarKey: string | number;
  message: string;
  results: AutoApplyResult[];
};

export const AutoApplyResultSnackbar = forwardRef<HTMLDivElement, Props>(
  function AutoApplyResultSnackbar({ snackbarKey, message, results }, ref) {
  const { closeSnackbar } = useSnackbar();
  const [expanded, setExpanded] = useState(false);

  const failureCount = results.filter((r) => !r.success).length;
  const hasFailures = failureCount > 0;

  return (
    <Paper
      ref={ref}
      elevation={0}
      sx={{
        border: 1,
        borderColor: hasFailures ? "warning.main" : "border.default",
        borderRadius: "8px",
        bgcolor: "background.surface",
        p: layout.inline,
        minWidth: 280,
        maxWidth: 380,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={layout.inline}>
        {hasFailures ? (
          <WarningAmberIcon sx={{ fontSize: 18, color: "warning.main", flexShrink: 0 }} />
        ) : (
          <TaskAltIcon sx={{ fontSize: 18, color: "success.main", flexShrink: 0 }} />
        )}
        <Typography variant="body2" sx={{ flex: 1, color: "text.primary" }}>
          {message}
        </Typography>
        <Tooltip title={m.months.autoAppliedDetails}>
          <IconButton
            size="small"
            onClick={() => setExpanded((v) => !v)}
            sx={{
              transition: "transform 0.2s",
              transform: expanded ? "rotate(180deg)" : "none",
            }}
          >
            <ExpandMoreIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <IconButton size="small" onClick={() => closeSnackbar(snackbarKey)}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>

      <Collapse in={expanded}>
        <Stack spacing={0.5} sx={{ mt: layout.inline, pl: layout.inline }}>
          {results.map((r, i) => (
            <Stack key={i} direction="row" alignItems="center" spacing={layout.inline}>
              {r.success ? (
                <CheckCircleOutlineIcon sx={{ fontSize: 14, color: "success.main", flexShrink: 0 }} />
              ) : (
                <Tooltip title={r.error ?? "Erro desconhecido"} placement="right">
                  <ErrorOutlineIcon sx={{ fontSize: 14, color: "danger.main", flexShrink: 0 }} />
                </Tooltip>
              )}
              <Typography
                variant="caption"
                color={r.success ? "text.secondary" : "danger.main"}
                sx={{ lineHeight: 1.4 }}
              >
                {r.templateName}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </Collapse>
    </Paper>
  );
});
