import type { ComponentType } from "react";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { SvgIconProps } from "@mui/material/SvgIcon";
import TipsAndUpdatesIcon from "@mui/icons-material/TipsAndUpdates";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import NewReleasesIcon from "@mui/icons-material/NewReleases";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";

import { AppLink } from "@/components/ui/AppLink";
import { m } from "@/lib/messages";
import type { Insight, InsightSeverity } from "@/server/services/insights-service";
import { layout, typography } from "@/lib/design-tokens";

// Resolve a chave de ícone (string) do service para o componente MUI.
const INSIGHT_ICON_MAP: Record<string, ComponentType<SvgIconProps>> = {
  TrendingUp: TrendingUpIcon,
  FiberNew: NewReleasesIcon,
  Warning: WarningAmberIcon,
  EmojiEvents: EmojiEventsIcon,
};

// Severidade → cor semântica do ícone. Cor é informação, não decoração:
// a sinalização vive só no pequeno ícone; o resto do card é tipografia neutra.
// info é discreto (sem cor), warning/success usam os tokens semânticos.
const SEVERITY_ICON_COLOR: Record<InsightSeverity, string> = {
  warning: "warning.main",
  success: "success.main",
  info: "text.secondary",
};

type Props = {
  insights: Insight[];
};

export function InsightsCard({ insights }: Props) {
  // Guard "lista vazia → não renderiza" (spec 34 §2.2 / INS-05).
  if (insights.length === 0) return null;

  /* Grid com auto-fill: colunas de tamanho fixo, sem stretch na última linha */
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: 1.5,
      }}
    >
      {insights.map((insight) => {
        const Icon = INSIGHT_ICON_MAP[insight.icon] ?? TipsAndUpdatesIcon;
        return (
          <Paper
            key={insight.id}
            variant="outlined"
            sx={{
              minWidth: 0,
              px: layout.page,
              py: layout.inline,
              borderColor: "border.subtle",
              borderRadius: "12px",
              display: "flex",
              gap: 3,
              alignItems: "flex-start",
            }}
          >
            <Icon
              sx={{
                fontSize: 20,
                color: SEVERITY_ICON_COLOR[insight.severity],
                mt: layout.micro,
                flexShrink: 0,
              }}
            />
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 500,
                  color: "text.primary",
                  lineHeight: 1.35,
                  fontSize: typography.fontSize.xs,
                }}
              >
                {insight.title}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  color: "text.secondary",
                  lineHeight: 1.45,
                  mt: 0.25,
                  fontSize: typography.fontSize.xs,
                }}
              >
                {insight.body}
              </Typography>
              {insight.action && (
                <Link
                  component={AppLink}
                  href={insight.action.href}
                  underline="hover"
                  sx={{
                    display: "inline-block",
                    fontSize: typography.fontSize.xs,
                    fontWeight: 500,
                    color: "accent.primary",
                  }}
                >
                  {insight.action.label}
                </Link>
              )}
            </Box>
          </Paper>
        );
      })}
    </Box>
  );
}
