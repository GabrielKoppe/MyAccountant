"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import { AppLink } from "@/components/ui/AppLink";
import { WidgetContainer } from "@/components/ui/WidgetContainer";
import { WIDGET_ICONS } from "@/components/dashboards/_core/widget-icons";
import { formatCentsToBrl } from "@/lib/money";
import { m } from "@/lib/messages";

type SectionCountType = "add" | "subtract" | "ignore" | "neutral";

type SectionItem = {
  id: string;
  name: string;
  countType: SectionCountType;
  isActive: boolean;
};

type FinanceTableItem = {
  id: string;
  name: string;
  sectionId: string;
  countInMonth: boolean;
  transactionCount: number;
};

type Props = {
  sections: SectionItem[];
  sectionTotals: Record<string, string>;
  prevSectionTotals?: Record<string, string>;
  accountId: string;
  monthId: string;
  tables: FinanceTableItem[];
  renderMode?: "default" | "small" | "compact";
};

const COUNT_TYPE_CHIP_COLORS: Record<
  SectionCountType,
  "success" | "error" | "default" | "warning"
> = {
  add: "success",
  subtract: "error",
  ignore: "default",
  neutral: "warning",
};

// Cores para o modo compact (lista vertical).
const COUNT_TYPE_BORDER: Record<SectionCountType, string> = {
  add: "success.main",
  subtract: "danger.main",
  neutral: "warning.main",
  ignore: "border.subtle",
};

const COUNT_TYPE_VALUE: Record<SectionCountType, string> = {
  add: "success.main",
  subtract: "danger.main",
  neutral: "warning.main",
  ignore: "text.disabled",
};

// Quantos cards visíveis de uma vez por renderMode.
const CARDS_VISIBLE = { default: 5, small: 3 } as const;

// ─── Card individual do carrossel ─────────────────────────────────────────────

type CarouselCardProps = {
  section: SectionItem;
  sectionTotals: Record<string, string>;
  prevSectionTotals?: Record<string, string>;
  accountId: string;
  monthId: string;
};

function CarouselCard({
  section,
  sectionTotals,
  prevSectionTotals,
  accountId,
  monthId,
}: CarouselCardProps) {
  const cur = BigInt(sectionTotals[section.id] ?? "0");
  const prev = prevSectionTotals ? BigInt(prevSectionTotals[section.id] ?? "0") : null;
  const delta =
    prev !== null && prev !== 0n
      ? ((Number(cur) - Number(prev)) / Math.abs(Number(prev))) * 100
      : null;

  return (
    <Box
      component={AppLink}
      href={`/${accountId}/months/${monthId}?tab=${section.id}`}
      sx={{
        textDecoration: "none",
        color: "inherit",
        px: 2,
        py: 1,
        borderRadius: 1,
        border: 1,
        borderColor: "border.subtle",
        display: "block",
        overflow: "hidden",
        transition: "border-color 120ms",
        "&:hover": { borderColor: "border.default" },
        minHeight: "68px",
      }}
    >
      <Stack spacing={0.25} sx={{ minWidth: 0 }}>
        <Stack direction="column" gap={0}>
          <Stack direction="row" alignItems="center" gap={0.5} sx={{ minWidth: 0 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              noWrap
              sx={{ fontSize: "0.7rem", flex: 1, minWidth: 0 }}
            >
              {section.name}
            </Typography>
            <Chip
              size="small"
              label={m.settings.sections.countTypes[section.countType]}
              color={COUNT_TYPE_CHIP_COLORS[section.countType]}
              sx={{
                height: 14,
                fontSize: "0.6rem",
                "& .MuiChip-label": { px: 0.75 },
                flexShrink: 0,
              }}
            />
          </Stack>
          <Typography
            variant="body2"
            fontWeight={500}
            noWrap
            sx={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.8rem" }}
          >
            {formatCentsToBrl(cur)}
          </Typography>
        </Stack>
        {delta !== null && (
          <Typography
            variant="caption"
            noWrap
            sx={{
              fontSize: "0.65rem",
              color: delta === 0 ? "text.disabled" : delta > 0 ? "success.main" : "danger.main",
            }}
          >
            {delta > 0 ? "+" : ""}
            {delta.toFixed(1)}%
          </Typography>
        )}
      </Stack>
    </Box>
  );
}

export function SectionCards({
  sections,
  sectionTotals,
  prevSectionTotals,
  accountId,
  monthId,
  tables,
  renderMode = "default",
}: Props) {
  const visible = sections.filter((s) => s.countType !== "ignore");
  const cardsVisible = renderMode === "small" ? CARDS_VISIBLE.small : CARDS_VISIBLE.default;

  const [startIdx, setStartIdx] = useState(0);
  // Reseta ao trocar de renderMode.
  useEffect(() => {
    setStartIdx(0);
  }, [cardsVisible]);

  const noActivity = visible.filter((s) => {
    const ts = tables.filter((t) => t.sectionId === s.id);
    return ts.length === 0 || ts.every((t) => t.transactionCount === 0);
  });

  // Carrossel circular infinito: avança/recua 1 card por vez, wrap nos extremos.
  const canScroll = visible.length > cardsVisible;
  const handlePrev = () => setStartIdx((i) => (i - 1 + visible.length) % visible.length);
  const handleNext = () => setStartIdx((i) => (i + 1) % visible.length);
  const shownCards = canScroll
    ? Array.from({ length: cardsVisible }, (_, i) => visible[(startIdx + i) % visible.length])
    : visible;

  const noticeText =
    noActivity.length === 1
      ? "1 seção sem transações este mês"
      : `${noActivity.length} seções sem transações este mês`;

  // Ícone de informativo no slot tertiary do WidgetContainer — ao lado do título, zero altura extra.
  const infoTertiary =
    noActivity.length > 0 ? (
      <Tooltip title={noticeText} placement="top">
        <InfoOutlinedIcon sx={{ fontSize: 12, color: "text.disabled", cursor: "default" }} />
      </Tooltip>
    ) : null;

  const title = m.dashboards.widgets.month_summary["section-cards"];
  const Icon = WIDGET_ICONS["section-cards"];

  // ── compact (1×2): lista vertical de links coloridos por tipo de seção ──
  if (renderMode === "compact") {
    return (
      <WidgetContainer
        title={title}
        icon={Icon}
        tertiary={infoTertiary}
        contentSx={{ overflow: "hidden" }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          {visible.length === 0 ? (
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.7rem" }}>
              Sem seções ativas
            </Typography>
          ) : (
            visible.map((s) => {
              const total = BigInt(sectionTotals[s.id] ?? "0");
              return (
                <Box
                  key={s.id}
                  component={AppLink}
                  href={`/${accountId}/months/${monthId}?tab=${s.id}`}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 0.5,
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    border: 1,
                    borderColor: COUNT_TYPE_BORDER[s.countType],
                    textDecoration: "none",
                    minWidth: 0,
                    overflow: "hidden",
                    transition: "opacity 120ms",
                    "&:hover": { opacity: 0.75 },
                  }}
                >
                  <Typography
                    noWrap
                    sx={{ fontSize: "0.7rem", color: "text.primary", flex: 1, minWidth: 0 }}
                  >
                    {s.name}
                  </Typography>
                  <Typography
                    component="span"
                    noWrap
                    sx={{
                      fontSize: "0.7rem",
                      fontFamily: "var(--font-jetbrains-mono), monospace",
                      color: COUNT_TYPE_VALUE[s.countType],
                      flexShrink: 0,
                      ml: 0.5,
                    }}
                  >
                    {formatCentsToBrl(total)}
                  </Typography>
                </Box>
              );
            })
          )}
        </Box>
      </WidgetContainer>
    );
  }

  // ── default / small: carrossel circular com cards de tamanho fixo (CSS Grid) ──
  return (
    <WidgetContainer
      title={title}
      icon={Icon}
      tertiary={infoTertiary}
      contentSx={{ overflow: "hidden" }}
    >
      <Box sx={{ display: "flex", alignItems: "stretch", gap: 0.5, overflow: "hidden" }}>
        {canScroll && (
          <IconButton
            size="small"
            onClick={handlePrev}
            sx={{ flexShrink: 0, alignSelf: "center" }}
            aria-label="Seções anteriores"
          >
            <ChevronLeftIcon sx={{ fontSize: 18 }} />
          </IconButton>
        )}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: `repeat(${shownCards.length}, 1fr)`,
            gap: 1,
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          {shownCards.map((s) => (
            <CarouselCard
              key={s.id}
              section={s}
              sectionTotals={sectionTotals}
              prevSectionTotals={prevSectionTotals}
              accountId={accountId}
              monthId={monthId}
            />
          ))}
        </Box>
        {canScroll && (
          <IconButton
            size="small"
            onClick={handleNext}
            sx={{ flexShrink: 0, alignSelf: "center" }}
            aria-label="Próximas seções"
          >
            <ChevronRightIcon sx={{ fontSize: 18 }} />
          </IconButton>
        )}
      </Box>
    </WidgetContainer>
  );
}
