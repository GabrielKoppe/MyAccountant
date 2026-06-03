"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import AddIcon from "@mui/icons-material/Add";
import { useSnackbar } from "notistack";

import { createMonthAction } from "@/actions/months";
import { MONTH_NAMES, getNextMonthSuggestion } from "@/lib/dates";
import { m } from "@/lib/messages";

type Props = {
  accountId: string;
  lastMonth: { year: number; month: number } | null;
  variant?: "button" | "text";
};

export function CreateMonthModal({ accountId, lastMonth, variant = "button" }: Props) {
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

    enqueueSnackbar(m.months.created, { variant: "success" });
    setOpen(false);
    router.push(`/${accountId}/months/${result.data.monthId}`);
  }

  return (
    <>
      {variant === "button" ? (
        <Button variant="contained" startIcon={<AddIcon />} onClick={openModal} size="small">
          {m.months.newMonth}
        </Button>
      ) : (
        <Button variant="outlined" startIcon={<AddIcon />} onClick={openModal}>
          {m.months.createFirst}
        </Button>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{m.months.createTitle}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", gap: 2, pt: 1 }}>
            <FormControl sx={{ flex: 1 }}>
              <InputLabel>{m.months.monthLabel}</InputLabel>
              <Select
                value={month}
                label={m.months.monthLabel}
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
          </Box>
          {error && (
            <Box sx={{ mt: 1, color: "error.main", typography: "body2" }}>{error}</Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)}>{m.common.cancel}</Button>
          <Button variant="contained" onClick={handleCreate} disabled={loading}>
            {loading ? m.months.creating : m.common.create}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
