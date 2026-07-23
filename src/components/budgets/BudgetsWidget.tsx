"use client";

import { useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
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
import { getBudgetStatus, BUDGET_STATUS_COLOR } from "@/components/budgets/budget-status";
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

// Status/cor do orçamento vêm de `budget-status.ts` (fonte única, reusada pelo
// BudgetProgressBar, hero de KPIs e aba Orçamento) — não duplicar o cálculo aqui.

// Chips da dimensão RESPONSÁVEL (antes "membro") — usa o novo shape do serializer:
// `members` são responsibleParties `{ id, name }` (name pode ser null → fallback).
// Um chip por responsável; nada renderiza quando o orçamento não restringe a dimensão.
function ResponsibleChips({ members }: { members: { id: string; name: string | null }[] }) {
  if (members.length === 0) return null;
  return (
    <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 0.75 }}>
      {members.map((mb) => (
        <Chip
          key={mb.id}
          label={mb.name ?? m.budgets.fields.member}
          size="small"
          variant="outlined"
          sx={{ maxWidth: "100%" }}
        />
      ))}
    </Stack>
  );
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
  // Ids cujo fetch de transações FALHOU — sentinela de erro para parar o "Carregando…"
  // e exibir uma mensagem curta em vez de girar pra sempre.
  const [txErrors, setTxErrors] = useState<Set<string>>(new Set());
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
      // Reabrir após um erro deve tentar de novo: limpa o sentinela antes do fetch.
      setTxErrors((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      startFetch(async () => {
        const { getBudgetTransactionsAction } = await import("@/actions/budgets");
        const result = await getBudgetTransactionsAction(accountId, { budgetId: id, monthId });
        if (result.ok) {
          setTxDetails((prev) => ({ ...prev, [id]: result.data }));
        } else {
          setTxErrors((prev) => new Set(prev).add(id));
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
    const status = current ? getBudgetStatus(current.percent, current.alertThresholdPercent) : "ok";
    const mColor = current ? BUDGET_STATUS_COLOR[status] : "success";
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
              {m.budgets.widget.empty}
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
          subtitle={total > 0 ? m.budgets.widget.count(total) : undefined}
          icon={WIDGET_ICONS["budgets"]}
          secondary={addButton}
          contentSx={{ overflow: "auto" }}
        >
          {total === 0 ? (
            <Stack alignItems="center" sx={{ py: 2 }}>
              <Typography variant="caption" color="text.secondary">
                {m.budgets.widget.empty} {formOptions ? m.budgets.widget.createHint : ""}
              </Typography>
            </Stack>
          ) : (
            <Stack divider={<Divider />}>
              {shown.map((b) => {
                const isExpanded = expandedIds.has(b.id);
                const detail = txDetails[b.id];

                const hasError = txErrors.has(b.id);

                return (
                  <Box key={b.id} sx={{ py: 1.5 }}>
                    {/* Barra + botão expand */}
                    <Stack direction="row" alignItems="flex-start" gap={1}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <BudgetProgressBar
                          label={b.label}
                          amountCents={b.amountCents}
                          spentCents={b.spentCents}
                          percent={b.percent}
                          alertThresholdPercent={b.alertThresholdPercent}
                        />
                        <ResponsibleChips members={b.members} />
                      </Box>
                      {/* Sem monthId (widget fora do contexto de um mês) o botão fica
                          desabilitado — evita expandir para um beco sem saída. */}
                      <Tooltip title={monthId ? "" : m.budgets.widget.detailUnavailable}>
                        <Box component="span" sx={{ display: "inline-flex", flexShrink: 0 }}>
                          <IconButton
                            size="small"
                            disabled={!monthId}
                            onClick={() => toggleExpand(b.id)}
                            sx={{ mt: 0.5 }}
                          >
                            {isExpanded ? (
                              <ExpandLessIcon sx={{ fontSize: 16 }} />
                            ) : (
                              <ExpandMoreIcon sx={{ fontSize: 16 }} />
                            )}
                          </IconButton>
                        </Box>
                      </Tooltip>
                    </Stack>

                    {/* Detalhe colapsável */}
                    <Collapse in={isExpanded} unmountOnExit>
                      {hasError ? (
                        <Typography
                          variant="caption"
                          color="danger.main"
                          sx={{ mt: 1.5, display: "block" }}
                        >
                          {m.budgets.loadError}
                        </Typography>
                      ) : !detail ? (
                        <Typography
                          variant="caption"
                          color="text.tertiary"
                          sx={{ mt: 1.5, display: "block" }}
                        >
                          {m.budgets.loadingTransactions}
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
                                {m.budgets.widget.noTransactions}
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
                                        {m.budgets.widget.table.date}
                                      </TableCell>
                                      <TableCell sx={{ fontSize: "0.65rem", py: 0.5, width: 128 }}>
                                        {m.budgets.widget.table.description}
                                      </TableCell>
                                      <TableCell sx={{ fontSize: "0.65rem", py: 0.5, width: 84 }}>
                                        {m.budgets.widget.table.category}
                                      </TableCell>
                                      <TableCell
                                        align="right"
                                        sx={{ fontSize: "0.65rem", py: 0.5, width: 88 }}
                                      >
                                        {m.budgets.widget.table.amount}
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
                                {m.budgets.widget.showingLimit}
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
                                {m.budgets.widget.byCategory}
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
        subtitle={total > 0 ? `${total} ${total === 1 ? "orçamento" : "orçamentos"}` : undefined}
        icon={WIDGET_ICONS["budgets"]}
        secondary={addButton}
        contentSx={{ overflow: "auto" }}
      >
        {total === 0 ? (
          <Stack alignItems="center" sx={{ py: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Sem orçamentos. {formOptions ? "Clique em + para criar." : ""}
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
