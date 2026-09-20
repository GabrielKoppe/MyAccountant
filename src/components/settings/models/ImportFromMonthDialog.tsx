"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { importTemplateItemsFromTableAction } from "@/actions/table-templates";
import { listTablesForMoveAction } from "@/actions/transactions";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { SettingsFieldLabel } from "@/components/settings/SettingsFieldLabel";
import { SettingsSelect } from "@/components/settings/table/SettingsSelect";
import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";

import type { ModelItem } from "./model-item-draft";

const t = m.settings.presentation.models.importFromMonth;

type MonthOption = { id: string; label: string };
type TableOption = { id: string; name: string; monthId: string; transactions: number };

export type ImportFromMonthDialogProps = {
  accountId: string;
  templateId: string;
  open: boolean;
  onClose: () => void;
  /** A lista COMPLETA de itens do modelo depois da importação. */
  onImported: (items: ModelItem[], imported: number) => void;
};

/**
 * "Importar de um mês" (Spec 69 §2.2, frame 06b).
 *
 * Puxa as transações de uma tabela real já existente como ponto de partida do
 * modelo. **Append, nunca substituição** — o texto do diálogo diz isso e o
 * serviço garante: as transações atuais ficam onde estão e as importadas entram
 * no fim.
 *
 * Os seletores saem de `listTablesForMoveAction`, que já devolve meses e tabelas
 * da conta e ganhou o `_count.transactions` para esta tela — assim a contagem do
 * "N transações serão importadas" aparece ANTES de confirmar, sem ler transação
 * nenhuma.
 */
export function ImportFromMonthDialog({
  accountId,
  templateId,
  open,
  onClose,
  onImported,
}: ImportFromMonthDialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [months, setMonths] = useState<MonthOption[]>([]);
  const [tables, setTables] = useState<TableOption[]>([]);
  const [monthId, setMonthId] = useState("");
  const [tableId, setTableId] = useState("");
  const [loading, setLoading] = useState(false);
  const [isImporting, startImporting] = useTransition();

  // A action é assíncrona e o diálogo pode fechar no meio; sem esta guarda o
  // `setState` cai numa árvore que não existe mais.
  const unmountedRef = useRef(false);
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await listTablesForMoveAction(accountId, {});
    if (unmountedRef.current) return;
    setLoading(false);

    if (!result.ok) {
      enqueueSnackbar(result.error.message, { variant: "error" });
      return;
    }
    setMonths(result.data.months.map((month) => ({ id: month.id, label: month.label })));
    setTables(
      result.data.tables.map((table) => ({
        id: table.id,
        name: table.name,
        monthId: table.monthId,
        transactions: table._count.transactions,
      })),
    );
  }, [accountId, enqueueSnackbar]);

  useEffect(() => {
    // Só busca quando o diálogo ABRE — a lista de meses da conta inteira não
    // precisa viajar junto com a página de Configurações.
    if (!open) return;
    setMonthId("");
    setTableId("");
    void load();
  }, [open, load]);

  const monthTables = tables.filter((table) => table.monthId === monthId);
  const selectedTable = monthTables.find((table) => table.id === tableId) ?? null;

  function handleImport() {
    if (!selectedTable) return;

    startImporting(async () => {
      const result = await importTemplateItemsFromTableAction(accountId, {
        templateId,
        tableId: selectedTable.id,
      });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      onImported(result.data.items, result.data.imported);
      enqueueSnackbar(t.success(result.data.imported), { variant: "success" });
      onClose();
    });
  }

  return (
    <SettingsDialog
      open={open}
      onClose={onClose}
      size="form"
      title={t.title}
      description={t.description}
      loading={isImporting}
      actions={
        <>
          <Button onClick={onClose}>{m.common.cancel}</Button>
          <Button
            variant="contained"
            onClick={handleImport}
            // Tabela vazia não tem o que importar — confirmar seria um no-op que
            // fecha o diálogo e não muda nada, que lê como falha.
            disabled={isImporting || !selectedTable || selectedTable.transactions === 0}
            endIcon={isImporting ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {t.confirm}
          </Button>
        </>
      }
    >
      {loading ? (
        <Stack alignItems="center" sx={{ py: layout.section }}>
          <CircularProgress size={24} aria-label={m.common.loading} />
        </Stack>
      ) : (
        <Stack spacing={layout.stack}>
          <Box>
            <SettingsFieldLabel>{t.monthLabel}</SettingsFieldLabel>
            <SettingsSelect
              fullWidth
              value={monthId}
              onChange={(event) => {
                setMonthId(String(event.target.value));
                // A tabela escolhida pertencia ao mês anterior: mantê-la
                // importaria de uma tabela que o seletor nem mostra mais.
                setTableId("");
              }}
              options={months.map((month) => ({ value: month.id, label: month.label }))}
              emptyLabel={m.common.none}
              inputProps={{ "aria-label": t.monthLabel }}
            />
          </Box>

          <Box>
            <SettingsFieldLabel>{t.tableLabel}</SettingsFieldLabel>
            <SettingsSelect
              fullWidth
              value={tableId}
              onChange={(event) => setTableId(String(event.target.value))}
              options={monthTables.map((table) => ({ value: table.id, label: table.name }))}
              emptyLabel={m.common.none}
              disabled={monthId === "" || monthTables.length === 0}
              inputProps={{ "aria-label": t.tableLabel }}
            />
            {monthId !== "" && monthTables.length === 0 && (
              <Typography
                variant="caption"
                sx={{ display: "block", mt: layout.micro, color: "text.tertiary" }}
              >
                {t.noTables}
              </Typography>
            )}
          </Box>

          {/* O número aparece ANTES de confirmar — é o que separa "importar" de
              "importar e descobrir depois quantas linhas entraram". */}
          {selectedTable && (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {t.preview(selectedTable.transactions)}
            </Typography>
          )}
        </Stack>
      )}
    </SettingsDialog>
  );
}
