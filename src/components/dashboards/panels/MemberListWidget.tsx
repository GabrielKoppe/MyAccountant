"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import { formatCentsToBrl } from "@/lib/money";
import { m } from "@/lib/messages";
import { WidgetContainer } from "@/components/ui/WidgetContainer";
import { WIDGET_ICONS } from "@/components/dashboards/_core/widget-icons";
import { memberDisplayName } from "@/components/dashboards/_shared/member-display";
import type { MemberBreakdownRow } from "@/server/queries/member-analytics";

type RenderMode = "compact" | "default" | "full";

type Props = {
  rows: MemberBreakdownRow[];
  renderMode?: RenderMode;
};

// ─────────────────────────────────────────────────────────────────────────────

export function MemberListWidget({ rows, renderMode = "default" }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const spenders = rows.filter((r) => BigInt(r.totalCents) > 0n);

  function toggleExpand(key: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function rowKey(r: MemberBreakdownRow): string {
    return r.userId ?? "unassigned";
  }

  // ── Compact (2×1): cards estilo MonthCardGrid ──────────────────────────
  if (renderMode === "compact") {
    const top = spenders.slice(0, 3);

    return (
      <WidgetContainer
        title={m.dashboards.members.whoSpentMost}
        icon={WIDGET_ICONS["member-list"]}
        contentSx={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {top.length === 0 ? (
          <Typography variant="caption" color="text.secondary" align="center" display="block">
            Sem despesas este mês.
          </Typography>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: `repeat(${top.length}, 1fr)`,
              gap: 1,
            }}
          >
            {top.map((r, i) => (
              <Box
                key={rowKey(r)}
                sx={{
                  p: 1.5,
                  borderRadius: 1,
                  border: "1px solid",
                  borderColor: "divider",
                  display: "flex",
                  flexDirection: "column",
                  gap: 1.5,
                  overflow: "hidden",
                  transition: "border-color 0.15s, background-color 0.15s",
                  "&:hover": { bgcolor: "action.hover", borderColor: "primary.main" },
                }}
              >
                <Box
                  sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    noWrap
                    sx={{
                      fontSize: "0.8rem",
                      fontWeight: 400,
                      lineHeight: 1.2,
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {memberDisplayName(r.name, r.isFormerMember)}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.tertiary"
                    sx={{ fontSize: "0.6rem", lineHeight: 1, ml: 0.5, flexShrink: 0 }}
                  >
                    #{i + 1}
                  </Typography>
                </Box>
                <Box
                  sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <Typography variant="mono" color="text.tertiary" sx={{ fontSize: "0.6rem" }}>
                    {r.sharePercent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                  </Typography>
                  <Typography
                    noWrap
                    sx={{
                      fontFamily: "var(--font-jetbrains-mono), monospace",
                      fontWeight: 600,
                      fontSize: "0.72rem",
                      color: "error.main",
                      lineHeight: 1.2,
                    }}
                  >
                    {formatCentsToBrl(BigInt(r.totalCents))}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </WidgetContainer>
    );
  }

  // ── Full (3×3): lista + categorias colapsáveis por membro ────────────────
  if (renderMode === "full") {
    return (
      <WidgetContainer
        title={m.dashboards.members.whoSpentMost}
        icon={WIDGET_ICONS["member-list"]}
        subtitle={spenders.length > 0 ? `${spenders.length} com despesas` : undefined}
        contentSx={{ overflow: "auto" }}
      >
        {rows.length === 0 ? (
          <Typography variant="caption" color="text.secondary">
            Sem membros.
          </Typography>
        ) : (
          <Stack spacing={0}>
            {rows.map((row) => {
              const key = rowKey(row);
              const hasSpend = BigInt(row.totalCents) > 0n;
              const isExpanded = expandedIds.has(key);
              const hasCategories = row.categories.length > 0;

              return (
                <Box
                  key={key}
                  sx={{
                    py: 1,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    "&:last-child": { borderBottom: "none" },
                  }}
                >
                  {/* Linha principal */}
                  <Stack direction="row" alignItems="center" gap={1}>
                    {/* Dot colorido por posição */}
                    <Box
                      component="span"
                      sx={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        bgcolor: hasSpend ? "accent.primary" : "text.disabled",
                        flexShrink: 0,
                        opacity: hasSpend ? 1 : 0.4,
                      }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" noWrap sx={{ fontSize: "0.78rem" }}>
                        {memberDisplayName(row.name, row.isFormerMember)}
                      </Typography>
                      {/* topCategoryName visível apenas quando recolhido */}
                      {!isExpanded && row.topCategoryName && (
                        <Typography
                          variant="caption"
                          color="text.tertiary"
                          noWrap
                          sx={{ fontSize: "0.65rem" }}
                        >
                          {row.topCategoryName}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                      <Typography
                        variant="caption"
                        sx={{
                          fontFamily: "var(--font-jetbrains-mono), monospace",
                          fontWeight: 500,
                          fontVariantNumeric: "tabular-nums",
                          fontSize: "0.75rem",
                          color: hasSpend ? "text.primary" : "text.disabled",
                          display: "block",
                        }}
                      >
                        {formatCentsToBrl(BigInt(row.totalCents))}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.tertiary"
                        sx={{ fontSize: "0.62rem" }}
                      >
                        {row.sharePercent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do
                        total
                      </Typography>
                    </Box>
                    {hasCategories && (
                      <IconButton
                        size="small"
                        onClick={() => toggleExpand(key)}
                        sx={{ p: 0.25, ml: 0.25, flexShrink: 0 }}
                      >
                        {isExpanded ? (
                          <ExpandLessIcon sx={{ fontSize: 14 }} />
                        ) : (
                          <ExpandMoreIcon sx={{ fontSize: 14 }} />
                        )}
                      </IconButton>
                    )}
                  </Stack>

                  {hasCategories && (
                    <Collapse in={isExpanded} unmountOnExit>
                      <Stack spacing={0.25} sx={{ mt: 0.75, pl: 2 }}>
                        {row.categories.map((cat) => (
                          <Stack
                            key={cat.name + cat.cents}
                            direction="row"
                            alignItems="center"
                            gap={1}
                          >
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              noWrap
                              sx={{ fontSize: "0.67rem", flex: 1, minWidth: 0 }}
                            >
                              {cat.name}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{
                                fontFamily: "var(--font-jetbrains-mono), monospace",
                                fontSize: "0.67rem",
                                color: "text.secondary",
                                fontVariantNumeric: "tabular-nums",
                                flexShrink: 0,
                              }}
                            >
                              {formatCentsToBrl(BigInt(cat.cents))}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.tertiary"
                              sx={{
                                fontSize: "0.62rem",
                                minWidth: 26,
                                textAlign: "right",
                                flexShrink: 0,
                              }}
                            >
                              {cat.sharePercent.toLocaleString("pt-BR", {
                                maximumFractionDigits: 0,
                              })}
                              %
                            </Typography>
                          </Stack>
                        ))}
                      </Stack>
                    </Collapse>
                  )}
                </Box>
              );
            })}
          </Stack>
        )}
      </WidgetContainer>
    );
  }

  // ── Default (2×3): lista de ranking ─────────────────────────────────────
  return (
    <WidgetContainer
      title={m.dashboards.members.whoSpentMost}
      icon={WIDGET_ICONS["member-list"]}
      contentSx={{ overflow: "auto" }}
    >
      {rows.length === 0 ? (
        <Typography variant="caption" color="text.secondary">
          Sem membros.
        </Typography>
      ) : (
        <Stack spacing={1.25}>
          {rows.map((row) => {
            const key = rowKey(row);
            const hasSpend = BigInt(row.totalCents) > 0n;
            return (
              <Box key={key} sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                <Box
                  component="span"
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    bgcolor: hasSpend ? "accent.primary" : "text.disabled",
                    flexShrink: 0,
                    opacity: hasSpend ? 1 : 0.4,
                  }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" noWrap sx={{ fontSize: "0.8rem" }}>
                    {memberDisplayName(row.name, row.isFormerMember)}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: "text.tertiary", fontSize: "0.65rem" }}
                    noWrap
                  >
                    {row.topCategoryName ?? m.dashboards.members.emptyTopCategory}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                  <Typography
                    component="div"
                    variant="caption"
                    sx={{
                      fontFamily: "var(--font-jetbrains-mono), 'JetBrains Mono', monospace",
                      fontWeight: 500,
                      fontVariantNumeric: "tabular-nums",
                      color: hasSpend ? "text.primary" : "text.disabled",
                    }}
                  >
                    {formatCentsToBrl(BigInt(row.totalCents))}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: "text.tertiary", fontSize: "0.65rem" }}
                  >
                    {row.sharePercent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do
                    total
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Stack>
      )}
    </WidgetContainer>
  );
}
