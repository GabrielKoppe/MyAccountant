"use client";

import { useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";

import { createBudgetAction, updateBudgetAction } from "@/actions/budgets";
import { DialogShell } from "@/components/ui/DialogShell";
import { m } from "@/lib/messages";
import { parseBrlMaskToCents, formatCentsToBrl } from "@/lib/money";
import type { BudgetWithDetails, BudgetFormOptions } from "@/lib/queries/budgets";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

type Props = {
  open: boolean;
  onClose: () => void;
  accountId: string;
  formOptions: BudgetFormOptions;
  budget?: BudgetWithDetails;
  onSuccess: (budgetId: string) => void;
};

type FormState = {
  name: string;
  sectionId: string;
  categoryId: string;
  memberUserId: string;
  institutionId: string;
  tableTypeId: string;
  amountBrl: string;
  alertThresholdPercent: string;
  isRecurring: boolean;
  showInSummary: boolean;
  year: string;
  month: string;
};

function initForm(budget?: BudgetWithDetails): FormState {
  if (!budget) {
    return {
      name: "",
      sectionId: "",
      categoryId: "",
      memberUserId: "",
      institutionId: "",
      tableTypeId: "",
      amountBrl: "",
      alertThresholdPercent: "80",
      isRecurring: true,
      showInSummary: false,
      year: "",
      month: "",
    };
  }
  return {
    name: budget.name ?? "",
    sectionId: budget.sectionId ?? "",
    categoryId: budget.categoryId ?? "",
    memberUserId: budget.memberUserId ?? "",
    institutionId: budget.institutionId ?? "",
    tableTypeId: budget.tableTypeId ?? "",
    amountBrl: formatCentsToBrl(BigInt(budget.amountCents)).replace("R$ ", "").replace("R$ ", ""),
    alertThresholdPercent: budget.alertThresholdPercent.toString(),
    isRecurring: budget.isRecurring,
    showInSummary: budget.showInSummary,
    year: budget.year?.toString() ?? "",
    month: budget.month?.toString() ?? "",
  };
}

export function BudgetFormDialog({ open, onClose, accountId, formOptions, budget, onSuccess }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>(() => initForm(budget));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEditing = !!budget;

  function set(field: keyof FormState, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  }

  function validate(): boolean {
    const next: Record<string, string> = {};

    const hasDimension =
      form.sectionId || form.categoryId || form.memberUserId || form.institutionId || form.tableTypeId;
    if (!hasDimension) {
      next.sectionId = "Selecione pelo menos uma dimensão";
    }
    if (form.sectionId && form.categoryId) {
      next.categoryId = "Seção e categoria não podem ser combinadas";
    }
    if (form.sectionId && form.tableTypeId) {
      next.tableTypeId = "Seção e tipo de tabela não podem ser combinados";
    }

    const cents = parseBrlMaskToCents(form.amountBrl);
    if (cents <= 0n) next.amountBrl = "Valor deve ser positivo";

    const threshold = parseInt(form.alertThresholdPercent, 10);
    if (isNaN(threshold) || threshold < 1 || threshold > 99) {
      next.alertThresholdPercent = "Informe um valor entre 1 e 99";
    }

    if (!form.isRecurring) {
      if (!form.year || !form.month) next.year = "Informe o mês e ano";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;

    const cents = parseBrlMaskToCents(form.amountBrl);
    const threshold = parseInt(form.alertThresholdPercent, 10);

    const payload = {
      name: form.name.trim() || null,
      sectionId: form.sectionId || undefined,
      categoryId: form.categoryId || undefined,
      memberUserId: form.memberUserId || undefined,
      institutionId: form.institutionId || undefined,
      tableTypeId: form.tableTypeId || undefined,
      amountCents: cents,
      alertThresholdPercent: threshold,
      isRecurring: form.isRecurring,
      showInSummary: form.showInSummary,
      year: !form.isRecurring && form.year ? parseInt(form.year, 10) : undefined,
      month: !form.isRecurring && form.month ? parseInt(form.month, 10) : undefined,
    };

    startTransition(async () => {
      const result = isEditing
        ? await updateBudgetAction(accountId, { ...payload, budgetId: budget!.id })
        : await createBudgetAction(accountId, payload);

      if (!result.ok) {
        if (result.error.fieldErrors) setErrors(result.error.fieldErrors);
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }

      enqueueSnackbar(isEditing ? m.budgets.updated : m.budgets.created, { variant: "success" });
      onSuccess(isEditing ? budget!.id : (result.data as { budgetId: string }).budgetId);
      onClose();
    });
  }

  function handleClose() {
    if (!isPending) {
      setForm(initForm(budget));
      setErrors({});
      onClose();
    }
  }

  return (
    <DialogShell
      open={open}
      onClose={handleClose}
      title={isEditing ? m.budgets.editTitle : m.budgets.createTitle}
      maxWidth="sm"
      loading={isPending}
      actions={
        <>
          <Button size="small" onClick={handleClose}>{m.common.cancel}</Button>
          <Button
            size="small"
            variant="contained"
            onClick={handleSubmit}
            endIcon={isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {m.common.save}
          </Button>
        </>
      }
    >
      <Stack spacing={2.5}>
        {/* ── Dimensões ── */}
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.65rem" }}>
            Dimensões
          </Typography>
          {errors.sectionId && (
            <Typography variant="caption" color="error" sx={{ mb: 1, display: "block" }}>
              {errors.sectionId}
            </Typography>
          )}
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
            <TextField
              select
              size="small"
              label={m.budgets.fields.section}
              value={form.sectionId}
              onChange={(e) => set("sectionId", e.target.value)}
              error={!!errors.sectionId}
            >
              <MenuItem value="">{m.budgets.fields.noDimension}</MenuItem>
              {formOptions.sections.map((s) => (
                <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
              ))}
            </TextField>

            <TextField
              select
              size="small"
              label={m.budgets.fields.category}
              value={form.categoryId}
              onChange={(e) => set("categoryId", e.target.value)}
              error={!!errors.categoryId}
              helperText={errors.categoryId}
            >
              <MenuItem value="">{m.budgets.fields.noDimension}</MenuItem>
              {formOptions.categories.map((c) => (
                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
              ))}
            </TextField>

            <TextField
              select
              size="small"
              label={m.budgets.fields.member}
              value={form.memberUserId}
              onChange={(e) => set("memberUserId", e.target.value)}
            >
              <MenuItem value="">{m.budgets.fields.noDimension}</MenuItem>
              {formOptions.members.map((mb) => (
                <MenuItem key={mb.id} value={mb.id}>{mb.name ?? mb.email}</MenuItem>
              ))}
            </TextField>

            <TextField
              select
              size="small"
              label={m.budgets.fields.institution}
              value={form.institutionId}
              onChange={(e) => set("institutionId", e.target.value)}
            >
              <MenuItem value="">{m.budgets.fields.noDimension}</MenuItem>
              {formOptions.institutions.map((i) => (
                <MenuItem key={i.id} value={i.id}>{i.name}</MenuItem>
              ))}
            </TextField>

            <TextField
              select
              size="small"
              label={m.budgets.fields.tableType}
              value={form.tableTypeId}
              onChange={(e) => set("tableTypeId", e.target.value)}
              error={!!errors.tableTypeId}
              helperText={errors.tableTypeId}
              sx={{ gridColumn: "span 2" }}
            >
              <MenuItem value="">{m.budgets.fields.noDimension}</MenuItem>
              {formOptions.tableTypes.map((t) => (
                <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
              ))}
            </TextField>
          </Box>
        </Box>

        <Divider />

        {/* ── Meta ── */}
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: "block", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.65rem" }}>
            Meta
          </Typography>
          <Stack spacing={1.5}>
            <TextField
              size="small"
              label={m.budgets.fields.amount}
              value={form.amountBrl}
              onChange={(e) => set("amountBrl", e.target.value)}
              error={!!errors.amountBrl}
              helperText={errors.amountBrl}
              InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }}
              placeholder="0,00"
              sx={{ "& input": { fontFamily: "var(--font-jetbrains-mono), monospace" } }}
            />

            <TextField
              size="small"
              label={m.budgets.fields.alertThreshold}
              value={form.alertThresholdPercent}
              onChange={(e) => set("alertThresholdPercent", e.target.value)}
              error={!!errors.alertThresholdPercent}
              helperText={errors.alertThresholdPercent || m.budgets.fields.alertThresholdHint}
              type="number"
              inputProps={{ min: 1, max: 99 }}
              InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
            />

            <TextField
              size="small"
              label={m.budgets.fields.name}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder={m.budgets.fields.namePlaceholder}
              inputProps={{ maxLength: 80 }}
            />
          </Stack>
        </Box>

        <Divider />

        {/* ── Quando ── */}
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.65rem" }}>
            Período
          </Typography>
          <FormControlLabel
            control={
              <Checkbox
                checked={form.isRecurring}
                onChange={(e) => set("isRecurring", e.target.checked)}
                size="small"
              />
            }
            label={
              <Typography variant="body2">{m.budgets.fields.isRecurring}</Typography>
            }
          />

          {!form.isRecurring && (
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5, mt: 1 }}>
              <TextField
                size="small"
                label={m.budgets.fields.year}
                value={form.year}
                onChange={(e) => set("year", e.target.value)}
                error={!!errors.year}
                helperText={errors.year}
                type="number"
                inputProps={{ min: 2000, max: 2100 }}
              />
              <TextField
                select
                size="small"
                label={m.budgets.fields.month}
                value={form.month}
                onChange={(e) => set("month", e.target.value)}
                error={!!errors.month}
              >
                <MenuItem value="">{m.budgets.fields.noDimension}</MenuItem>
                {MONTH_NAMES.map((name, i) => (
                  <MenuItem key={i + 1} value={String(i + 1)}>{name}</MenuItem>
                ))}
              </TextField>
            </Box>
          )}

          <FormControlLabel
            control={
              <Checkbox
                checked={form.showInSummary}
                onChange={(e) => set("showInSummary", e.target.checked)}
                size="small"
              />
            }
            label={
              <Typography variant="body2">{m.budgets.fields.showInSummary}</Typography>
            }
            sx={{ mt: 0.5 }}
          />
        </Box>
      </Stack>
    </DialogShell>
  );
}
