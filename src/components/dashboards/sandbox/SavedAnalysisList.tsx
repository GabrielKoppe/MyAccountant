"use client";

import { useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PushPinIcon from "@mui/icons-material/PushPin";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import { useSnackbar } from "notistack";

import { m } from "@/lib/messages";
import type { SandboxConfig, SandboxDashboardContext } from "@/lib/schemas/sandbox";
import type { SavedAnalysisSummary } from "@/lib/queries/sandbox";
import {
  saveSandboxAnalysisAction,
  deleteSandboxAnalysisAction,
  togglePinAnalysisAction,
} from "@/actions/sandbox";

type Props = {
  accountId: string;
  analyses: SavedAnalysisSummary[];
  currentConfig: SandboxConfig;
  currentUserId: string;
  role: string;
  onLoad: (config: SandboxConfig) => void;
  onRefresh: () => void;
};

export function SavedAnalysisList({
  accountId,
  analyses,
  currentConfig,
  currentUserId,
  role,
  onLoad,
  onRefresh,
}: Props) {
  const ms = m.dashboards.sandbox;
  const { enqueueSnackbar } = useSnackbar();
  const [saveName, setSaveName] = useState("");
  const [dashboardContext, setDashboardContext] = useState<SandboxDashboardContext>("yearly");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    if (!saveName.trim()) return;
    startTransition(async () => {
      const result = await saveSandboxAnalysisAction(accountId, {
        name: saveName.trim(),
        config: currentConfig,
        dashboardContext,
        isPinned: false,
      });
      if (result.ok) {
        enqueueSnackbar(ms.analysisSaved, { variant: "success" });
        setSaveName("");
        onRefresh();
      } else {
        enqueueSnackbar(result.error.message, { variant: "error" });
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteSandboxAnalysisAction(accountId, { analysisId: id });
      if (result.ok) {
        enqueueSnackbar(ms.analysisDeleted, { variant: "success" });
        onRefresh();
      } else {
        enqueueSnackbar(result.error.message, { variant: "error" });
      }
    });
  }

  function handleTogglePin(id: string, isPinned: boolean) {
    startTransition(async () => {
      const result = await togglePinAnalysisAction(accountId, { analysisId: id, isPinned });
      if (result.ok) {
        enqueueSnackbar(isPinned ? ms.analysisPinned : ms.analysisUnpinned, { variant: "success" });
        onRefresh();
      } else {
        enqueueSnackbar(result.error.message, { variant: "error" });
      }
    });
  }

  return (
    <Box>
      {/* Save form */}
      <Box sx={{ mb: 1.5 }}>
        <Typography
          sx={{
            fontSize: "0.68rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "text.secondary",
            mb: 0.5,
          }}
        >
          {ms.saveAnalysis}
        </Typography>
        <TextField
          size="small"
          fullWidth
          placeholder={ms.namePlaceholder}
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          sx={{ mb: 0.75, "& input": { fontSize: "0.8125rem" } }}
        />
        <Box sx={{ mb: 0.75 }}>
          <Typography sx={{ fontSize: "0.68rem", color: "text.secondary", mb: 0.5 }}>
            {ms.context.label}
          </Typography>
          <ToggleButtonGroup
            size="small"
            value={dashboardContext}
            exclusive
            onChange={(_, v) => v && setDashboardContext(v)}
            sx={{ "& .MuiToggleButton-root": { fontSize: "0.7rem", py: 0.25 } }}
          >
            <ToggleButton value="yearly">{ms.context.yearly}</ToggleButton>
            <ToggleButton value="monthly">{ms.context.monthly}</ToggleButton>
            <ToggleButton value="both">{ms.context.both}</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        <Button
          size="small"
          variant="contained"
          fullWidth
          disabled={!saveName.trim() || isPending}
          onClick={handleSave}
          sx={{ fontSize: "0.8125rem" }}
        >
          {isPending ? <CircularProgress size={14} /> : ms.saveAnalysis}
        </Button>
      </Box>

      <Divider sx={{ mb: 1 }} />

      {/* List */}
      <Typography
        sx={{
          fontSize: "0.68rem",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "text.secondary",
          mb: 0.5,
        }}
      >
        {ms.savedList.title}
      </Typography>

      {analyses.length === 0 ? (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          {ms.savedList.emptyHint}
        </Typography>
      ) : (
        <List dense disablePadding>
          {analyses.map((a) => {
            const canDelete = a.createdById === currentUserId || role === "owner";
            const contextColor: Record<
              SandboxDashboardContext,
              "default" | "primary" | "secondary"
            > = {
              yearly: "default",
              monthly: "primary",
              both: "secondary",
            };
            return (
              <ListItem
                key={a.id}
                disablePadding
                secondaryAction={
                  <Box sx={{ display: "flex", gap: 0.25 }}>
                    <Tooltip title={a.isPinned ? ms.unpinToggle : ms.pinToggle}>
                      <IconButton
                        size="small"
                        onClick={() => handleTogglePin(a.id, !a.isPinned)}
                        disabled={isPending}
                      >
                        {a.isPinned ? (
                          <PushPinIcon sx={{ fontSize: 14, color: "primary.main" }} />
                        ) : (
                          <PushPinOutlinedIcon sx={{ fontSize: 14 }} />
                        )}
                      </IconButton>
                    </Tooltip>
                    {canDelete && (
                      <Tooltip title={ms.deleteAnalysis}>
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(a.id)}
                          disabled={isPending}
                        >
                          <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                }
              >
                <ListItemButton
                  onClick={() => onLoad(a.config)}
                  sx={{ py: 0.5, pr: 7, borderRadius: 1 }}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <Typography sx={{ fontSize: "0.8125rem", lineHeight: 1.3 }}>
                          {a.name}
                        </Typography>
                        <Chip
                          label={a.dashboardContext}
                          size="small"
                          color={contextColor[a.dashboardContext]}
                          sx={{ height: 14, fontSize: "0.6rem" }}
                        />
                      </Box>
                    }
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      )}
    </Box>
  );
}
