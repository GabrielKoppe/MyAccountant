"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

import { AppLink } from "@/components/ui/AppLink";
import { WidgetContainer } from "@/components/ui/WidgetContainer";
import { WIDGET_ICONS } from "@/components/dashboards/_core/widget-icons";
import { formatCentsToBrl } from "@/lib/money";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { m } from "@/lib/messages";
import type { MonthSummary } from "@/lib/queries/dashboards";

type Props = {
  accountId: string;
  months: MonthSummary[];
  currentMonthId?: string;
  renderMode?: string;
};

// Quantos cards visíveis por renderMode
const CARDS_VISIBLE: Record<string, number> = {
  default: 6,
  small: 4,
  compact: 2,
};

export function MonthCardGrid({
  accountId,
  months,
  currentMonthId,
  renderMode = "default",
}: Props) {
  const [startIdx, setStartIdx] = useState(0);

  if (months.length === 0) return null;

  const visibleCount = CARDS_VISIBLE[renderMode] ?? 6;
  const canScroll = months.length > visibleCount;

  const maxStart = Math.max(0, months.length - visibleCount);
  const handlePrev = () => setStartIdx((i) => Math.max(0, i - 1));
  const handleNext = () => setStartIdx((i) => Math.min(maxStart, i + 1));

  const shown = months.slice(startIdx, startIdx + visibleCount);

  return (
    <WidgetContainer
      title={m.dashboards.widgets.yearly["month-card-grid"]}
      icon={WIDGET_ICONS["month-card-grid"]}
      contentSx={{
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "stretch", gap: 0.5 }}>
        {canScroll && (
          <IconButton
            size="small"
            onClick={handlePrev}
            disabled={startIdx === 0}
            sx={{ flexShrink: 0, alignSelf: "center" }}
          >
            <ChevronLeftIcon sx={{ fontSize: 18 }} />
          </IconButton>
        )}

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: `repeat(${shown.length}, 1fr)`,
            gap: 2,
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          {shown.map((mo) => {
            const total = BigInt(mo.total);
            return (
              <Box
                key={mo.id}
                component={AppLink}
                href={`/${accountId}/dashboards/monthly/${mo.id}`}
                sx={{
                  textDecoration: "none",
                  color: "inherit",
                  p: 2,
                  borderRadius: 1,
                  border: "1px solid",
                  borderColor: "divider",
                  display: "flex",
                  flexDirection: "column",
                  gap: 0.25,
                  overflow: "hidden",
                  transition: "border-color 0.15s, background-color 0.15s",
                  "&:hover": { bgcolor: "action.hover", borderColor: "primary.main" },
                  "&:hover .month-card-arrow": { transform: "translateX(3px)" },
                  minHeight: 64,
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Typography
                    variant="kpi"
                    color="text.secondary"
                    noWrap
                    sx={{ fontSize: "0.85rem", fontWeight: 400, lineHeight: 1.2 }}
                  >
                    {mo.label}
                  </Typography>
                  <ArrowForwardIcon
                    className="month-card-arrow"
                    sx={{
                      fontSize: 16,
                      color: "text.secondary",
                      transition: "transform 0.15s",
                    }}
                  />
                </Box>
                <Typography
                  noWrap
                  sx={{
                    fontFamily: "var(--font-jetbrains-mono), monospace",
                    fontWeight: 600,
                    fontSize: "0.75rem",
                    color: total >= 0n ? "success.main" : "danger.main",
                    lineHeight: 1.2,
                  }}
                >
                  {formatCentsToBrl(total)}
                </Typography>
              </Box>
            );
          })}
        </Box>

        {canScroll && (
          <IconButton
            size="small"
            onClick={handleNext}
            disabled={startIdx >= maxStart}
            sx={{ flexShrink: 0, alignSelf: "center" }}
          >
            <ChevronRightIcon sx={{ fontSize: 18 }} />
          </IconButton>
        )}
      </Box>
    </WidgetContainer>
  );
}
