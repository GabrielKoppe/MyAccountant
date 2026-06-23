"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useTheme } from "@mui/material/styles";

import { formatCentsToBrl } from "@/lib/money";
import { m } from "@/lib/messages";
import { getChartColors } from "@/lib/design-tokens";
import { BarList } from "@/components/dashboards/charts/BarList";
import { WidgetContainer } from "@/components/ui/WidgetContainer";
import { WIDGET_ICONS } from "@/components/dashboards/_core/widget-icons";
import type { CategorySum } from "@/server/queries/dashboards";
import type { TopCategoriesConfig } from "@/lib/schemas/widget-config";

type Props = {
  categories: CategorySum[];
  config?: TopCategoriesConfig;
  renderMode?: string;
};

export function TopCategoriesWidget({ categories, config, renderMode = "default" }: Props) {
  const theme = useTheme();
  const palette = getChartColors(theme.palette.mode as "light" | "dark");
  const [detailOpen, setDetailOpen] = useState(false);

  const limit = config?.limit ?? 10;
  const shown = categories.slice(0, limit);

  const total = shown.reduce((sum, c) => {
    const v = BigInt(c.totalCents);
    return sum + (v < 0n ? -v : v);
  }, 0n);

  const maxAbs = shown.reduce((mx, c) => {
    const v = BigInt(c.totalCents) < 0n ? -BigInt(c.totalCents) : BigInt(c.totalCents);
    return v > mx ? v : mx;
  }, 0n);

  // ── Compact (2×2): lista com dot colorido + barra de fundo proporcional ─
  if (renderMode === "compact") {
    // Scroll apenas quando limit=20; com ≤10 itens a lista cabe sem scroll
    const compactOverflow = limit > 10 ? "auto" : "hidden";
    return (
      <WidgetContainer
        title={m.dashboards.sections.topCategories}
        icon={WIDGET_ICONS["top-categories"]}
        contentSx={{ overflow: compactOverflow }}
      >
        {shown.length === 0 ? (
          <Typography variant="caption" color="text.secondary">
            Sem categorias registradas.
          </Typography>
        ) : (
          <Stack gap={0.5}>
            {shown.map((cat, i) => {
              const abs =
                BigInt(cat.totalCents) < 0n ? -BigInt(cat.totalCents) : BigInt(cat.totalCents);
              const barPct = maxAbs > 0n ? Math.round(Number((abs * 100n) / maxAbs)) : 0;
              const color = palette[i % palette.length];
              return (
                <Box
                  key={cat.categoryId ?? cat.name}
                  sx={{
                    position: "relative",
                    borderRadius: 0.75,
                    overflow: "hidden",
                  }}
                >
                  {/* Barra de fundo proporcional */}
                  <Box
                    sx={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      bottom: 0,
                      width: `${barPct}%`,
                      bgcolor: color,
                      opacity: 0.13,
                      borderRadius: 0.75,
                    }}
                  />
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{ position: "relative", px: 0.75, py: 0.4, gap: 0.75 }}
                  >
                    <Stack direction="row" alignItems="center" gap={0.75} sx={{ minWidth: 0 }}>
                      <Box
                        sx={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          bgcolor: color,
                          flexShrink: 0,
                        }}
                      />
                      <Typography
                        noWrap
                        sx={{ fontSize: "0.7rem", color: "text.primary", flex: 1, minWidth: 0 }}
                      >
                        {cat.name}
                      </Typography>
                    </Stack>
                    <Typography
                      sx={{
                        fontFamily: "var(--font-jetbrains-mono), monospace",
                        fontWeight: 700,
                        fontSize: "0.7rem",
                        color: color,
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      {formatCentsToBrl(abs)}
                    </Typography>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        )}
      </WidgetContainer>
    );
  }

  // ── Full (6×3): BarList + colapsável com tabela detalhada ────────────────
  if (renderMode === "full") {
    return (
      <WidgetContainer
        title={m.dashboards.sections.topCategories}
        icon={WIDGET_ICONS["top-categories"]}
        subtitle={`${shown.length} categorias`}
        contentSx={{ overflow: "hidden", display: "flex", flexDirection: "column" }}
      >
        {/* BarList principal */}
        <Box sx={{ overflow: "auto", flex: 1, minHeight: 0 }}>
          <BarList
            items={shown.map((c) => ({
              id: c.categoryId,
              name: c.name,
              valueCents: c.totalCents,
            }))}
            emptyMessage="Sem categorias registradas."
          />
        </Box>

        {/* Toggle para tabela detalhada — análise de Pareto */}
        {shown.length > 0 && (
          <>
            <Divider sx={{ my: 1.5 }} />
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ cursor: "pointer", mb: detailOpen ? 1 : 0 }}
              onClick={() => setDetailOpen((v) => !v)}
            >
              <Typography variant="caption" color="text.tertiary" sx={{ fontSize: "0.7rem" }}>
                {detailOpen ? "Fechar análise" : "Análise de concentração (Pareto)"}
              </Typography>
              <IconButton size="small" sx={{ p: 0.25 }}>
                {detailOpen ? (
                  <ExpandMoreIcon sx={{ fontSize: 14 }} />
                ) : (
                  <ExpandLessIcon sx={{ fontSize: 14 }} />
                )}
              </IconButton>
            </Stack>

            <Collapse in={detailOpen} unmountOnExit>
              <TableContainer
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                }}
              >
                <Table size="small" stickyHeader sx={{ tableLayout: "fixed", width: "100%" }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontSize: "0.65rem", py: 0.5, width: 28 }}>#</TableCell>
                      <TableCell sx={{ fontSize: "0.65rem", py: 0.5, width: 150 }}>
                        Categoria
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: "0.65rem", py: 0.5, width: 68 }}>
                        % do total
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: "0.65rem", py: 0.5, width: 76 }}>
                        % acumulado
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(() => {
                      let cumulative = 0;
                      return shown.map((cat, idx) => {
                        const abs =
                          BigInt(cat.totalCents) < 0n
                            ? -BigInt(cat.totalCents)
                            : BigInt(cat.totalCents);
                        const pct = total > 0n ? Math.round(Number((abs * 100n) / total)) : 0;
                        cumulative += pct;
                        // Destaque de linha quando acumulado cruza 80%
                        const isPareto = cumulative - pct < 80 && cumulative >= 80;
                        return (
                          <TableRow
                            key={cat.categoryId ?? cat.name}
                            hover
                            sx={
                              isPareto
                                ? { borderBottom: "2px solid", borderColor: "warning.main" }
                                : undefined
                            }
                          >
                            <TableCell
                              sx={{
                                fontSize: "0.65rem",
                                py: 0.5,
                                color: "text.tertiary",
                                fontFamily: "var(--font-jetbrains-mono), monospace",
                              }}
                            >
                              {idx + 1}
                            </TableCell>
                            <TableCell
                              sx={{
                                fontSize: "0.7rem",
                                py: 0.5,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {cat.name}
                            </TableCell>
                            <TableCell
                              align="right"
                              sx={{
                                fontSize: "0.7rem",
                                py: 0.5,
                                color: "text.secondary",
                                fontFamily: "var(--font-jetbrains-mono), monospace",
                              }}
                            >
                              {pct}%
                            </TableCell>
                            <TableCell
                              align="right"
                              sx={{
                                fontSize: "0.7rem",
                                py: 0.5,
                                fontFamily: "var(--font-jetbrains-mono), monospace",
                                color: cumulative >= 80 ? "warning.main" : "text.secondary",
                                fontWeight: cumulative >= 80 ? 600 : 400,
                              }}
                            >
                              {cumulative}%
                            </TableCell>
                          </TableRow>
                        );
                      });
                    })()}
                  </TableBody>
                </Table>
              </TableContainer>
              <Typography
                variant="caption"
                color="text.tertiary"
                sx={{ fontSize: "0.62rem", mt: 0.75, display: "block" }}
              >
                Linha marcada = ponto 80% do gasto total (regra de Pareto)
              </Typography>
            </Collapse>
          </>
        )}
      </WidgetContainer>
    );
  }

  // ── Default (3×2): BarList com scroll ────────────────────────────────────
  return (
    <WidgetContainer
      title={m.dashboards.sections.topCategories}
      icon={WIDGET_ICONS["top-categories"]}
      contentSx={{ overflow: "auto" }}
    >
      <BarList
        items={shown.map((c) => ({
          id: c.categoryId,
          name: c.name,
          valueCents: c.totalCents,
        }))}
        emptyMessage="Sem categorias registradas."
      />
    </WidgetContainer>
  );
}
