"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

import { m } from "@/lib/messages";
import type { SandboxConfig } from "@/lib/schemas/sandbox";
import type { SandboxResult, SavedAnalysisSummary } from "@/lib/queries/sandbox";
import type { SectionMeta } from "@/lib/queries/dashboards";
import { getSandboxDataClientAction, listSavedAnalysesAction } from "@/actions/sandbox";
import { SandboxControls } from "./SandboxControls";
import { SandboxChart } from "./SandboxChart";
import { SandboxDataTable } from "./SandboxDataTable";
import { SavedAnalysisList } from "./SavedAnalysisList";

// AppBar with variant="dense" is 48px
const APP_BAR_HEIGHT = 48;

type CategoryMeta = { id: string; name: string };
type MemberMeta = { userId: string; name: string };

type Props = {
  accountId: string;
  currentUserId: string;
  role: string;
  allYears: number[];
  allMonths: Array<{ id: string; label: string; year: number; month: number }>;
  sections: SectionMeta[];
  categories: CategoryMeta[];
  members: MemberMeta[];
  savedAnalyses: SavedAnalysisSummary[];
  initialConfig: SandboxConfig;
};

export function SandboxPage({
  accountId,
  currentUserId,
  role,
  allYears,
  allMonths,
  sections,
  categories,
  members,
  savedAnalyses: initialAnalyses,
  initialConfig,
}: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const ms = m.dashboards.sandbox;

  const [config, setConfig] = useState<SandboxConfig>(initialConfig);
  const [result, setResult] = useState<SandboxResult | null>(null);
  const [analyses, setAnalyses] = useState<SavedAnalysisSummary[]>(initialAnalyses);
  const [isPending, startTransition] = useTransition();

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

  function handleLoad(cfg: SandboxConfig) {
    setConfig(cfg);
    runQuery(cfg);
  }

  async function handleRefreshAnalyses() {
    const result = await listSavedAnalysesAction(accountId, {});
    if (result.ok) {
      setAnalyses(result.data);
    }
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
          gap: 1.5,
          bgcolor: "background.paper",
        }}
      >
        <Typography variant="h6">{ms.title}</Typography>
        {isPending && <CircularProgress size={14} thickness={5} />}
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

          <Divider sx={{ my: 2 }} />

          <SavedAnalysisList
            accountId={accountId}
            analyses={analyses}
            currentConfig={config}
            currentUserId={currentUserId}
            role={role}
            onLoad={handleLoad}
            onRefresh={handleRefreshAnalyses}
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
