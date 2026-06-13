"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

import { AppLink } from "@/components/ui/AppLink";
import { m } from "@/lib/messages";
import type { PinnedAnalysisData } from "@/lib/queries/sandbox";
import type { SandboxChartType } from "@/lib/schemas/sandbox";
import { SandboxChart } from "./sandbox/SandboxChart";

type Props = {
  accountId: string;
  pinnedAnalyses: PinnedAnalysisData[];
};

const chartTypeLabel: Record<SandboxChartType, string> = {
  bar_grouped: "Barras",
  bar_stacked: "Barras",
  line: "Linhas",
  area: "Área",
  pie: "Pizza",
  donut: "Rosca",
};

export function PinnedAnalysesSection({ accountId, pinnedAnalyses }: Props) {
  const ms = m.dashboards.sandbox;

  if (pinnedAnalyses.length === 0) {
    return (
      <Box sx={{ py: 3, textAlign: "center" }}>
        <Typography variant="body2" color="text.secondary">
          {ms.noPinned}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
          {ms.noPinnedHint}
        </Typography>
      </Box>
    );
  }
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
        gap: 2,
      }}
    >
      {pinnedAnalyses.map((a) => (
        <PinnedAnalysisCard key={a.id} analysis={a} accountId={accountId} />
      ))}
    </Box>
  );
}

function PinnedAnalysisCard({
  analysis,
  accountId,
}: {
  analysis: PinnedAnalysisData;
  accountId: string;
}) {
  const ms = m.dashboards.sandbox;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        display: "flex",
        flexDirection: "column",
        gap: 1,
        "&:hover": { borderColor: "primary.main" },
        transition: "border-color 0.15s",
      }}
    >
      {/* Title row */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="subtitle2" fontWeight={600} sx={{ fontSize: "0.8125rem" }}>
          {analysis.name}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Chip
            label={chartTypeLabel[analysis.config.chartType]}
            size="small"
            sx={{ height: 16, fontSize: "0.65rem" }}
          />
          <Button
            component={AppLink}
            href={`/${accountId}/dashboards/sandbox?analysisId=${analysis.id}`}
            size="small"
            endIcon={<OpenInNewIcon />}
            sx={{
              fontSize: "0.7rem",
              minWidth: 0,
              px: 0.75,
              py: 0.25,
              "& .MuiButton-endIcon": { fontSize: "0.75rem" },
            }}
          >
            {ms.openInSandbox}
          </Button>
        </Box>
      </Box>

      {/* Mini chart */}
      <SandboxChart
        result={analysis.result}
        config={analysis.config}
        height={200}
        showLegend={analysis.result.series.length <= 4}
      />
    </Paper>
  );
}
