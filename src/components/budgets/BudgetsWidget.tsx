"use client";

import { useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import { formatCentsToBrl } from "@/lib/money";
import { m } from "@/lib/messages";
import { BudgetProgressBar } from "@/components/budgets/BudgetProgressBar";
import { BudgetFormDialog } from "@/components/budgets/BudgetFormDialog";
import { PieBreakdown } from "@/components/dashboards/charts/PieBreakdown";
import { WidgetContainer } from "@/components/ui/WidgetContainer";
import { WIDGET_ICONS } from "@/components/dashboards/_core/widget-icons";
import type { BudgetProgress, BudgetFormOptions } from "@/server/queries/budgets";
import type { BudgetTxDetail } from "@/actions/budgets";
import type { BudgetsConfig } from "@/lib/schemas/widget-config";

const BUDGET_NEAR_LIMIT_PCT = 80;

type RenderMode = "compact" | "default" | "full";

type Props = {
  budgets: BudgetProgress[];
  accountId: string;
  /** ID do mês atual — necessário para buscar transações no modo full. */
  monthId?: string;
  /** Se fornecido, exibe botão de adicionar meta e o BudgetFormDialog. */
  formOptions?: BudgetFormOptions;
  config?: BudgetsConfig;
  renderMode?: RenderMode;
};

type Status = "ok" | "alert" | "exceeded";
const STATUS_COLOR: Record<Status, "success" | "warning" | "error"> = {
  ok: "success",
  alert: "warning",
  exceeded: "error",
};
function getStatus(percent: number, threshold: number): Status {
  if (percent >= 100) return "exceeded";
  if (percent >= threshold) return "alert";
  return "ok";
}

// ─────────────────────────────────────────────────────────────────────────────

export function BudgetsWidget({
  budgets,
  accountId,
  monthId,
  formOptions,
  config,
  renderMode = "default",
}: Props) {
  const [formOpen, setFormOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [txDetails, setTxDetails] = useState<Record<string, BudgetTxDetail>>({});
  const [, startFetch] = useTransition();

  const shown =
    config?.showOnly === "near_limit"
      ? budgets.filter((b) => b.percent >= BUDGET_NEAR_LIMIT_PCT)
      : budgets;

  const total = shown.length;

  function toggleExpand(id: string) {
    // Lê o estado atual ANTES de chamar o setter para evitar chamar startTransition
    // dentro do updater (o que causaria "Cannot call startTransition while rendering").
    const isExpanding = !expandedIds.has(id);

    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

    // Busca transações na primeira abertura — fora do updater do state
    if (isExpanding && renderMode === "full" && monthId && !txDetails[id]) {
      startFetch(async () => {
        const { getBudgetTransactionsAction } = await import("@/actions/budgets");
        const result = await getBudgetTransactionsAction(accountId, { budgetId: id, monthId });
        if (result.ok) {
          setTxDetails((prev) => ({ ...prev, [id]: result.data }));
        }
      });
    }
  }

  const addButton = formOptions ? (
    <Tooltip title={m.budgets.createButton}>
      <IconButton size="small" onClick={() => setFormOpen(true)}>
        <AddIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Tooltip>
  ) : undefined;

  const dialog = formOptions ? (
    <BudgetFormDialog
      open={formOpen}
      onClose={() => setFormOpen(false)}
      accountId={accountId}
      formOptions={formOptions}
      onSuccess={() => setFormOpen(false)}
    />
  ) : null;

  // ── Compact (small 2×1): paginated single-budget view ───────────────────────
  if (renderMode === "compact") {
    const current = shown[page] ?? null;
    const status = current ? getStatus(current.percent, current.alertThresholdPercent) : "ok";
    const mColor = current ? STATUS_COLOR[status] : "success";
    const clampedPct = current ? Math.min(current.percent, 100) : 0;

    return (
      <>
        <WidgetContainer
          title={m.budgets.title}
          icon={WIDGET_ICONS["budgets"]}
          subtitle={total > 1 ? `${page + 1}/${total}` : undefined}
          secondary={addButton}
          contentSx={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-start",
            overflow: "hidden",
          }}
        >
          {total === 0 ? (
            <Typography variant="caption" color="text.secondary" align="center" display="block">
              Sem metas.
            </Typography>
          ) : (
            <Stack direction="row" alignItems="center" gap={2} sx={{ mt: 1.5 }}>
              <IconButton
                size="medium"
                disabled={total <= 1}
                onClick={() => setPage((p) => (p - 1 + total) % total)}
                sx={{ p: 0.5 }}
              >
                <ChevronLeftIcon sx={{ fontSize: 20 }} />
              </IconButton>

              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack
                  direction="row"
                  alignItems="baseline"
                  justifyContent="space-between"
                  sx={{ mb: 0.5 }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    noWrap
                    sx={{ fontSize: "0.7rem", maxWidth: "65%" }}
                  >
                    {current!.label}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      fontFamily: "var(--font-jetbrains-mono), monospace",
                      fontWeight: 700,
                      fontSize: "0.8rem",
                      color: `${mColor}.main`,
                      ml: 0.5,
                    }}
                  >
                    {current!.percent}%
                  </Typography>
                </Stack>
                <Tooltip
                  title={`${formatCentsToBrl(BigInt(current!.spentCents))} de ${formatCentsToBrl(BigInt(current!.amountCents))}`}
                  placement="top"
                >
                  <LinearProgress
                    variant="determinate"
                    value={clampedPct}
                    color={mColor}
                    sx={{ height: 14, borderRadius: 3 }}
                  />
                </Tooltip>
              </Box>

              <IconButton
                size="medium"
                disabled={total <= 1}
                onClick={() => setPage((p) => (p + 1) % total)}
                sx={{ p: 0.5 }}
              >
                <ChevronRightIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Stack>
          )}
        </WidgetContainer>
        {dialog}
      </>
    );
  }

  // ── Full (large 6×3): bar list + colapsável com transações + pie por categoria ──
  if (renderMode === "full") {
    return (
      <>
        <WidgetContainer
          title={m.budgets.title}
          subtitle={total > 0 ? `${total} ${total === 1 ? "meta" : "metas"}` : undefined}
          icon={WIDGET_ICONS["budgets"]}
          secondary={addButton}
          contentSx={{ overflow: "auto" }}
        >
          {total === 0 ? (
            <Stack alignItems="center" sx={{ py: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Sem metas. {formOptions ? "Clique em + para criar." : ""}
              </Typography>
            </Stack>
          ) : (
            <Stack divider={<Divider />}>
              {shown.map((b) => {
                const isExpanded = expandedIds.has(b.id);
                const detail = txDetails[b.id];

                return (
                  <Box key={b.id} sx={{ py: 1.5 }}>
                    {/* Barra + botão expand */}
                    <Stack direction="row" alignItems="flex-start" gap={1}>
                      <Box sx={{ flex: 1 }}>
                        <BudgetProgressBar
                          label={b.label}
                          amountCents={b.amountCents}
                          spentCents={b.spentCents}
                          percent={b.percent}
                          alertThresholdPercent={b.alertThresholdPercent}
                        />
                      </Box>
                      <IconButton
                        size="small"
                        onClick={() => toggleExpand(b.id)}
                        sx={{ mt: 0.5, flexShrink: 0 }}
                      >
                        {isExpanded ? (
                          <ExpandLessIcon sx={{ fontSize: 16 }} />
                        ) : (
                          <ExpandMoreIcon sx={{ fontSize: 16 }} />
                        )}
                      </IconButton>
                    </Stack>

                    {/* Detalhe colapsável */}
                    <Collapse in={isExpanded} unmountOnExit>
                      {!detail ? (
                        <Typography
                          variant="caption"
                          color="text.tertiary"
                          sx={{ mt: 1.5, display: "block" }}
                        >
                          {monthId ? "Carregando transações…" : "monthId não disponível."}
                        </Typography>
                      ) : (
                        <Box
                          sx={{
                            mt: 1.5,
                            display: "grid",
                            gridTemplateColumns:
                              detail.categoryBreakdown.length > 0 ? "1fr 220px" : "1fr",
                            gap: 2,
                            alignItems: "start",
                          }}
                        >
                          {/* Esquerda: tabela de transações */}
                          <Box>
                            {detail.transactions.length === 0 ? (
                              <Typography variant="caption" color="text.tertiary">
                                Nenhuma transação encontrada para esta meta neste mês.
                              </Typography>
                            ) : (
                              <TableContainer
                                sx={{
                                  maxHeight: 200,
                                  border: "1px solid",
                                  borderColor: "divider",
                                  borderRadius: 1,
                                }}
                              >
                                <Table
                                  size="small"
                                  stickyHeader
                                  sx={{ tableLayout: "fixed", width: "100%" }}
                                >
                                  <TableHead>
                                    <TableRow>
                                      <TableCell sx={{ fontSize: "0.65rem", py: 0.5, width: 72 }}>
                                        Data
                                      </TableCell>
                                      <TableCell sx={{ fontSize: "0.65rem", py: 0.5, width: 128 }}>
                                        Descrição
                                      </TableCell>
                                      <TableCell sx={{ fontSize: "0.65rem", py: 0.5, width: 84 }}>
                                        Categoria
                                      </TableCell>
                                      <TableCell
                                        align="right"
                                        sx={{ fontSize: "0.65rem", py: 0.5, width: 88 }}
                                      >
                                        Valor
                                      </TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {detail.transactions.map((tx) => (
                                      <TableRow key={tx.id} hover>
                                        <TableCell
                                          sx={{
                                            fontSize: "0.7rem",
                                            py: 0.5,
                                            whiteSpace: "nowrap",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            color: "text.secondary",
                                          }}
                                        >
                                          {tx.occurredOn.slice(5).replace("-", "/")}
                                        </TableCell>
                                        <TableCell
                                          sx={{
                                            fontSize: "0.7rem",
                                            py: 0.5,
                                            maxWidth: 200,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                          }}
                                        >
                                          <Tooltip title={tx.description ?? "—"} placement="top">
                                            <span>{tx.description ?? "—"}</span>
                                          </Tooltip>
                                        </TableCell>
                                        <TableCell
                                          sx={{
                                            fontSize: "0.7rem",
                                            py: 0.5,
                                            color: "text.secondary",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                          }}
                                        >
                                          {tx.categoryName ?? "—"}
                                        </TableCell>
                                        <TableCell
                                          align="right"
                                          sx={{
                                            fontSize: "0.7rem",
                                            py: 0.5,
                                            fontFamily: "var(--font-jetbrains-mono), monospace",
                                            whiteSpace: "nowrap",
                                          }}
                                        >
                                          {formatCentsToBrl(BigInt(tx.amountCents))}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </TableContainer>
                            )}
                            {detail.transactions.length >= 100 && (
                              <Typography
                                variant="caption"
                                color="text.tertiary"
                                sx={{ mt: 0.5, display: "block" }}
                              >
                                Exibindo as 100 transações mais recentes.
                              </Typography>
                            )}
                          </Box>

                          {/* Direita: pie de categorias */}
                          {detail.categoryBreakdown.length > 0 && (
                            <Box sx={{ display: "flex", flexDirection: "column" }}>
                              <Typography
                                variant="caption"
                                color="text.tertiary"
                                sx={{ fontSize: "0.65rem", mb: 0.5, textAlign: "center" }}
                              >
                                Por categoria
                              </Typography>
                              <Box
                                sx={{
                                  width: "100%",
                                  height: 182,
                                  display: "flex",
                                  flexDirection: "column",
                                }}
                              >
                                <PieBreakdown
                                  items={detail.categoryBreakdown.map((c) => ({
                                    name: c.name,
                                    valueCents: c.valueCents,
                                  }))}
                                  renderMode="compact"
                                />
                              </Box>
                            </Box>
                          )}
                        </Box>
                      )}
                    </Collapse>
                  </Box>
                );
              })}
            </Stack>
          )}
        </WidgetContainer>
        {dialog}
      </>
    );
  }

  // ── Default (3×2): lista com scroll ─────────────────────────────────────────
  return (
    <>
      <WidgetContainer
        title={m.budgets.title}
        subtitle={total > 0 ? `${total} ${total === 1 ? "meta" : "metas"}` : undefined}
        icon={WIDGET_ICONS["budgets"]}
        secondary={addButton}
        contentSx={{ overflow: "auto" }}
      >
        {total === 0 ? (
          <Stack alignItems="center" sx={{ py: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Sem metas. {formOptions ? "Clique em + para criar." : ""}
            </Typography>
          </Stack>
        ) : (
          <Stack spacing={1.5}>
            {shown.map((b) => (
              <BudgetProgressBar
                key={b.id}
                label={b.label}
                amountCents={b.amountCents}
                spentCents={b.spentCents}
                percent={b.percent}
                alertThresholdPercent={b.alertThresholdPercent}
              />
            ))}
          </Stack>
        )}
      </WidgetContainer>
      {dialog}
    </>
  );
}
