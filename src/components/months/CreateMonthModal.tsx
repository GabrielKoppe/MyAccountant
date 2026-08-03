"use client";

import AddIcon from "@mui/icons-material/Add";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { useRouter } from "next/navigation";
import { useSnackbar } from "notistack";
import { useState, type ReactNode } from "react";

import { createMonthAction, previewMonthAutomationsAction } from "@/actions/months";
import { MonthAutomationsStep } from "@/components/months/MonthAutomationsStep";
import { AutoApplyResultSnackbar } from "@/components/ui/AutoApplyResultSnackbar";
import { DialogShell } from "@/components/ui/DialogShell";
import { MONTH_NAMES, getNextMonthSuggestion } from "@/lib/dates";
import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import type { MonthAutomationGroup } from "@/server/services/month-service";

type Props = {
  accountId: string;
  lastMonth: { year: number; month: number } | null;
  variant?: "button" | "text";
  /** Trigger customizado (recebe `open`); quando presente, ignora `variant`. Ex.: botão da AppSidebar. */
  renderTrigger?: (open: () => void) => ReactNode;
};

export function CreateMonthModal({ accountId, lastMonth, variant = "button", renderTrigger }: Props) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const suggestion = lastMonth
    ? getNextMonthSuggestion(lastMonth)
    : { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };

  const [year, setYear] = useState(suggestion.year);
  const [month, setMonth] = useState(suggestion.month);
  // Passo "Automações" (spec 73 §2.4): só existe quando há algo a automatizar.
  const [step, setStep] = useState<"month" | "automations">("month");
  const [automations, setAutomations] = useState<MonthAutomationGroup[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function openModal() {
    const s = lastMonth ? getNextMonthSuggestion(lastMonth) : suggestion;
    setYear(s.year);
    setMonth(s.month);
    setError("");
    setStep("month");
    setAutomations([]);
    setSelectedIds(new Set());
    setOpen(true);
  }

  /**
   * Passo 1 → 2. Consulta o dry-run; sem automações, cria direto (o passo extra
   * só apareceria vazio). Falha no preview não bloqueia: cria com os padrões.
   */
  async function handleContinue() {
    setError("");
    setLoading(true);
    const result = await previewMonthAutomationsAction(accountId, { year, month });
    setLoading(false);

    if (!result.ok) {
      enqueueSnackbar(m.months.automations.loadError, { variant: "warning" });
      await handleCreate();
      return;
    }

    const groups = result.data;
    if (groups.length === 0) {
      await handleCreate();
      return;
    }

    setAutomations(groups);
    setSelectedIds(
      new Set(
        groups.flatMap((g) =>
          g.items.filter((i) => i.defaultSelected && !i.blockedReason).map((i) => i.id),
        ),
      ),
    );
    setStep("automations");
  }

  function idsOfKind(kind: MonthAutomationGroup["kind"]): string[] {
    return (automations.find((g) => g.kind === kind)?.items ?? [])
      .filter((i) => selectedIds.has(i.id))
      .map((i) => i.id);
  }

  function toggleItem(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleGroup(kind: MonthAutomationGroup["kind"], selectAll: boolean) {
    const ids = (automations.find((g) => g.kind === kind)?.items ?? [])
      .filter((i) => !i.blockedReason)
      .map((i) => i.id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (selectAll) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  async function handleCreate() {
    setError("");
    setLoading(true);
    // `selection` só vai quando o passo 2 foi exibido: ausente = padrões do
    // servidor (todos os modelos autoApply + parcelas com auto-criação ligada).
    const selection =
      step === "automations"
        ? {
            templateIds: idsOfKind("table_template"),
            pendingInstallmentIds: idsOfKind("pending_installment"),
          }
        : undefined;
    const result = await createMonthAction(accountId, { year, month, selection });
    setLoading(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    setOpen(false);

    const { autoApplied, installmentsConverted } = result.data;

    const hasTemplates = autoApplied.length > 0;
    const hasInstallments =
      installmentsConverted.converted > 0 || installmentsConverted.failed.length > 0;

    if (hasTemplates || hasInstallments) {
      const templateSuccessCount = autoApplied.filter((r) => r.success).length;
      const templateFailCount = autoApplied.length - templateSuccessCount;
      const hasAnyFailure = templateFailCount > 0 || installmentsConverted.failed.length > 0;

      // Compor mensagem unificada
      const parts: string[] = [];
      if (hasTemplates) {
        parts.push(
          templateFailCount > 0
            ? m.months.autoAppliedPartial(templateSuccessCount, autoApplied.length)
            : m.months.autoAppliedAll(templateSuccessCount),
        );
      }
      if (hasInstallments) {
        parts.push(
          m.transactions.installments.convertedOnMonthCreate(installmentsConverted.converted),
        );
      }
      const message = parts.join(" · ");

      enqueueSnackbar(message, {
        persist: hasAnyFailure,
        autoHideDuration: hasAnyFailure ? undefined : 6000,
        content: (key) => (
          <AutoApplyResultSnackbar
            snackbarKey={key}
            message={message}
            results={autoApplied}
            installmentsConverted={hasInstallments ? installmentsConverted : undefined}
          />
        ),
      });
    } else {
      enqueueSnackbar(m.months.created, { variant: "success" });
    }

    router.push(`/${accountId}/months/${result.data.monthId}`);
  }

  return (
    <>
      {renderTrigger ? (
        renderTrigger(openModal)
      ) : variant === "button" ? (
        <Button variant="contained" startIcon={<AddIcon />} onClick={openModal} size="small">
          {m.months.newMonth}
        </Button>
      ) : (
        <Button variant="outlined" startIcon={<AddIcon />} onClick={openModal}>
          {m.months.createFirst}
        </Button>
      )}

      <DialogShell
        open={open}
        onClose={() => setOpen(false)}
        maxWidth={step === "automations" ? "sm" : "xs"}
        title={
          step === "automations"
            ? m.months.automations.title(`${MONTH_NAMES[month - 1]} ${year}`)
            : m.months.createTitle
        }
        loading={loading}
        actions={
          step === "automations" ? (
            <>
              <Button onClick={() => setStep("month")} disabled={loading}>
                {m.months.automations.back}
              </Button>
              <Button
                variant="contained"
                onClick={handleCreate}
                disabled={loading}
                endIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
              >
                {m.months.automations.create}
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => setOpen(false)}>{m.common.cancel}</Button>
              <Button
                variant="contained"
                onClick={handleContinue}
                disabled={loading}
                endIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
              >
                {m.common.create}
              </Button>
            </>
          )
        }
      >
        {step === "automations" ? (
          <Stack spacing={layout.inline} sx={{ mt: layout.micro }}>
            <MonthAutomationsStep
              groups={automations}
              selectedIds={selectedIds}
              onToggle={toggleItem}
              onToggleGroup={toggleGroup}
              disabled={loading}
            />
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        ) : (
          <Stack spacing={layout.inline} sx={{ mt: layout.micro }}>
            <Stack direction="row" spacing={layout.inline}>
              <FormControl sx={{ flex: 1 }}>
                <InputLabel>{m.months.monthLabel}</InputLabel>
                <Select
                  value={month}
                  label={m.months.monthLabel}
                  size="small"
                  onChange={(e) => setMonth(Number(e.target.value))}
                >
                  {MONTH_NAMES.map((name, idx) => (
                    <MenuItem key={idx + 1} value={idx + 1}>
                      {name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label={m.months.yearLabel}
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                inputProps={{ min: 2000, max: 2400 }}
                sx={{ width: 110 }}
              />
            </Stack>
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        )}
      </DialogShell>
    </>
  );
}
