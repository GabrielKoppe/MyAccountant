"use client";

import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import FlagIcon from "@mui/icons-material/Flag";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
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
import { useMemo, useState, useTransition } from "react";

import { deleteBudgetAction } from "@/actions/budgets";
import {
  BUDGET_STATUS_VARIANT,
  getBudgetStatus,
  type BudgetStatus,
} from "@/components/budgets/budget-status";
import { BudgetFormDialog } from "@/components/budgets/BudgetFormDialog";
import { BudgetProgressBar } from "@/components/budgets/BudgetProgressBar";
import { DialogShell } from "@/components/ui/DialogShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { containers, layout } from "@/lib/design-tokens";
import { useActionFeedback } from "@/lib/hooks/use-action-feedback";
import { m } from "@/lib/messages";
import { formatCentsToBrl } from "@/lib/money";
import type { BudgetFormOptions, BudgetProgress } from "@/server/queries/budgets";

type Props = {
  accountId: string;
  initialBudgets: BudgetProgress[];
  formOptions: BudgetFormOptions;
  canEdit: boolean;
};

/** Rótulo do `StatusBadge` por status (§5.9) — reusa `m.budgets.progress.*`, já
 * existentes e (até esta fase) não consumidos em lugar nenhum. */
const BUDGET_STATUS_LABEL: Record<BudgetStatus, string> = {
  ok: m.budgets.progress.onTrack,
  alert: m.budgets.progress.attention,
  exceeded: m.budgets.progress.exceeded,
};

/**
 * Aba Orçamento do hub Planejamento (spec 47 §5.9, Fase 11) — reconstrução da
 * superfície do `Budget` (antes `settings/budgets/BudgetsManager.tsx`) com a
 * MESMA linguagem visual da aba Metas (`GoalsManager.tsx`, Fase 8): barra de
 * ação com botão contextual, hero de KPIs (`Paper variant="outlined"`), grid de
 * cards, `EmptyState`, dialogs via `DialogShell`.
 *
 * Reusa o comportamento do Budget INTACTO: `BudgetFormDialog` (criar/editar —
 * já chama `create/updateBudgetAction` e mostra seu próprio feedback) e
 * `BudgetProgressBar` (barra com a semântica de LIMITE de gasto — encher é
 * ruim, oposto de `GoalProgressBar`). Nenhum cálculo é duplicado aqui:
 * `getBudgetStatus` (extraído de `BudgetProgressBar` para `budget-status.ts`
 * nesta mesma fase) é a MESMA função usada dentro da própria barra, só
 * reaproveitada para os badges de status e a contagem do hero.
 *
 * Sem otimismo de criação/edição (diferente de `GoalsManager`): mudar a
 * dimensão de um orçamento muda `spentCents` no servidor (novo agregado de
 * transações, `calcSpent` em `queries/budgets.ts`) de um jeito que não dá pra
 * prever no client sem duplicar aquele cálculo — arriscaria mostrar um % errado
 * por um instante. `BudgetFormDialog` já fecha e mostra o toast de sucesso;
 * disparamos só `router.refresh()` para os cards refletirem o servidor de novo.
 * Exclusão é remoção pura (sem recomputar nada), então essa sim é otimista —
 * mesmo critério de `GoalsManager` (ver seu JSDoc).
 */
export function BudgetsPlanningManager({ accountId, initialBudgets, formOptions, canEdit }: Props) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const { handle } = useActionFeedback();
  const [isPending, startTransition] = useTransition();

  const [budgets, setBudgets] = useState<BudgetProgress[]>(initialBudgets);

  // Re-sincroniza com o servidor sempre que o RSC pai refizer o fetch (após
  // router.refresh()) — mesma técnica de GoalsManager. Ajuste feito DURANTE o
  // render, não em useEffect (evita re-render extra, "Adjusting state when a
  // prop changes", react.dev/learn/you-might-not-need-an-effect).
  const [prevInitial, setPrevInitial] = useState(initialBudgets);
  if (initialBudgets !== prevInitial) {
    setPrevInitial(initialBudgets);
    setBudgets(initialBudgets);
  }

  // Dialog: criar/editar (BudgetFormDialog reusado — Fase 11 não reescreve o form)
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<BudgetProgress | undefined>(undefined);

  // Dialog: excluir
  const [deleteTarget, setDeleteTarget] = useState<BudgetProgress | null>(null);

  // Menu de ações (⋮) por card — só existe quando canEdit (Budget não tem uma
  // superfície de "detalhe" read-only como a meta, então não há nada a mostrar
  // pro viewer aqui).
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; budget: BudgetProgress } | null>(
    null,
  );

  // Hero de KPIs (§5.9) — total orçado/gasto e contagem por status. Aritmética
  // simples sobre o que o servidor já calculou (spentCents/percent por
  // orçamento); nenhuma regra do Budget é reimplementada aqui.
  const kpis = useMemo(() => {
    let totalBudgetedCents = 0n;
    let totalSpentCents = 0n;
    let okCount = 0;
    let attentionCount = 0;
    let exceededCount = 0;
    for (const b of budgets) {
      totalBudgetedCents += BigInt(b.amountCents);
      totalSpentCents += BigInt(b.spentCents);
      const status = getBudgetStatus(b.percent, b.alertThresholdPercent);
      if (status === "ok") okCount++;
      else if (status === "alert") attentionCount++;
      else exceededCount++;
    }
    const usedPercent =
      totalBudgetedCents > 0n ? (Number(totalSpentCents) / Number(totalBudgetedCents)) * 100 : 0;
    return {
      totalBudgetedCents,
      totalSpentCents,
      usedPercent,
      okCount,
      attentionCount,
      exceededCount,
    };
  }, [budgets]);

  function openCreate() {
    setEditTarget(undefined);
    setFormOpen(true);
  }

  function openEdit(budget: BudgetProgress) {
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
    <Box sx={{ p: layout.page, maxWidth: containers.lg, mx: "auto" }}>
      <Stack spacing={layout.section}>
        {/* ── Barra de ação (o PageHeader do hub já vem do layout — só o botão contextual) ── */}
        {canEdit && (
          <Stack direction="row" alignItems="center" justifyContent="flex-end">
            {/* U10 (fix wave): caption de contagem — espelha a barra de ação da aba
                Metas (GoalsManager.tsx, mr:"auto"). */}
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
          <Stack spacing={layout.page}>
            {/* ── Hero KPIs ── */}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, 1fr)",
                  // U12 (fix wave): "Total orçado" é o card primário do hero — mesma
                  // âncora "2fr" do hero de Metas (GoalsManager.tsx, "2fr 1fr 1fr 1fr").
                  md: "2fr 1fr",
                },
                gap: layout.cluster,
              }}
            >
              <Paper
                variant="outlined"
                sx={{ p: layout.card, display: "flex", flexDirection: "column", gap: layout.micro }}
              >
                <Typography variant="overline" sx={{ color: "text.tertiary" }}>
                  {m.budgets.hero.totalBudgeted}
                </Typography>
                <Typography
                  variant="mono"
                  component="div"
                  sx={{ fontSize: "1.5rem", fontWeight: 600, lineHeight: 1.2 }}
                >
                  {formatCentsToBrl(kpis.totalBudgetedCents)}
                </Typography>
                <Typography variant="caption" sx={{ color: "text.tertiary" }}>
                  {`${kpis.usedPercent.toFixed(0)}% · ${m.budgets.hero.totalSpent} ${formatCentsToBrl(kpis.totalSpentCents)}`}
                </Typography>
              </Paper>

              <Paper
                variant="outlined"
                sx={{
                  p: layout.card,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: layout.micro,
                  justifyContent: "center",
                }}
              >
                <Typography variant="overline" sx={{ color: "text.tertiary" }}>
                  {m.budgets.hero.statusOverview}
                </Typography>
                <Stack direction="row" flexWrap="wrap" gap={layout.inline}>
                  <StatusBadge variant="success">
                    {m.budgets.hero.okCount(kpis.okCount)}
                  </StatusBadge>
                  <StatusBadge variant="warning">
                    {m.budgets.hero.attentionCount(kpis.attentionCount)}
                  </StatusBadge>
                  <StatusBadge variant="danger">
                    {m.budgets.hero.exceededCount(kpis.exceededCount)}
                  </StatusBadge>
                </Stack>
              </Paper>
            </Box>

            {/* ── Grid de cards ── */}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" },
                gap: layout.cluster,
              }}
            >
              {budgets.map((budget) => (
                <BudgetCard
                  key={budget.id}
                  budget={budget}
                  canEdit={canEdit}
                  onOpenMenu={(el) => setMenuAnchor({ el, budget })}
                />
              ))}
            </Box>
          </Stack>
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

      {/* ── Dialog: criar/editar (reusa BudgetFormDialog intacto — spec 47 §3.5) ── */}
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
    </Box>
  );
}

// ─── Card de orçamento (grid da aba Orçamento, §5.9) ───────────────────────

type BudgetCardProps = {
  budget: BudgetProgress;
  canEdit: boolean;
  onOpenMenu: (el: HTMLElement) => void;
};

function BudgetCard({ budget, canEdit, onOpenMenu }: BudgetCardProps) {
  const status = getBudgetStatus(budget.percent, budget.alertThresholdPercent);

  return (
    <Paper
      variant="outlined"
      sx={{ p: layout.card, display: "flex", flexDirection: "column", gap: layout.stack }}
    >
      {/* BudgetProgressBar já traz rótulo/nome + ícone + % + gasto/alvo — mesmo
          componente usado nos widgets do dashboard mensal (visual consistente
          em todo o app para "orçamento"), semântica de LIMITE intacta. */}
      <BudgetProgressBar
        label={budget.label}
        amountCents={budget.amountCents}
        spentCents={budget.spentCents}
        percent={budget.percent}
        alertThresholdPercent={budget.alertThresholdPercent}
      />

      <DimensionChips budget={budget} />

      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <StatusBadge variant={BUDGET_STATUS_VARIANT[status]}>
          {BUDGET_STATUS_LABEL[status]}
        </StatusBadge>
        {canEdit && (
          <IconButton
            size="small"
            aria-label={`${m.common.moreActions} — ${budget.label}`}
            onClick={(e) => onOpenMenu(e.currentTarget)}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
        )}
      </Stack>
    </Paper>
  );
}

// ─── Chips de dimensão (§5.9 "chip da dimensão") — espelha o helper DimChips do
// antigo settings/budgets/BudgetsManager.tsx, agora com os prefixos vindos de
// m.budgets.fields.* em vez de string hardcoded (CLAUDE.md §5.10). ──────────
function DimensionChips({ budget }: { budget: BudgetProgress }) {
  const dims: string[] = [];
  if (budget.section) dims.push(`${m.budgets.fields.section}: ${budget.section.name}`);
  if (budget.category) dims.push(`${m.budgets.fields.category}: ${budget.category.name}`);
  if (budget.member) dims.push(`${m.budgets.fields.member}: ${budget.member.name ?? "?"}`);
  if (budget.institution) dims.push(`${m.budgets.fields.institution}: ${budget.institution.name}`);
  if (budget.tableType) dims.push(`${m.budgets.fields.tableType}: ${budget.tableType.name}`);

  if (dims.length === 0) return null;

  return (
    <Stack direction="row" gap={layout.inline} flexWrap="wrap">
      {dims.map((d) => (
        <Chip key={d} label={d} size="small" variant="outlined" />
      ))}
    </Stack>
  );
}
