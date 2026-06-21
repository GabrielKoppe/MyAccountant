"use client";

import type { ComponentType } from "react";
import { useState } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import type { SvgIconProps } from "@mui/material/SvgIcon";
import TipsAndUpdatesIcon from "@mui/icons-material/TipsAndUpdates";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import NewReleasesIcon from "@mui/icons-material/NewReleases";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

import { AppLink } from "@/components/ui/AppLink";
import { WidgetContainer } from "@/components/ui/WidgetContainer";
import { WIDGET_ICONS } from "@/components/dashboards/_core/widget-icons";
import { m } from "@/lib/messages";
import type { Insight, InsightSeverity } from "@/server/services/insights-service";

const INSIGHT_ICON_MAP: Record<string, ComponentType<SvgIconProps>> = {
  TrendingUp: TrendingUpIcon,
  FiberNew: NewReleasesIcon,
  Warning: WarningAmberIcon,
  EmojiEvents: EmojiEventsIcon,
};

// Severidade → cor do ícone e da stripe lateral.
const SEVERITY_COLOR: Record<InsightSeverity, string> = {
  warning: "warning.main",
  success: "success.main",
  info: "text.disabled",
};

type RenderMode = "compact" | "default" | "full";

type Props = {
  insights: Insight[];
  renderMode?: RenderMode;
};

// ─── Card de um insight ───────────────────────────────────────────────────────
// variant compact  → título noWrap + body 1 linha
// variant default  → título + body 2 linhas + ação
// variant full     → título + body completo + ação
function InsightItem({
  insight,
  variant,
}: {
  insight: Insight;
  variant: "compact" | "default" | "full";
}) {
  const Icon = INSIGHT_ICON_MAP[insight.icon] ?? TipsAndUpdatesIcon;
  const isCompact = variant === "compact";
  const isFull = variant === "full";
  const bodyClamp = isCompact ? 1 : isFull ? 3 : 2;
  // Altura fixa por variante — impede que cards com/sem link mudem o layout do grid.
  const fixedHeight = isCompact ? 42 : isFull ? 88 : 64;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: 1.25,
        pl: 1.25,
        pr: isCompact ? 0.75 : 1.25,
        py: isCompact ? 0.625 : 0.875,
        borderLeft: "3px solid",
        borderLeftColor: SEVERITY_COLOR[insight.severity],
        borderRadius: "0 6px 6px 0",
        transition: "background-color 140ms",
        "&:hover": { bgcolor: "action.hover" },
        overflow: "hidden",
        height: fixedHeight,
        minHeight: fixedHeight,
        maxHeight: fixedHeight,
        boxSizing: "border-box",
      }}
    >
      <Icon
        sx={{
          fontSize: !isFull ? 15 : 18,
          color: SEVERITY_COLOR[insight.severity],
          flexShrink: 0,
          mt: "2px",
        }}
      />
      <Box sx={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column" }}>
        <Typography
          variant="caption"
          noWrap={isCompact}
          sx={{
            fontWeight: 600,
            color: "text.primary",
            fontSize: !isFull ? "0.72rem" : "0.78rem",
            lineHeight: 1.35,
            display: "block",
          }}
        >
          {insight.title}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: "text.secondary",
            fontSize: !isFull ? "0.67rem" : "0.72rem",
            lineHeight: 1.4,
            mt: 0.2,
            flex: 1,
            display: bodyClamp ? "-webkit-box" : "block",
            ...(bodyClamp && {
              WebkitLineClamp: bodyClamp,
              WebkitBoxOrient: "vertical" as const,
              overflow: "hidden",
            }),
          }}
        >
          {insight.body}
        </Typography>
        {isFull && (
          <Box sx={{ minHeight: "1.2rem", mt: 0.5 }}>
            {insight.action && (
              <Link
                component={AppLink}
                href={insight.action.href}
                underline="hover"
                sx={{
                  display: "inline-block",
                  fontSize: !isFull ? "0.65rem" : "0.7rem",
                  fontWeight: 500,
                  color: "accent.primary",
                }}
              >
                {insight.action.label}
              </Link>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function InsightsCard({ insights, renderMode = "default" }: Props) {
  const [page, setPage] = useState(0);

  if (insights.length === 0) return null;

  const total = insights.length;
  const pageSize = renderMode === "full" ? 4 : renderMode === "default" ? 2 : 1;
  const maxPage = Math.max(0, total - pageSize);
  const canScroll = total > pageSize;

  const handlePrev = () => setPage((p) => Math.max(0, p - 1));
  const handleNext = () => setPage((p) => Math.min(maxPage, p + 1));

  const subtitle = canScroll
    ? `${page + 1}–${Math.min(page + pageSize, total)}/${total}`
    : total > 1
      ? `${total}`
      : undefined;

  // ── Full (3×2): grid 2×2 com carrossel de 4 em 4 ────────────────────────
  if (renderMode === "full") {
    const shownFull = insights.slice(page, page + pageSize);
    return (
      <WidgetContainer
        title={m.dashboards.insights.cardTitle}
        icon={WIDGET_ICONS["insights"]}
        subtitle={subtitle}
        contentSx={{
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
          {canScroll && (
            <IconButton
              size="small"
              onClick={handlePrev}
              disabled={page === 0}
              sx={{ flexShrink: 0, p: 0.25 }}
            >
              <ChevronLeftIcon sx={{ fontSize: 15 }} />
            </IconButton>
          )}
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 2,
            }}
          >
            {shownFull.map((ins) => (
              <InsightItem key={ins.id} insight={ins} variant="full" />
            ))}
          </Box>
          {canScroll && (
            <IconButton
              size="small"
              onClick={handleNext}
              disabled={page >= maxPage}
              sx={{ flexShrink: 0, p: 0.25 }}
            >
              <ChevronRightIcon sx={{ fontSize: 15 }} />
            </IconButton>
          )}
        </Box>
      </WidgetContainer>
    );
  }

  // ── Compact (2×1): carrossel de 1 insight ────────────────────────────────
  if (renderMode === "compact") {
    const insight = insights[page];
    return (
      <WidgetContainer
        title={m.dashboards.insights.cardTitle}
        icon={WIDGET_ICONS["insights"]}
        subtitle={subtitle}
        contentSx={{
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
          {canScroll && (
            <IconButton
              size="small"
              onClick={handlePrev}
              disabled={page === 0}
              sx={{ flexShrink: 0, p: 0.25 }}
            >
              <ChevronLeftIcon sx={{ fontSize: 15 }} />
            </IconButton>
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <InsightItem insight={insight} variant="compact" />
          </Box>
          {canScroll && (
            <IconButton
              size="small"
              onClick={handleNext}
              disabled={page >= maxPage}
              sx={{ flexShrink: 0, p: 0.25 }}
            >
              <ChevronRightIcon sx={{ fontSize: 15 }} />
            </IconButton>
          )}
        </Box>
      </WidgetContainer>
    );
  }

  // ── Default (3×1): grid 2 colunas + carrossel de 2 em 2 ─────────────────
  const shownDefault = insights.slice(page, page + pageSize);
  return (
    <WidgetContainer
      title={m.dashboards.insights.cardTitle}
      icon={WIDGET_ICONS["insights"]}
      subtitle={subtitle}
      contentSx={{
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
        {canScroll && (
          <IconButton
            size="small"
            onClick={handlePrev}
            disabled={page === 0}
            sx={{ flexShrink: 0, p: 0.25 }}
          >
            <ChevronLeftIcon sx={{ fontSize: 15 }} />
          </IconButton>
        )}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 0.75,
          }}
        >
          {shownDefault.map((ins) => (
            <InsightItem key={ins.id} insight={ins} variant="default" />
          ))}
        </Box>
        {canScroll && (
          <IconButton
            size="small"
            onClick={handleNext}
            disabled={page >= maxPage}
            sx={{ flexShrink: 0, p: 0.25 }}
          >
            <ChevronRightIcon sx={{ fontSize: 15 }} />
          </IconButton>
        )}
      </Box>
    </WidgetContainer>
  );
}
