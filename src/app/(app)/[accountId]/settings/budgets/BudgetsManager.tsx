"use client";

import { useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import RepeatIcon from "@mui/icons-material/Repeat";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import { useSnackbar } from "notistack";

import { deleteBudgetAction, listBudgetsAction } from "@/actions/budgets";
import { BudgetFormDialog } from "@/components/budgets/BudgetFormDialog";
import { DialogShell } from "@/components/ui/DialogShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { m } from "@/lib/messages";
import { formatCentsToBrl } from "@/lib/money";
import PageSettingsContainer from "@/components/settings/PageSettingsContainer";
import type { BudgetWithDetails, BudgetFormOptions } from "@/lib/queries/budgets";
import { getBudgetLabel } from "@/lib/queries/budgets";
import { MONTH_NAMES } from "@/lib/dates";

type Props = {
  accountId: string;
  initialBudgets: BudgetWithDetails[];
  formOptions: BudgetFormOptions;
};

export function BudgetsManager({ accountId, initialBudgets, formOptions }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [budgets, setBudgets] = useState(initialBudgets);
  const [isPending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(false);
  const [editBudget, setEditBudget] = useState<BudgetWithDetails | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<BudgetWithDetails | null>(null);

  async function refresh() {
    const result = await listBudgetsAction(accountId, {});
    if (result.ok) setBudgets(result.data);
  }

  function openCreate() {
    setEditBudget(undefined);
    setFormOpen(true);
  }

  function openEdit(budget: BudgetWithDetails) {
    setEditBudget(budget);
    setFormOpen(true);
  }

  function handleFormSuccess() {
    setFormOpen(false);
    setEditBudget(undefined);
    refresh();
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    startTransition(async () => {
      const result = await deleteBudgetAction(accountId, { budgetId: id });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      enqueueSnackbar(m.budgets.deleted, { variant: "success" });
      refresh();
    });
  }

  return (
    <PageSettingsContainer
      title={m.budgets.title}
      secondary={
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreate}>
          {m.budgets.createButton}
        </Button>
      }
    >
      {budgets.length === 0 ? (
        <EmptyState
          title={m.budgets.noMetas}
          description={m.budgets.noMetasHint}
          action={
            <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={openCreate}>
              {m.budgets.createButton}
            </Button>
          }
          size="compact"
        />
      ) : (
        <Stack spacing={1}>
          {budgets.map((budget) => (
            <BudgetCard
              key={budget.id}
              budget={budget}
              onEdit={() => openEdit(budget)}
              onDelete={() => setDeleteTarget(budget)}
            />
          ))}
        </Stack>
      )}

      <BudgetFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditBudget(undefined); }}
        accountId={accountId}
        formOptions={formOptions}
        budget={editBudget}
        onSuccess={handleFormSuccess}
      />

      <DialogShell
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        maxWidth="xs"
        title={m.budgets.deleteTitle}
        description={m.budgets.deleteConfirm}
        loading={isPending}
        actions={
          <>
            <Button size="small" onClick={() => setDeleteTarget(null)}>{m.common.cancel}</Button>
            <Button size="small" color="error" variant="contained" onClick={handleDelete}>
              {m.common.delete}
            </Button>
          </>
        }
      />
    </PageSettingsContainer>
  );
}

function BudgetCard({
  budget,
  onEdit,
  onDelete,
}: {
  budget: BudgetWithDetails;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const label = getBudgetLabel(budget);
  const amount = formatCentsToBrl(BigInt(budget.amountCents));

  const periodLabel = budget.isRecurring
    ? "Recorrente"
    : `${MONTH_NAMES[(budget.month ?? 1) - 1]}/${budget.year}`;

  return (
    <Paper variant="outlined" sx={{ px: 2, py: 1.5 }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap" sx={{ mb: 0.5 }}>
            <Typography variant="body2" fontWeight={500} noWrap>
              {label}
            </Typography>
            {budget.showInSummary && (
              <Tooltip title="Aparece no resumo do mês">
                <BookmarkIcon sx={{ fontSize: 12, color: "text.tertiary" }} />
              </Tooltip>
            )}
          </Stack>

          <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
            <Typography
              variant="body2"
              sx={{ fontFamily: "var(--font-jetbrains-mono), monospace", color: "accent.primary" }}
            >
              {amount}
            </Typography>
            <Chip
              size="small"
              label={`alertar em ${budget.alertThresholdPercent}%`}
              sx={{ height: 18, fontSize: "0.62rem", "& .MuiChip-label": { px: 0.75 } }}
            />
            <Stack direction="row" alignItems="center" gap={0.25}>
              <RepeatIcon sx={{ fontSize: 12, color: "text.tertiary" }} />
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                {periodLabel}
              </Typography>
            </Stack>
          </Stack>

          <DimChips budget={budget} />
        </Box>

        <Stack direction="row" gap={0.25} sx={{ flexShrink: 0 }}>
          <Tooltip title={m.common.edit}>
            <IconButton size="small" onClick={onEdit}>
              <EditIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title={m.common.delete}>
            <IconButton size="small" color="error" onClick={onDelete}>
              <DeleteIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
    </Paper>
  );
}

function DimChips({ budget }: { budget: BudgetWithDetails }) {
  const dims: string[] = [];
  if (budget.section) dims.push(`Seção: ${budget.section.name}`);
  if (budget.category) dims.push(`Categoria: ${budget.category.name}`);
  if (budget.member) dims.push(`Membro: ${budget.member.name ?? "?"}`);
  if (budget.institution) dims.push(`Instituição: ${budget.institution.name}`);
  if (budget.tableType) dims.push(`Tipo: ${budget.tableType.name}`);

  if (dims.length === 0) return null;

  return (
    <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 0.75 }}>
      {dims.map((d) => (
        <Chip
          key={d}
          label={d}
          size="small"
          variant="outlined"
          sx={{ height: 18, fontSize: "0.62rem", "& .MuiChip-label": { px: 0.75 } }}
        />
      ))}
    </Stack>
  );
}
