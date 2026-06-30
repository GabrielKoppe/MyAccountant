"use client";

import { useEffect, useState, useTransition } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import { useSnackbar } from "notistack";

import {
  settleInstallmentGroupAction,
  listTablesForSettlementAction,
} from "@/actions/installments";
import { formatCentsToBrl } from "@/lib/money";
import { m } from "@/lib/messages";
import { layout } from "@/lib/design-tokens";
import { DialogShell } from "@/components/ui/DialogShell";

type DestData = {
  months: { id: string; year: number; month: number; label: string }[];
  sections: { id: string; name: string }[];
  tables: { id: string; name: string; monthId: string; sectionId: string }[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSettled: () => void;
  accountId: string;
  /** Mês atual — usado para pré-selecionar o mês no seletor */
  monthId: string;
  installmentGroupId: string;
  pendingCount: number;
  /** Valores das parcelas pendentes em ordem de installmentNumber (BigInt serializados) */
  pendingAmounts: string[];
};

export function SettleInstallmentDialog({
  open,
  onClose,
  onSettled,
  accountId,
  monthId,
  installmentGroupId,
  pendingCount,
  pendingAmounts,
}: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [, startTransition] = useTransition();
  const [destData, setDestData] = useState<DestData | null>(null);
  const [loading, setLoading] = useState(false);
  // Sempre inicializados como "" — nunca undefined (evita uncontrolled→controlled)
  const [selectedMonthId, setSelectedMonthId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedTableId, setSelectedTableId] = useState("");
  const [count, setCount] = useState(pendingCount);
  const [mode, setMode] = useState<"individual" | "consolidated">("individual");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Carregar dados uma única vez ao abrir
  useEffect(() => {
    if (!open || destData) return;
    setLoading(true);
    listTablesForSettlementAction(accountId).then((data) => {
      setDestData(data);
      setLoading(false);
    });
  }, [open, accountId, destData]);

  // Resetar seleção ao (re)abrir e pré-selecionar o mês atual
  useEffect(() => {
    if (open) {
      setSelectedMonthId(monthId ?? "");
      setSelectedSectionId("");
      setSelectedTableId("");
      setCount(pendingCount);
      setError("");
    }
  }, [open, monthId, pendingCount]);

  function handleMonthChange(id: string) {
    setSelectedMonthId(id);
    setSelectedSectionId("");
    setSelectedTableId("");
  }

  function handleSectionChange(id: string) {
    setSelectedSectionId(id);
    setSelectedTableId("");
  }

  // Seções que têm ao menos uma tabela no mês selecionado
  const availableSections = destData
    ? destData.sections.filter((s) =>
        destData.tables.some((t) => t.monthId === selectedMonthId && t.sectionId === s.id),
      )
    : [];

  // Tabelas do mês + seção selecionados
  const availableTables = destData
    ? destData.tables.filter(
        (t) => t.monthId === selectedMonthId && t.sectionId === selectedSectionId,
      )
    : [];

  const canSubmit = !!selectedMonthId && !!selectedSectionId && !!selectedTableId;

  // Valor das parcelas selecionadas (primeiras `count` ordenadas por número)
  const selectedAmountCents = pendingAmounts
    .slice(0, count)
    .reduce((sum, a) => sum + BigInt(a), 0n);
  const selectedAmountFormatted = formatCentsToBrl(selectedAmountCents);
  // Valor que SOBRA após quitar as `count` parcelas selecionadas — recalcula a cada mudança
  const totalAmountFormatted = formatCentsToBrl(
    pendingAmounts.slice(count).reduce((sum, a) => sum + BigInt(a), 0n),
  );
  const isPartial = count < pendingCount;

  function handleClose() {
    if (submitting) return;
    onClose();
  }

  async function handleConfirm() {
    if (!canSubmit) {
      setError("Selecione mês, seção e tabela de destino.");
      return;
    }
    setError("");
    setSubmitting(true);

    startTransition(async () => {
      const result = await settleInstallmentGroupAction(accountId, {
        installmentGroupId,
        mode,
        tableId: selectedTableId,
        count,
      });
      setSubmitting(false);

      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      const msg =
        mode === "individual"
          ? m.transactions.installments.settleSuccessIndividual(result.data.settledCount)
          : m.transactions.installments.settleSuccessConsolidated;
      enqueueSnackbar(msg, { variant: "success" });
      onSettled();
    });
  }

  return (
    <DialogShell
      open={open}
      onClose={handleClose}
      title={m.transactions.installments.settleTitle}
      maxWidth="sm"
      loading={submitting}
      actions={
        <>
          <Button onClick={handleClose} disabled={submitting}>
            {m.common.cancel}
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleConfirm}
            disabled={submitting || loading || !canSubmit}
          >
            {submitting ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              m.transactions.installments.settleConfirmButton
            )}
          </Button>
        </>
      }
    >
      <Stack spacing={layout.stack}>
        {error && <Alert severity="error">{error}</Alert>}

        {/* Resumo + seletor de quantidade */}
        <Box sx={{ p: 1.5, bgcolor: "background.subtle", borderRadius: 1 }}>
          <Stack spacing={1.5}>
            {/* Contador */}
            <Box>
              <Typography variant="body2" fontWeight={500} mb={2}>
                Parcelas a quitar
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
                <IconButton
                  size="small"
                  onClick={() => setCount((c) => Math.max(1, c - 1))}
                  disabled={count <= 1}
                  sx={{ border: 1, borderColor: "divider" }}
                >
                  <RemoveIcon sx={{ fontSize: 14 }} />
                </IconButton>
                <Typography
                  variant="h6"
                  fontWeight={700}
                  sx={{ minWidth: 28, textAlign: "center" }}
                >
                  {count}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => setCount((c) => Math.min(pendingCount, c + 1))}
                  disabled={count >= pendingCount}
                  sx={{ border: 1, borderColor: "divider" }}
                >
                  <AddIcon sx={{ fontSize: 14 }} />
                </IconButton>
                <Typography variant="body2" color="text.secondary">
                  de {pendingCount} parcela{pendingCount !== 1 ? "s" : ""} restante
                  {pendingCount !== 1 ? "s" : ""}
                </Typography>
              </Box>
            </Box>
            {/* Valores */}
            <Box sx={{ display: "flex", gap: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Valor selecionado
                </Typography>
                <Typography variant="body1" fontWeight={600} color="error.main">
                  {selectedAmountFormatted}
                </Typography>
              </Box>
              {isPartial && (
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Ficará pendente
                  </Typography>
                  <Typography variant="body1" color="text.disabled">
                    {totalAmountFormatted}
                  </Typography>
                </Box>
              )}
            </Box>
          </Stack>
        </Box>

        <Divider />

        {/* Seletor cascata: Mês → Seção → Tabela */}
        {loading ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">
              Carregando tabelas…
            </Typography>
          </Box>
        ) : (
          <Stack spacing={1.5}>
            <Typography variant="body2" fontWeight={500}>
              {m.transactions.installments.settleTargetTableLabel}
            </Typography>

            {/* Mês */}
            <FormControl fullWidth size="small">
              <InputLabel size="small">Mês</InputLabel>
              <Select
                value={selectedMonthId}
                label="Mês"
                onChange={(e) => handleMonthChange(e.target.value)}
                size="small"
              >
                {destData?.months.map((mo) => (
                  <MenuItem key={mo.id} value={mo.id}>
                    {mo.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Seção */}
            <FormControl fullWidth size="small" disabled={!selectedMonthId}>
              <InputLabel size="small">Seção</InputLabel>
              <Select
                value={selectedSectionId}
                label="Seção"
                onChange={(e) => handleSectionChange(e.target.value)}
                size="small"
                displayEmpty
              >
                {availableSections.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Tabela */}
            <FormControl fullWidth size="small" disabled={!selectedSectionId}>
              <InputLabel size="small">Tabela</InputLabel>
              <Select
                value={selectedTableId}
                label="Tabela"
                onChange={(e) => setSelectedTableId(e.target.value)}
                size="small"
                displayEmpty
              >
                {availableTables.map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        )}

        <Divider />

        {/* Modo */}
        <Box>
          <Typography variant="body2" fontWeight={500} sx={{ mb: 0.5 }}>
            {m.transactions.installments.settleModeLabel}
          </Typography>
          <RadioGroup
            value={mode}
            onChange={(e) => setMode(e.target.value as "individual" | "consolidated")}
          >
            <FormControlLabel
              value="individual"
              control={<Radio size="small" />}
              label={
                <Box>
                  <Typography variant="body2">
                    {m.transactions.installments.settleModeIndividual}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {m.transactions.installments.settleModeIndividualDesc}
                  </Typography>
                </Box>
              }
              sx={{ alignItems: "flex-start", mt: 0.5, "& .MuiRadio-root": { pt: 0.5 } }}
            />
            <FormControlLabel
              value="consolidated"
              control={<Radio size="small" />}
              label={
                <Box>
                  <Typography variant="body2">
                    {m.transactions.installments.settleModeConsolidated}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {m.transactions.installments.settleModeConsolidatedDesc(
                      selectedAmountFormatted,
                    )}
                  </Typography>
                </Box>
              }
              sx={{ alignItems: "flex-start", mt: 0.5, "& .MuiRadio-root": { pt: 0.5 } }}
            />
          </RadioGroup>
        </Box>
      </Stack>
    </DialogShell>
  );
}
