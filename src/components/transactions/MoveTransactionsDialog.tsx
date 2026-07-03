"use client";

import { useEffect, useState, useTransition } from "react";
import type { SectionCountType } from "@prisma/client";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormLabel from "@mui/material/FormLabel";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import DriveFileMoveIcon from "@mui/icons-material/DriveFileMove";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import { useSnackbar } from "notistack";

import { listTablesForMoveAction, moveTransactionsAction } from "@/actions/transactions";
import { m } from "@/lib/messages";
import { layout } from "@/lib/design-tokens";
import { DialogShell } from "@/components/ui/DialogShell";
import { displaySignInverts, formatCentsToBrl, moveInvertsConvention } from "@/lib/money";

const NEW_TABLE = "__new__";

type DestData = {
  months: { id: string; year: number; month: number; label: string }[];
  sections: { id: string; name: string; countType: SectionCountType }[];
  tables: { id: string; name: string; monthId: string; sectionId: string }[];
  tableTypes: { id: string; name: string; isDefault: boolean }[];
  invertSignOnMoveByDefault: boolean;
};

type Props = {
  accountId: string;
  sourceTableId: string;
  sourceMonthId: string;
  sourceCountType: SectionCountType;
  /** Valor (centavos, serializado) de uma transação da seleção para preview. */
  sampleAmountCents?: string;
  selectedIds: string[];
  open: boolean;
  onClose: () => void;
  onMoved: (ids: string[]) => void;
};

/** Centavos com o sinal de exibição da seção (subtract inverte). */
function displayedCents(cents: bigint, countType: SectionCountType): bigint {
  return displaySignInverts(countType) ? -cents : cents;
}

export function MoveTransactionsDialog({
  accountId,
  sourceTableId,
  sourceMonthId,
  sourceCountType,
  sampleAmountCents,
  selectedIds,
  open,
  onClose,
  onMoved,
}: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [isPending, startTransition] = useTransition();
  const [destData, setDestData] = useState<DestData | null>(null);
  const [loading, setLoading] = useState(false);

  // Selection state
  const [monthId, setMonthId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [tableId, setTableId] = useState(""); // "" = unset, NEW_TABLE = create new
  const [newName, setNewName] = useState("");
  const [newTypeId, setNewTypeId] = useState("");
  const [newCountInMonth, setNewCountInMonth] = useState(true);
  const [invertSign, setInvertSign] = useState(true);

  // Load destination data once
  useEffect(() => {
    if (!open || destData) return;
    setLoading(true);
    listTablesForMoveAction(accountId, {}).then((res) => {
      if (res.ok) {
        setDestData(res.data);
        setInvertSign(res.data.invertSignOnMoveByDefault);
        const def = res.data.tableTypes.find((t) => t.isDefault) ?? res.data.tableTypes[0];
        if (def) setNewTypeId(def.id);
      }
      setLoading(false);
    });
  }, [open, accountId, destData]);

  // Reset selections when dialog opens
  useEffect(() => {
    if (open) {
      setMonthId("");
      setSectionId("");
      setTableId("");
      setNewName("");
      if (destData) setInvertSign(destData.invertSignOnMoveByDefault);
    }
  }, [open, destData]);

  function handleMonthChange(id: string) {
    setMonthId(id);
    setTableId("");
  }

  function handleSectionChange(id: string) {
    setSectionId(id);
    setTableId("");
  }

  // Tables available for the selected month+section (excluding source)
  const availableTables =
    destData?.tables.filter(
      (t) => t.monthId === monthId && t.sectionId === sectionId && t.id !== sourceTableId,
    ) ?? [];

  const isNew = tableId === NEW_TABLE;

  // Convenção de sinal do destino (seção selecionada) vs origem
  const destCountType = destData?.sections.find((s) => s.id === sectionId)?.countType;
  const conventionsDiffer =
    !!destCountType && moveInvertsConvention(sourceCountType, destCountType);

  // Preview de sinal usando uma transação da seleção. Verde/vermelho reforça o
  // significado financeiro (cor é informação): negativo = saída, positivo = entrada.
  const sample = sampleAmountCents ? BigInt(sampleAmountCents) : null;
  const signColor = (cents: bigint) => (cents < 0n ? "danger.main" : "success.main");
  const sourceCents = sample != null ? displayedCents(sample, sourceCountType) : null;
  const invertCents =
    sample != null && destCountType ? displayedCents(-sample, destCountType) : null;
  const preserveCents =
    sample != null && destCountType ? displayedCents(sample, destCountType) : null;

  const canSubmit =
    !!monthId &&
    !!sectionId &&
    ((!isNew && !!tableId) || (isNew && !!newName.trim() && !!newTypeId));

  function handleSubmit() {
    if (!canSubmit) return;

    startTransition(async () => {
      const destination = isNew
        ? {
            type: "new" as const,
            monthId,
            sectionId,
            tableTypeId: newTypeId,
            name: newName.trim(),
            countInMonth: newCountInMonth,
          }
        : { type: "existing" as const, tableId };

      const result = await moveTransactionsAction(accountId, {
        ids: selectedIds,
        sourceMonthId,
        invertSign,
        destination,
      });

      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }

      enqueueSnackbar(
        m.financeTables.moveSuccess(selectedIds.length, result.data.targetTableName),
        {
          variant: "success",
        },
      );
      onMoved(selectedIds);
      onClose();
    });
  }

  return (
    <DialogShell
      open={open}
      onClose={onClose}
      maxWidth="sm"
      title={m.financeTables.moveTitle(selectedIds.length)}
      loading={isPending}
      actions={
        <>
          <Button onClick={onClose}>{m.common.cancel}</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!canSubmit}
            endIcon={
              isPending ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <DriveFileMoveIcon fontSize="small" />
              )
            }
          >
            {m.financeTables.moveTitle(selectedIds.length)}
          </Button>
        </>
      }
    >
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: layout.section }}>
          <CircularProgress />
        </Box>
      ) : (
        <Stack spacing={layout.stack} sx={{ mt: 0.5 }} direction="column">
          {/* Mês destino */}
          <FormControl fullWidth size="small">
            <InputLabel size="small">Mês destino *</InputLabel>
            <Select
              value={monthId}
              label="Mês destino *"
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

          {/* Seção destino */}
          <FormControl fullWidth size="small">
            <InputLabel size="small">Seção destino *</InputLabel>
            <Select
              value={sectionId}
              label="Seção destino *"
              onChange={(e) => handleSectionChange(e.target.value)}
              size="small"
            >
              {destData?.sections.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Tabela destino — só aparece quando mês e seção selecionados */}
          {monthId && sectionId && (
            <FormControl fullWidth size="small">
              <InputLabel>Tabela destino *</InputLabel>
              <Select
                value={tableId}
                label="Tabela destino *"
                onChange={(e) => setTableId(e.target.value)}
              >
                {availableTables.map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.name}
                  </MenuItem>
                ))}
                {availableTables.length > 0 && <Divider />}
                <MenuItem value={NEW_TABLE}>
                  <AddIcon fontSize="small" sx={{ mr: 0.5 }} />
                  Criar nova tabela
                </MenuItem>
              </Select>
            </FormControl>
          )}

          {/* Campos da nova tabela */}
          {isNew && (
            <Paper variant="outlined" sx={{ p: layout.inline }}>
              <Typography
                variant="overline"
                color="text.secondary"
                display="block"
                mb={layout.inline}
              >
                {m.financeTables.moveNewTableSection}
              </Typography>
              <Stack spacing={layout.inline}>
                <TextField
                  label="Nome da tabela *"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  fullWidth
                  autoFocus
                  size="small"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canSubmit) handleSubmit();
                  }}
                />
                <FormControl fullWidth size="small">
                  <InputLabel>Tipo de tabela</InputLabel>
                  <Select
                    value={newTypeId}
                    label="Tipo de tabela"
                    onChange={(e) => setNewTypeId(e.target.value)}
                  >
                    {destData?.tableTypes.map((t) => (
                      <MenuItem key={t.id} value={t.id}>
                        {t.name}
                        {t.isDefault && (
                          <Typography
                            component="span"
                            variant="caption"
                            color="text.secondary"
                            sx={{ ml: 1 }}
                          >
                            (padrão)
                          </Typography>
                        )}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={newCountInMonth}
                      onChange={(e) => setNewCountInMonth(e.target.checked)}
                    />
                  }
                  label="Contar no total do mês"
                />
              </Stack>
            </Paper>
          )}

          {/* Sinal do valor — só quando origem e destino têm convenção oposta */}
          {conventionsDiffer && (
            <Alert severity="warning" icon={<SwapVertIcon fontSize="small" />}>
              <FormControl component="fieldset" sx={{ width: "100%" }}>
                <FormLabel id="move-sign-label" sx={{ typography: "subtitle2" }}>
                  {m.financeTables.moveSignHeading}
                </FormLabel>
                <Typography variant="body2" color="text.secondary" mt={0.5}>
                  {m.financeTables.moveSignExplanation}
                </Typography>
                {sourceCents != null && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    {(selectedIds.length > 1
                      ? m.financeTables.moveSignSampleMulti
                      : m.financeTables.moveSignSample)(
                      formatCentsToBrl(sourceCents, { sign: true }),
                    )}
                  </Typography>
                )}
                <RadioGroup
                  aria-labelledby="move-sign-label"
                  value={invertSign ? "invert" : "preserve"}
                  onChange={(e) => setInvertSign(e.target.value === "invert")}
                  sx={{ mt: layout.inline }}
                >
                  <FormControlLabel
                    value="invert"
                    control={<Radio size="small" />}
                    label={
                      <Box>
                        <Typography variant="body2">
                          {m.financeTables.moveSignInvertLabel}
                        </Typography>
                        {invertCents != null && (
                          <Typography variant="caption" color={signColor(invertCents)}>
                            {m.financeTables.moveSignResult(
                              formatCentsToBrl(invertCents, { sign: true }),
                            )}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                  <FormControlLabel
                    value="preserve"
                    control={<Radio size="small" />}
                    label={
                      <Box>
                        <Typography variant="body2">
                          {m.financeTables.moveSignPreserveLabel}
                        </Typography>
                        {preserveCents != null && (
                          <Typography variant="caption" color={signColor(preserveCents)}>
                            {m.financeTables.moveSignResult(
                              formatCentsToBrl(preserveCents, { sign: true }),
                            )}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                </RadioGroup>
              </FormControl>
            </Alert>
          )}
        </Stack>
      )}
    </DialogShell>
  );
}
