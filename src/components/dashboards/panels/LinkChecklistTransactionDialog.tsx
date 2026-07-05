"use client";

import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import SearchIcon from "@mui/icons-material/Search";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import { useEffect, useState, useTransition } from "react";

import {
  linkChecklistTransactionAction,
  searchChecklistTransactionsAction,
} from "@/actions/checklist";
import { DialogShell } from "@/components/ui/DialogShell";
import { formatDateBr } from "@/lib/dates";
import { m } from "@/lib/messages";
import { formatCentsToBrl } from "@/lib/money";
import type { ChecklistTxSearchResult } from "@/server/services/checklist-service";

type Props = {
  open: boolean;
  onClose: () => void;
  accountId: string;
  monthId: string;
  itemId: string;
  itemLabel: string;
  onLinked: () => void;
};

export function LinkChecklistTransactionDialog({
  open,
  onClose,
  accountId,
  monthId,
  itemId,
  itemLabel,
  onLinked,
}: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const cw = m.dashboards.checklistWidget;
  const [, startTransition] = useTransition();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ChecklistTxSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset ao abrir.
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setSelectedId(null);
    }
  }, [open]);

  // Busca (debounced) das transações do mês.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      setLoading(true);
      startTransition(async () => {
        const res = await searchChecklistTransactionsAction(accountId, { monthId, query });
        setLoading(false);
        if (res.ok) setResults(res.data);
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [open, query, accountId, monthId]);

  async function handleConfirm() {
    if (!selectedId) return;
    setSaving(true);
    const res = await linkChecklistTransactionAction(accountId, {
      itemId,
      monthId,
      transactionId: selectedId,
    });
    setSaving(false);
    if (!res.ok) {
      enqueueSnackbar(res.error.message || cw.linkError, { variant: "error" });
      return;
    }
    enqueueSnackbar(cw.linked, { variant: "success" });
    onLinked();
    onClose();
  }

  return (
    <DialogShell
      open={open}
      onClose={onClose}
      title={cw.linkDialogTitle}
      description={itemLabel}
      maxWidth="sm"
      actions={
        <>
          <Button variant="text" onClick={onClose} disabled={saving}>
            {m.common.cancel}
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirm}
            disabled={!selectedId || saving}
            startIcon={
              saving ? <CircularProgress size={14} color="inherit" /> : <LinkOutlinedIcon />
            }
          >
            {cw.linkConfirm}
          </Button>
        </>
      }
    >
      <Stack spacing={1.5}>
        <TextField
          size="small"
          fullWidth
          autoFocus
          placeholder={cw.linkSearchPlaceholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedId(null);
          }}
          InputProps={{
            startAdornment: <SearchIcon sx={{ fontSize: 16, color: "text.disabled", mr: 0.5 }} />,
            endAdornment: loading ? <CircularProgress size={14} /> : null,
          }}
        />

        <Box
          sx={{
            maxHeight: 240,
            overflowY: "auto",
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
          }}
        >
          {results.length === 0 && !loading ? (
            <Typography variant="body2" color="text.disabled" sx={{ p: 2, textAlign: "center" }}>
              {cw.linkNoResults}
            </Typography>
          ) : (
            <RadioGroup value={selectedId ?? ""} onChange={(e) => setSelectedId(e.target.value)}>
              {results.map((r, i) => (
                <Box key={r.id}>
                  {i > 0 && <Divider />}
                  <FormControlLabel
                    value={r.id}
                    control={<Radio size="small" sx={{ ml: 1 }} />}
                    label={
                      <Box sx={{ py: 0.5 }}>
                        <Typography
                          variant="body2"
                          fontWeight={selectedId === r.id ? 600 : 400}
                          noWrap
                        >
                          {r.description ?? "—"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatDateBr(r.occurredOn)} ·{" "}
                          <Typography
                            component="span"
                            variant="caption"
                            sx={{ fontFamily: "var(--font-jetbrains-mono), monospace" }}
                          >
                            {formatCentsToBrl(BigInt(r.amountCents))}
                          </Typography>
                        </Typography>
                      </Box>
                    }
                    sx={{ m: 0, width: "100%", "&:hover": { bgcolor: "action.hover" } }}
                  />
                </Box>
              ))}
            </RadioGroup>
          )}
        </Box>

        <Typography variant="caption" color="text.tertiary">
          {cw.linkHint}
        </Typography>
      </Stack>
    </DialogShell>
  );
}
