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

import { createMonthAction } from "@/actions/months";
import { AutoApplyResultSnackbar } from "@/components/ui/AutoApplyResultSnackbar";
import { DialogShell } from "@/components/ui/DialogShell";
import { MONTH_NAMES, getNextMonthSuggestion } from "@/lib/dates";
import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";

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

  function openModal() {
    const s = lastMonth ? getNextMonthSuggestion(lastMonth) : suggestion;
    setYear(s.year);
    setMonth(s.month);
    setError("");
    setOpen(true);
  }

  async function handleCreate() {
    setError("");
    setLoading(true);
    const result = await createMonthAction(accountId, { year, month });
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
        maxWidth="xs"
        title={m.months.createTitle}
        loading={loading}
        actions={
          <>
            <Button onClick={() => setOpen(false)}>{m.common.cancel}</Button>
            <Button
              variant="contained"
              onClick={handleCreate}
              endIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {m.common.create}
            </Button>
          </>
        }
      >
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
      </DialogShell>
    </>
  );
}
