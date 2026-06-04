"use client";

import { useEffect, useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import DriveFileMoveIcon from "@mui/icons-material/DriveFileMove";
import { useSnackbar } from "notistack";

import { listTablesForMoveAction, moveTransactionsAction } from "@/actions/transactions";
import { DialogShell } from "@/components/ui/DialogShell";

const NEW_TABLE = "__new__";

type DestData = {
  months: { id: string; year: number; month: number; label: string }[];
  sections: { id: string; name: string }[];
  tables: { id: string; name: string; monthId: string; sectionId: string }[];
  tableTypes: { id: string; name: string; isDefault: boolean }[];
};

type Props = {
  accountId: string;
  sourceTableId: string;
  sourceMonthId: string;
  selectedIds: string[];
  open: boolean;
  onClose: () => void;
  onMoved: (ids: string[]) => void;
};

export function MoveTransactionsDialog({
  accountId,
  sourceTableId,
  sourceMonthId,
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

  // Load destination data once
  useEffect(() => {
    if (!open || destData) return;
    setLoading(true);
    listTablesForMoveAction(accountId, {}).then((res) => {
      if (res.ok) {
        setDestData(res.data);
        const def = res.data.tableTypes.find((t: any) => t.isDefault) ?? res.data.tableTypes[0];
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
    }
  }, [open]);

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
        destination,
      });

      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }

      enqueueSnackbar(
        `${selectedIds.length} transação(ões) movida(s) para "${result.data.targetTableName}".`,
        { variant: "success" },
      );
      onMoved(selectedIds);
      onClose();
    });
  }

  return (
    <DialogShell
      open={open}
      onClose={() => !isPending && onClose()}
      maxWidth="sm"
      title={`Mover ${selectedIds.length} transação(ões)`}
      actions={
        <>
          <Button onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!canSubmit || isPending}
            endIcon={
              isPending ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <DriveFileMoveIcon fontSize="small" />
              )
            }
          >
            {isPending ? "Movendo..." : `Mover ${selectedIds.length} transação(ões)`}
          </Button>
        </>
      }
    >
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Stack spacing={2.5} sx={{ mt: 0.5 }}>
          {/* Mês destino */}
          <FormControl fullWidth>
            <InputLabel>Mês destino *</InputLabel>
            <Select
              value={monthId}
              label="Mês destino *"
              onChange={(e) => handleMonthChange(e.target.value)}
            >
              {destData?.months.map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  {m.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Seção destino */}
          <FormControl fullWidth>
            <InputLabel>Seção destino *</InputLabel>
            <Select
              value={sectionId}
              label="Seção destino *"
              onChange={(e) => handleSectionChange(e.target.value)}
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
            <FormControl fullWidth>
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
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography
                variant="caption"
                fontWeight="bold"
                color="text.secondary"
                display="block"
                mb={1.5}
              >
                CONFIGURAR NOVA TABELA
              </Typography>
              <Stack spacing={2}>
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
        </Stack>
      )}
    </DialogShell>
  );
}
