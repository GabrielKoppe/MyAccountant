"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import AddToPhotosIcon from "@mui/icons-material/AddToPhotos";
import { useSnackbar } from "notistack";

import { m } from "@/lib/messages";
import type { SandboxConfig } from "@/lib/schemas/sandbox";
import type { SandboxResult } from "@/lib/queries/sandbox";
import type { SectionMeta } from "@/lib/queries/dashboards";
import { getSandboxDataClientAction } from "@/actions/sandbox";
import { addAnalysisToDashboardAction } from "@/actions/dashboard-layout";
import { DialogShell } from "@/components/ui/DialogShell";
import { SandboxControls } from "./SandboxControls";
import { SandboxChart } from "./SandboxChart";
import { SandboxDataTable } from "./SandboxDataTable";

// AppBar with variant="dense" is 48px
const APP_BAR_HEIGHT = 48;

type CategoryMeta = { id: string; name: string };
type MemberMeta = { userId: string; name: string };

type Props = {
  accountId: string;
  allYears: number[];
  allMonths: Array<{ id: string; label: string; year: number; month: number }>;
  sections: SectionMeta[];
  categories: CategoryMeta[];
  members: MemberMeta[];
  initialConfig: SandboxConfig;
};

export function SandboxPage({
  accountId,
  allYears,
  allMonths,
  sections,
  categories,
  members,
  initialConfig,
}: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const ms = m.dashboards.sandbox;
  const { enqueueSnackbar } = useSnackbar();

  const [config, setConfig] = useState<SandboxConfig>(initialConfig);
  const [result, setResult] = useState<SandboxResult | null>(null);
  const [isPending, startTransition] = useTransition();

  // Estado do modal "Adicionar ao dashboard"
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addContext, setAddContext] = useState<"monthly" | "yearly">("monthly");
  const [isAdding, startAddTransition] = useTransition();

  const runQuery = useCallback(
    (cfg: SandboxConfig) => {
      startTransition(async () => {
        const res = await getSandboxDataClientAction(accountId, cfg);
        if (res.ok) {
          setResult({
            series: res.data.series,
            rows: res.data.rows,
            grandTotalCents: BigInt(res.data.grandTotalCents),
          });
        }
      });
    },
    [accountId],
  );

  useEffect(() => {
    runQuery(initialConfig);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleConfigChange(newConfig: SandboxConfig) {
    setConfig(newConfig);
    runQuery(newConfig);
  }

  function handleAddToDashboard() {
    startAddTransition(async () => {
      const res = await addAnalysisToDashboardAction(accountId, {
        context: addContext,
        config,
      });
      if (res.ok) {
        enqueueSnackbar(ms.addToDashboardSuccess, { variant: "success" });
        setAddDialogOpen(false);
      } else {
        enqueueSnackbar(res.error.message || ms.addToDashboardError, { variant: "error" });
      }
    });
  }

  return (
    <Box
      sx={{
        height: `calc(100vh - ${APP_BAR_HEIGHT}px)`,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        bgcolor: "background.default",
      }}
    >
      {/* Modal: Adicionar ao dashboard */}
      <DialogShell
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        title={ms.addToDashboardTitle}
        description={ms.addToDashboardDescription}
        loading={isAdding}
        maxWidth="xs"
        actions={
          <>
            <Button onClick={() => setAddDialogOpen(false)} disabled={isAdding}>
              Cancelar
            </Button>
            <Button variant="contained" onClick={handleAddToDashboard} disabled={isAdding}>
              {ms.addToDashboardConfirm}
            </Button>
          </>
        }
      >
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" sx={{ display: "block", mb: 0.5, color: "text.secondary" }}>
            {ms.addToDashboardContextLabel}
          </Typography>
          <Select
            value={addContext}
            onChange={(e) => setAddContext(e.target.value as "monthly" | "yearly")}
            size="small"
            fullWidth
          >
            <MenuItem value="monthly">{ms.addToDashboardContextMonthly}</MenuItem>
            <MenuItem value="yearly">{ms.addToDashboardContextYearly}</MenuItem>
          </Select>
        </Box>
      </DialogShell>

      {/* Sticky title bar */}
      <Box
        sx={{
          px: 3,
          py: 1.5,
          borderBottom: 1,
          borderColor: "divider",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1.5,
          bgcolor: "background.paper",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Typography variant="h6">{ms.title}</Typography>
          {isPending && <CircularProgress size={14} thickness={5} />}
        </Box>
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddToPhotosIcon fontSize="small" />}
          onClick={() => setAddDialogOpen(true)}
        >
          {ms.addToDashboard}
        </Button>
      </Box>

      {/* Main content */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          overflow: "hidden",
        }}
      >
        {/* Controls sidebar */}
        <Box
          component="aside"
          sx={{
            width: isMobile ? "100%" : 248,
            flexShrink: 0,
            borderRight: isMobile ? 0 : 1,
            borderBottom: isMobile ? 1 : 0,
            borderColor: "divider",
            overflowY: "auto",
            p: 2,
            display: "flex",
            flexDirection: "column",
            bgcolor: "background.paper",
          }}
        >
          <SandboxControls
            config={config}
            onChange={handleConfigChange}
            allYears={allYears}
            allMonths={allMonths}
            sections={sections}
            categories={categories}
            members={members}
          />
        </Box>

        {/* Chart area */}
        <Box sx={{ flex: 1, overflowY: "auto", p: 2.5, minWidth: 0 }}>
          {result ? (
            <>
              <SandboxChart result={result} config={config} height={360} showLegend />
              <SandboxDataTable result={result} config={config} />
            </>
          ) : !isPending ? (
            <Box
              sx={{
                height: 300,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 1,
                color: "text.secondary",
              }}
            >
              <Typography variant="body2">{ms.noData}</Typography>
              <Typography variant="caption">
                Configure as opções ao lado e os dados aparecerão aqui.
              </Typography>
            </Box>
          ) : null}
        </Box>
      </Box>
    </Box>
  );
}
