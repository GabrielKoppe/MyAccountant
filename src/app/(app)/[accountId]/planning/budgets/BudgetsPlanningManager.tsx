"use client";

import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import FlagIcon from "@mui/icons-material/Flag";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";
import { useSnackbar } from "notistack";
import { useState, useTransition } from "react";

import { deleteBudgetAction } from "@/actions/budgets";
import { getBudgetLabel } from "@/components/budgets/budget-label";
import { BUDGET_STATUS_LABEL, BUDGET_STATUS_VARIANT } from "@/components/budgets/budget-status";
import { BudgetDetailDialog } from "@/components/budgets/BudgetDetailDialog";
import { BudgetFormDialog } from "@/components/budgets/BudgetFormDialog";
import { DimensionChips } from "@/components/budgets/DimensionChips";
import { DialogShell } from "@/components/ui/DialogShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MONTH_NAMES } from "@/lib/dates";
import { layout } from "@/lib/design-tokens";
import { useActionFeedback } from "@/lib/hooks/use-action-feedback";
import { m } from "@/lib/messages";
import { formatCentsToBrl } from "@/lib/money";
import type { BudgetConfigWithHistory, BudgetFormOptions } from "@/server/queries/budgets";

type Props = {
  accountId: string;
  initialBudgets: BudgetConfigWithHistory[];
  formOptions: BudgetFormOptions;
  canEdit: boolean;
};

/**
 * Aba Orçamento do hub Planejamento — visão CONFIG agnóstica de mês (Spec 25). Um
 * `Budget` não tem "progresso do mês vigente": ele é uma configuração (dimensões +
 * alvo/mês) que se aplica a cada mês.
 *
 * Layout (spec 47 §5.9 fix wave): GRID responsivo de cards COMPACTOS (nome, alvo/mês,
 * dimensões em chips, badge do status do último mês) — cada card abre o
 * `BudgetDetailDialog` (histórico em barras + resumo + dimensões completas). A antiga
 * faixa de marcadores inline no card saiu daqui — virou o gráfico do dialog, que conta
 * a mesma história (evolução do status mês a mês) com mais espaço e sem lotar a grid.
 *
 * O histórico já vem calculado do servidor (`getBudgetsConfigWithHistory` → `calcSpent`
 * por (orçamento, mês)); nada de cálculo de gasto é duplicado aqui. Criar/editar via
 * `BudgetFormDialog` (reusado intacto) + `router.refresh()` para o RSC pai refazer o
 * fetch; excluir é otimista (remoção pura não recomputa nada).
 */
export function BudgetsPlanningManager({ accountId, initialBudgets, formOptions, canEdit }: Props) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const { handle } = useActionFeedback();
  const [isPending, startTransition] = useTransition();

  const [budgets, setBudgets] = useState<BudgetConfigWithHistory[]>(initialBudgets);

  // Re-sincroniza com o servidor sempre que o RSC pai refizer o fetch (após
  // router.refresh()) — mesma técnica de GoalsManager. Ajuste feito DURANTE o
  // render, não em useEffect (react.dev/learn/you-might-not-need-an-effect).
  const [prevInitial, setPrevInitial] = useState(initialBudgets);
  if (initialBudgets !== prevInitial) {
    setPrevInitial(initialBudgets);
    setBudgets(initialBudgets);
  }

  // Dialog: criar/editar (BudgetFormDialog reusado — não reescreve o form)
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<BudgetConfigWithHistory | undefined>(undefined);

  // Dialog: excluir
  const [deleteTarget, setDeleteTarget] = useState<BudgetConfigWithHistory | null>(null);

  // Dialog: detalhe (histórico em barras + resumo + dimensões — BudgetDetailDialog).
  // Guarda só o `id` e re-deriva do array `budgets` (ressincronizado a cada
  // router.refresh() via prevInitial): se um refresh chegar com o detalhe aberto, o
  // dialog mostra o histórico atualizado, não um snapshot capturado no clique.
  const [detailTargetId, setDetailTargetId] = useState<string | null>(null);
  const detailBudget = detailTargetId
    ? (budgets.find((b) => b.id === detailTargetId) ?? null)
    : null;

  // Menu de ações (⋮) por card — só existe quando canEdit.
  const [menuAnchor, setMenuAnchor] = useState<{
    el: HTMLElement;
    budget: BudgetConfigWithHistory;
  } | null>(null);

  function openCreate() {
    setEditTarget(undefined);
    setFormOpen(true);
  }

  function openEdit(budget: BudgetConfigWithHistory) {
    setEditTarget(budget);
    setFormOpen(true);
    setMenuAnchor(null);
  }

  function closeForm() {
    setFormOpen(false);
    setEditTarget(undefined);
  }

  function handleFormSuccess() {
    closeForm();
    router.refresh();
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    startTransition(async () => {
      const result = await deleteBudgetAction(accountId, { budgetId: target.id });
      const ok = handle(result);
      if (!ok) return;
      setBudgets((prev) => prev.filter((b) => b.id !== target.id));
      enqueueSnackbar(m.budgets.deleted, { variant: "success" });
      router.refresh();
    });
  }

  return (
    <Box sx={{ px: layout.page, py: layout.inline }}>
      <Stack spacing={3}>
        {/* ── Barra de ação (o PageHeader do hub vem do layout — só o botão contextual) ── */}
        {canEdit && (
          <Stack direction="row" alignItems="center" justifyContent="flex-end">
            {budgets.length > 0 && (
              <Typography variant="caption" sx={{ color: "text.tertiary", mr: "auto" }}>
                {m.budgets.activeCount(budgets.length)}
              </Typography>
            )}
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              {m.budgets.createButton}
            </Button>
          </Stack>
        )}

        {budgets.length === 0 ? (
          <EmptyState
            icon={<FlagIcon sx={{ fontSize: 48 }} />}
            title={m.budgets.noMetas}
            description={m.budgets.noMetasHint}
            action={
              canEdit ? (
                <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
                  {m.budgets.createButton}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" },
              gap: layout.cluster,
            }}
          >
            {budgets.map((budget) => (
              <BudgetConfigCard
                key={budget.id}
                budget={budget}
                canEdit={canEdit}
                onOpenMenu={(el) => setMenuAnchor({ el, budget })}
                onOpenDetail={() => setDetailTargetId(budget.id)}
              />
            ))}
          </Box>
        )}
      </Stack>

      {/* ── Menu de ações (⋮) por card ── */}
      <Menu
        anchorEl={menuAnchor?.el ?? null}
        open={!!menuAnchor}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem onClick={() => menuAnchor && openEdit(menuAnchor.budget)}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          {m.common.edit}
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            if (menuAnchor) setDeleteTarget(menuAnchor.budget);
            setMenuAnchor(null);
          }}
          sx={{ color: "danger.main" }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" sx={{ color: "danger.main" }} />
          </ListItemIcon>
          {m.common.delete}
        </MenuItem>
      </Menu>

      {/* ── Dialog: criar/editar (reusa BudgetFormDialog intacto) ── */}
      <BudgetFormDialog
        open={formOpen}
        onClose={closeForm}
        accountId={accountId}
        formOptions={formOptions}
        budget={editTarget}
        onSuccess={handleFormSuccess}
      />

      {/* ── Dialog: confirmar exclusão ── */}
      <DialogShell
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        maxWidth="xs"
        title={m.budgets.deleteTitle}
        description={m.budgets.deleteConfirm}
        loading={isPending}
        actions={
          <>
            <Button size="small" onClick={() => setDeleteTarget(null)}>
              {m.common.cancel}
            </Button>
            <Button size="small" color="error" variant="contained" onClick={confirmDelete}>
              {m.common.delete}
            </Button>
          </>
        }
      />

      {/* ── Dialog: detalhe (histórico em barras — BudgetDetailDialog) ── */}
      {detailBudget && (
        <BudgetDetailDialog
          open={!!detailBudget}
          onClose={() => setDetailTargetId(null)}
          budget={detailBudget}
        />
      )}
    </Box>
  );
}

// ─── Card de orçamento (grid — nome, alvo, dimensões, status do último mês) ─────

type CardProps = {
  budget: BudgetConfigWithHistory;
  canEdit: boolean;
  onOpenMenu: (el: HTMLElement) => void;
  onOpenDetail: () => void;
};

function BudgetConfigCard({ budget, canEdit, onOpenMenu, onOpenDetail }: CardProps) {
  const label = budget.name || getBudgetLabel(budget);
  const amount = formatCentsToBrl(BigInt(budget.amountCents));
  const target =
    budget.isRecurring || budget.year == null || budget.month == null
      ? m.budgets.targetPerMonth(amount)
      : m.budgets.targetForPeriod(amount, `${MONTH_NAMES[budget.month - 1]}/${budget.year}`);

  // `history` vem ordenado do mais antigo para o mais recente (getBudgetsConfigWithHistory).
  const lastEntry = budget.history.length > 0 ? budget.history[budget.history.length - 1] : null;

  return (
    <Paper
      variant="outlined"
      sx={{ p: layout.card, display: "flex", flexDirection: "column", gap: layout.stack }}
    >
      <Stack direction="column" justifyContent="space-between" gap={layout.card}>
        <Stack direction="column" gap={layout.inline}>
          {/* Cabeçalho: nome/rótulo + alvo + ações */}
          <Stack
            direction="row"
            alignItems="flex-start"
            justifyContent="space-between"
            gap={layout.inline}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body1" fontWeight={500} noWrap>
                {label}
              </Typography>
              <Typography
                variant="mono"
                component="div"
                sx={{ color: "text.secondary", mt: 0.25, fontSize: "0.85rem" }}
              >
                {target}
              </Typography>
            </Box>
            {canEdit && (
              <IconButton
                size="small"
                aria-label={`${m.common.moreActions} — ${label}`}
                onClick={(e) => onOpenMenu(e.currentTarget)}
                sx={{ flexShrink: 0, fontSize: "0.875rem" }}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            )}
          </Stack>

          {/* Dimensões (compacto — até 2 nomes por dimensão + "+N", Tooltip com a lista completa) */}
          <DimensionChips budget={budget} compact size="small" />
        </Stack>

        {/* Rodapé: badge do último mês + CTA pro histórico completo (BudgetDetailDialog) */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap={layout.inline}
        >
          {lastEntry ? (
            <StatusBadge variant={BUDGET_STATUS_VARIANT[lastEntry.status]}>
              {BUDGET_STATUS_LABEL[lastEntry.status]}
            </StatusBadge>
          ) : (
            <StatusBadge variant="neutral">{m.budgets.history.noData}</StatusBadge>
          )}
          <Button size="small" onClick={onOpenDetail}>
            {m.budgets.detail.viewHistory}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
