"use client";

import { useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import DeleteIcon from "@mui/icons-material/Delete";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PushPinIcon from "@mui/icons-material/PushPin";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import { useSnackbar } from "notistack";

import Stack from "@mui/material/Stack";

import { AppLink } from "@/components/ui/AppLink";
import { m } from "@/lib/messages";
import type { SandboxDashboardContext } from "@/lib/schemas/sandbox";
import type { SavedAnalysisSummary } from "@/lib/queries/sandbox";
import {
  deleteSandboxAnalysisAction,
  listSavedAnalysesAction,
  togglePinAnalysisAction,
  saveSandboxAnalysisAction,
} from "@/actions/sandbox";
import PageSettingsContainer from "@/components/settings/PageSettingsContainer";

type Props = {
  accountId: string;
  analyses: SavedAnalysisSummary[];
  currentUserId: string;
  role: string;
};

const contextColors: Record<SandboxDashboardContext, "default" | "primary" | "secondary"> = {
  yearly: "default",
  monthly: "primary",
  both: "secondary",
};

const contextLabels: Record<SandboxDashboardContext, string> = {
  yearly: "Anual",
  monthly: "Mensal",
  both: "Ambos",
};

export function AnalysesManager({
  accountId,
  analyses: initialAnalyses,
  currentUserId,
  role,
}: Props) {
  const ms = m.dashboards.sandbox;
  const { enqueueSnackbar } = useSnackbar();
  const [analyses, setAnalyses] = useState(initialAnalyses);
  const [isPending, startTransition] = useTransition();

  async function refresh() {
    const result = await listSavedAnalysesAction(accountId, {});
    if (result.ok) setAnalyses(result.data);
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const r = await deleteSandboxAnalysisAction(accountId, { analysisId: id });
      if (r.ok) {
        enqueueSnackbar(ms.analysisDeleted, { variant: "success" });
        refresh();
      } else {
        enqueueSnackbar(r.error.message, { variant: "error" });
      }
    });
  }

  function handleTogglePin(id: string, isPinned: boolean) {
    startTransition(async () => {
      const r = await togglePinAnalysisAction(accountId, { analysisId: id, isPinned });
      if (r.ok) {
        enqueueSnackbar(isPinned ? ms.analysisPinned : ms.analysisUnpinned, { variant: "success" });
        refresh();
      } else {
        enqueueSnackbar(r.error.message, { variant: "error" });
      }
    });
  }

  function handleChangeContext(
    id: string,
    ctx: SandboxDashboardContext,
    config: SavedAnalysisSummary["config"],
    name: string,
  ) {
    startTransition(async () => {
      const r = await saveSandboxAnalysisAction(accountId, {
        id,
        name,
        config,
        dashboardContext: ctx,
        isPinned: analyses.find((a) => a.id === id)?.isPinned ?? false,
      });
      if (r.ok) {
        enqueueSnackbar(ms.analysisUpdated, { variant: "success" });
        refresh();
      } else {
        enqueueSnackbar(r.error.message, { variant: "error" });
      }
    });
  }

  return (
    <PageSettingsContainer
      title={m.settings.nav.analyses}
      secondary={
        <Button
          component={AppLink}
          href={`/${accountId}/dashboards/sandbox`}
          variant="outlined"
          size="small"
          startIcon={<OpenInNewIcon />}
        >
          {ms.openSandbox}
        </Button>
      }
    >
      {analyses.length === 0 ? (
        <Box sx={{ py: 6, textAlign: "center" }}>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            {ms.savedList.empty}
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            {ms.savedList.emptyHint}
          </Typography>
          <Button
            component={AppLink}
            href={`/${accountId}/dashboards/sandbox`}
            variant="outlined"
            startIcon={<OpenInNewIcon />}
          >
            {ms.openSandbox}
          </Button>
        </Box>
      ) : (
        <>
          <Stack spacing={1}>
            {analyses.map((a) => {
              const canDelete = a.createdById === currentUserId || role === "owner";
              return (
                <Paper key={a.id} variant="outlined" sx={{ px: 2, py: 1.5 }}>
                  <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                    {/* Pin toggle */}
                    <Tooltip title={a.isPinned ? ms.unpinToggle : ms.pinToggle}>
                      <IconButton
                        size="small"
                        onClick={() => handleTogglePin(a.id, !a.isPinned)}
                        disabled={isPending}
                        sx={{ mt: 0.25 }}
                      >
                        {a.isPinned ? (
                          <PushPinIcon sx={{ fontSize: 16, color: "primary.main" }} />
                        ) : (
                          <PushPinOutlinedIcon sx={{ fontSize: 16 }} />
                        )}
                      </IconButton>
                    </Tooltip>

                    {/* Name + context */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
                        <Typography variant="body2" fontWeight={600}>
                          {a.name}
                        </Typography>
                        <Chip
                          label={`${a.config.groupBy} × ${a.config.seriesBy}`}
                          size="small"
                          sx={{ height: 16, fontSize: "0.65rem" }}
                        />
                        <Chip
                          label={a.config.chartType.replace("_", " ")}
                          size="small"
                          sx={{ height: 16, fontSize: "0.65rem" }}
                        />
                      </Box>

                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                          {ms.context.label}:
                        </Typography>
                        <ToggleButtonGroup
                          size="small"
                          value={a.dashboardContext}
                          exclusive
                          onChange={(_, v) => v && handleChangeContext(a.id, v, a.config, a.name)}
                          sx={{
                            "& .MuiToggleButton-root": { fontSize: "0.7rem", py: 0.25, px: 0.75 },
                          }}
                        >
                          {(["yearly", "monthly", "both"] as SandboxDashboardContext[]).map(
                            (ctx) => (
                              <ToggleButton key={ctx} value={ctx}>
                                {contextLabels[ctx]}
                              </ToggleButton>
                            ),
                          )}
                        </ToggleButtonGroup>
                      </Box>
                    </Box>

                    {/* Actions */}
                    <Box sx={{ display: "flex", gap: 0.25, flexShrink: 0 }}>
                      <Tooltip title={ms.openInSandbox}>
                        <IconButton
                          size="small"
                          component={AppLink}
                          href={`/${accountId}/dashboards/sandbox`}
                        >
                          <OpenInNewIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      {canDelete && (
                        <Tooltip title={ms.deleteAnalysis}>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDelete(a.id)}
                            disabled={isPending}
                          >
                            <DeleteIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </Box>
                </Paper>
              );
            })}
          </Stack>

          <Divider sx={{ mt: 3, mb: 1 }} />
          <Typography variant="caption" color="text.secondary">
            {analyses.filter((a) => a.isPinned).length}/4 análises fixadas
          </Typography>
        </>
      )}
    </PageSettingsContainer>
  );
}
