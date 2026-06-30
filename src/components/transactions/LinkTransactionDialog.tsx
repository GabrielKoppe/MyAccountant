"use client";

import { useEffect, useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormLabel from "@mui/material/FormLabel";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import SearchIcon from "@mui/icons-material/Search";
import { useSnackbar } from "notistack";

import { DialogShell } from "@/components/ui/DialogShell";
import { formatCentsToBrl } from "@/lib/money";
import { formatDateBr } from "@/lib/dates";
import { m } from "@/lib/messages";
import {
  createTransactionLinkAction,
  getMonthsForLinkAction,
  getSectionsTablesForLinkAction,
  searchTransactionsForLinkAction,
} from "@/actions/transaction-links";
import { TransactionLinkType } from "@/lib/schemas/transaction-link";
import type {
  LinkNavMonth,
  LinkNavSection,
  LinkedTransactionResult,
} from "@/server/services/transaction-link-service";

type Props = {
  open: boolean;
  onClose: () => void;
  accountId: string;
  transactionId: string;
  onLinked: () => void;
};

export function LinkTransactionDialog({
  open,
  onClose,
  accountId,
  transactionId,
  onLinked,
}: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [, startTransition] = useTransition();

  // Navigation state
  const [months, setMonths] = useState<LinkNavMonth[]>([]);
  const [selectedMonthId, setSelectedMonthId] = useState("");
  const [sections, setSections] = useState<LinkNavSection[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedTableId, setSelectedTableId] = useState("");
  const [loadingNav, setLoadingNav] = useState(false);

  // Transactions state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LinkedTransactionResult[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Link creation state
  const [linkType, setLinkType] = useState<TransactionLinkType>(TransactionLinkType.relates_to);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Load months on open
  useEffect(() => {
    if (!open) return;
    setLoadingNav(true);
    startTransition(async () => {
      const res = await getMonthsForLinkAction(accountId, {});
      setLoadingNav(false);
      if (res.ok) setMonths(res.data);
    });
  }, [open, accountId]);

  // Load sections/tables when month changes
  useEffect(() => {
    if (!selectedMonthId) {
      setSections([]);
      setSelectedSectionId("");
      setSelectedTableId("");
      return;
    }
    startTransition(async () => {
      const res = await getSectionsTablesForLinkAction(accountId, { monthId: selectedMonthId });
      if (res.ok) {
        setSections(res.data);
        setSelectedSectionId("");
        setSelectedTableId("");
      }
    });
  }, [selectedMonthId, accountId]);

  // Reset table when section changes
  useEffect(() => {
    setSelectedTableId("");
    setResults([]);
    setSelectedId(null);
  }, [selectedSectionId]);

  // Load transactions when table is selected or query changes
  useEffect(() => {
    if (!selectedTableId) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setLoadingTx(true);
      startTransition(async () => {
        const res = await searchTransactionsForLinkAction(accountId, {
          query,
          excludeTransactionId: transactionId,
          tableId: selectedTableId,
        });
        setLoadingTx(false);
        if (res.ok) setResults(res.data);
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [selectedTableId, query, accountId, transactionId]);

  // Reset everything on open
  useEffect(() => {
    if (open) {
      setSelectedMonthId("");
      setSections([]);
      setSelectedSectionId("");
      setSelectedTableId("");
      setQuery("");
      setResults([]);
      setSelectedId(null);
      setLinkType(TransactionLinkType.relates_to);
      setNotes("");
    }
  }, [open]);

  async function handleConfirm() {
    if (!selectedId) return;
    setSaving(true);
    const res = await createTransactionLinkAction(accountId, {
      sourceId: transactionId,
      targetId: selectedId,
      type: linkType,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (!res.ok) {
      enqueueSnackbar(res.error.message, { variant: "error" });
      return;
    }
    enqueueSnackbar("Transações vinculadas.", { variant: "success" });
    onLinked();
    onClose();
  }

  const tablesForSection = sections.find((s) => s.id === selectedSectionId)?.tables ?? [];

  return (
    <DialogShell
      open={open}
      onClose={onClose}
      title={m.transactions.links.addLink}
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
            {m.transactions.links.confirm}
          </Button>
        </>
      }
    >
      <Stack spacing={2}>
        {/* Step 1: Cascading selects — Mês / Seção / Tabela */}
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1.5 }}>
          <FormControl size="small" fullWidth>
            <InputLabel>Mês</InputLabel>
            <Select
              label="Mês"
              value={selectedMonthId}
              onChange={(e) => setSelectedMonthId(e.target.value)}
              disabled={loadingNav}
              endAdornment={loadingNav ? <CircularProgress size={14} sx={{ mr: 2 }} /> : null}
            >
              {months.map((mo) => (
                <MenuItem key={mo.id} value={mo.id} sx={{ fontSize: 13 }}>
                  {mo.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth disabled={!selectedMonthId || sections.length === 0}>
            <InputLabel>Seção</InputLabel>
            <Select
              label="Seção"
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
            >
              {sections.map((s) => (
                <MenuItem key={s.id} value={s.id} sx={{ fontSize: 13 }}>
                  {s.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl
            size="small"
            fullWidth
            disabled={!selectedSectionId || tablesForSection.length === 0}
          >
            <InputLabel>Tabela</InputLabel>
            <Select
              label="Tabela"
              value={selectedTableId}
              onChange={(e) => setSelectedTableId(e.target.value)}
            >
              {tablesForSection.map((t) => (
                <MenuItem key={t.id} value={t.id} sx={{ fontSize: 13 }}>
                  {t.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Step 2: Transaction list (shown after table selected) */}
        {selectedTableId && (
          <>
            <TextField
              size="small"
              fullWidth
              placeholder={m.transactions.links.searchPlaceholder}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedId(null);
              }}
              InputProps={{
                startAdornment: (
                  <SearchIcon sx={{ fontSize: 16, color: "text.disabled", mr: 0.5 }} />
                ),
                endAdornment: loadingTx ? <CircularProgress size={14} /> : null,
              }}
            />

            <Box
              sx={{
                maxHeight: 200,
                overflowY: "auto",
                border: 1,
                borderColor: "divider",
                borderRadius: 1,
              }}
            >
              {results.length === 0 && !loadingTx ? (
                <Typography
                  variant="body2"
                  color="text.disabled"
                  sx={{ p: 2, textAlign: "center" }}
                >
                  {m.transactions.links.noResults}
                </Typography>
              ) : (
                <RadioGroup
                  value={selectedId ?? ""}
                  onChange={(e) => setSelectedId(e.target.value)}
                >
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
                                sx={{
                                  fontFamily: "var(--font-jetbrains-mono), monospace",
                                }}
                              >
                                {formatCentsToBrl(BigInt(r.amountCents))}
                              </Typography>
                            </Typography>
                          </Box>
                        }
                        sx={{
                          m: 0,
                          width: "100%",
                          "&:hover": { bgcolor: "action.hover" },
                        }}
                      />
                    </Box>
                  ))}
                </RadioGroup>
              )}
            </Box>
          </>
        )}

        {/* Step 3: Type + notes (shown after transaction selected) */}
        {selectedId && (
          <>
            <Divider />
            <FormControl>
              <FormLabel sx={{ fontSize: 13, mb: 0.5 }}>
                {m.transactions.links.selectType}
              </FormLabel>
              <RadioGroup
                value={linkType}
                onChange={(e) => setLinkType(e.target.value as TransactionLinkType)}
              >
                {(Object.values(TransactionLinkType) as TransactionLinkType[]).map((type) => (
                  <FormControlLabel
                    key={type}
                    value={type}
                    control={<Radio size="small" />}
                    label={
                      <Box>
                        <Typography variant="body2">{m.transactions.links.types[type]}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {m.transactions.links.typeHint[type]}
                        </Typography>
                      </Box>
                    }
                  />
                ))}
              </RadioGroup>
            </FormControl>

            <TextField
              size="small"
              label={m.transactions.links.notesLabel}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              inputProps={{ maxLength: 500 }}
              fullWidth
            />
          </>
        )}
      </Stack>
    </DialogShell>
  );
}
