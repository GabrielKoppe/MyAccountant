"use client";

// Spec 68 §2.2 (EST-04) / M4 (revisão de estilo) — importar categorias de CSV, XLSX
// ou JSON.
//
// Duas actions sobre a MESMA classificação (`@/actions/settings-import`): preview só
// lê, aplicar só grava. Isso é o que sustenta a promessa da tela ("nada é gravado
// antes de você conferir esta lista") — o botão "Aplicar" chama a gravação com
// EXATAMENTE as mesmas `rows` e o mesmo `deactivateMissing` que geraram o preview na
// tela, nunca um estado derivado à parte.
//
// A leitura do arquivo é 100% client-side (`parseCategoryImportFile`): o servidor
// nunca vê o arquivo bruto, só as linhas já mapeadas — o classificador
// (`classifyCategoryImport`) é agnóstico do formato de origem.

import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import FormControlLabel from "@mui/material/FormControlLabel";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import { useEffect, useRef, useState } from "react";

import { previewCategoryImportAction, importCategoriesAction } from "@/actions/settings-import";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import {
  SettingsCell,
  SettingsHeadCell,
  SettingsRow,
} from "@/components/settings/table/SettingsTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { CategoryImportRow, ImportAction, ImportPlan } from "@/lib/category-import";
import { parseCategoryImportFile } from "@/lib/category-import-file";
import { layout, typography } from "@/lib/design-tokens";
import { m } from "@/lib/messages";

const t = m.settings.structureDialogs.import;

/** Cor de significado por ação — o mesmo vocabulário de `StatusBadge` em toda a app. */
const ACTION_VARIANT: Record<ImportAction, "success" | "warning" | "neutral" | "danger"> = {
  create: "success",
  update: "warning",
  skip: "neutral",
  error: "danger",
};

export type ImportCategoriesDialogProps = {
  open: boolean;
  onClose: () => void;
  accountId: string;
  /** Chamado após aplicar, para a página recarregar a árvore. */
  onImported: (result: { created: number; updated: number; deactivated: number }) => void;
};

export function ImportCategoriesDialog({
  open,
  onClose,
  accountId,
  onImported,
}: ImportCategoriesDialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<CategoryImportRow[] | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [deactivateMissing, setDeactivateMissing] = useState(false);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [parsing, setParsing] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  // Reabrir começa do zero — sem isso, um segundo arquivo herdaria o plano do primeiro
  // por um instante.
  useEffect(() => {
    if (!open) return;
    setFileName(null);
    setRows(null);
    setFileError(null);
    setDeactivateMissing(false);
    setPlan(null);
    setParsing(false);
    setPreviewLoading(false);
    setApplying(false);
  }, [open]);

  async function runPreview(rowsToClassify: CategoryImportRow[], deactivateMissingValue: boolean) {
    setPreviewLoading(true);
    const result = await previewCategoryImportAction(accountId, {
      rows: rowsToClassify,
      deactivateMissing: deactivateMissingValue,
    });
    if (result.ok) {
      setPlan(result.data);
    } else {
      setPlan(null);
      enqueueSnackbar(result.error.message, { variant: "error" });
    }
    setPreviewLoading(false);
  }

  async function handleFileSelected(file: File) {
    setFileError(null);
    setPlan(null);
    setRows(null);
    setParsing(true);

    try {
      const parsedRows = await parseCategoryImportFile(file);
      if (parsedRows.length === 0) {
        setFileName(file.name);
        setFileError(t.emptyFile);
        return;
      }
      setFileName(file.name);
      setRows(parsedRows);
      await runPreview(parsedRows, deactivateMissing);
    } catch {
      // Cabeçalho sem "nome", arquivo corrompido ou formato inesperado — todos caem
      // na mesma mensagem genérica; o catálogo de mensagens não distingue o motivo.
      setFileName(file.name);
      setFileError(t.parseError);
    } finally {
      setParsing(false);
    }
  }

  function handleToggleDeactivate(checked: boolean) {
    setDeactivateMissing(checked);
    // O toggle muda o que a importação FAZ (desativa ausentes ou não) — repetir o
    // preview é o que mantém a tela honesta com o que "Aplicar" vai gravar.
    if (rows) void runPreview(rows, checked);
  }

  async function handleApply() {
    if (!rows || !plan || plan.totalChanges === 0) return;

    setApplying(true);
    const result = await importCategoriesAction(accountId, { rows, deactivateMissing });
    if (result.ok) {
      enqueueSnackbar(t.success(result.data.created, result.data.updated), { variant: "success" });
      onImported(result.data);
      onClose();
    } else {
      enqueueSnackbar(result.error.message, { variant: "error" });
    }
    setApplying(false);
  }

  const busy = parsing || previewLoading || applying;
  const applyDisabled = !plan || plan.totalChanges === 0 || busy;
  const applyLabel = plan && plan.totalChanges > 0 ? t.apply(plan.totalChanges) : t.nothingToApply;

  return (
    <SettingsDialog
      open={open}
      onClose={onClose}
      size="editor"
      titleIcon={<UploadFileIcon />}
      title={t.title}
      description={t.description}
      loading={applying}
      actions={
        <>
          <Button variant="text" onClick={onClose} disabled={applying}>
            {m.common.cancel}
          </Button>
          <Button variant="contained" onClick={handleApply} disabled={applyDisabled}>
            {applying ? <CircularProgress size={20} /> : applyLabel}
          </Button>
        </>
      }
    >
      <Stack spacing={layout.stack}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.json"
          data-testid="import-categories-file-input"
          style={{ display: "none" }}
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Permite escolher o MESMO arquivo de novo (ex.: corrigiu e re-exportou).
            event.target.value = "";
            if (file) void handleFileSelected(file);
          }}
        />

        {/*
          Bloco do arquivo como no frame: um cartão com ícone, nome em destaque, a
          contagem de linhas + as colunas esperadas, e o botão de trocar à direita.
          Antes eram controles soltos (botão + textos avulsos), e sem arquivo escolhido
          o diálogo abria praticamente vazio — nada dizia o que ele espera receber.
        */}
        <Stack
          direction="row"
          spacing={layout.inline}
          alignItems="center"
          sx={{
            p: layout.inline,
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: "divider",
            borderRadius: "8px",
            bgcolor: "background.surface",
          }}
        >
          <DescriptionOutlinedIcon sx={{ fontSize: 20, color: "text.tertiary" }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" noWrap sx={{ fontWeight: typography.fontWeight.medium }}>
              {fileName ?? t.chooseFile}
            </Typography>
            <Typography variant="caption" color="text.tertiary" component="div">
              {rows && rows.length > 0 ? `${t.fileSummary(rows.length)} · ${t.fileHint}` : t.fileHint}
            </Typography>
          </Box>
          {parsing && <CircularProgress size={16} />}
          <Button
            variant="outlined"
            size="small"
            startIcon={<UploadFileIcon />}
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
          >
            {fileName ? t.changeFile : t.chooseFile}
          </Button>
        </Stack>

        {fileError && (
          <Typography variant="body2" color="error">
            {fileError}
          </Typography>
        )}

        {previewLoading && !plan && (
          <Stack spacing={layout.stack}>
            <Skeleton variant="rectangular" height={64} sx={{ borderRadius: "8px" }} />
            <Skeleton variant="rectangular" height={160} sx={{ borderRadius: "8px" }} />
          </Stack>
        )}

        {plan && (
          <>
            <Stack direction="row" spacing={layout.inline} flexWrap="wrap">
              <CountCard label={t.create} count={plan.counts.create} variant="success" />
              <CountCard label={t.update} count={plan.counts.update} variant="warning" />
              <CountCard label={t.skip} count={plan.counts.skip} variant="neutral" />
              {plan.counts.error > 0 && (
                <CountCard label={t.error} count={plan.counts.error} variant="danger" />
              )}
            </Stack>

            <TableContainer sx={{ maxHeight: 320, opacity: previewLoading ? 0.5 : 1 }}>
              {/* Mesmas células da tabela das páginas: um preview de 24 linhas com a
                  densidade de formulário do tema (55px por linha) não caberia no
                  diálogo, e leria maior que a lista que ele vai alterar. */}
              <Table stickyHeader sx={{ tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: 96 }} />
                  <col />
                  <col style={{ width: 120 }} />
                  <col />
                </colgroup>
                <TableHead>
                  <TableRow>
                    <SettingsHeadCell>{t.columnAction}</SettingsHeadCell>
                    <SettingsHeadCell>{t.columnName}</SettingsHeadCell>
                    <SettingsHeadCell>{t.columnParent}</SettingsHeadCell>
                    <SettingsHeadCell>{t.columnNote}</SettingsHeadCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {plan.rows.map((row) => (
                    <SettingsRow key={row.line} hover>
                      <SettingsCell>
                        <StatusBadge variant={ACTION_VARIANT[row.action]}>
                          {t.actionLabels[row.action]}
                        </StatusBadge>
                      </SettingsCell>
                      <SettingsCell>{row.name}</SettingsCell>
                      <SettingsCell sx={{ color: "text.tertiary" }}>
                        {row.parent ?? "—"}
                      </SettingsCell>
                      <SettingsCell sx={{ color: "text.tertiary" }}>{row.note}</SettingsCell>
                    </SettingsRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Box>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={deactivateMissing}
                    disabled={busy}
                    onChange={(event) => handleToggleDeactivate(event.target.checked)}
                  />
                }
                label={t.deactivateMissing}
              />
              <Typography variant="caption" color="text.tertiary" sx={{ display: "block", pl: 4 }}>
                {t.deactivateMissingHint}
              </Typography>
            </Box>
          </>
        )}
      </Stack>
    </SettingsDialog>
  );
}

function CountCard({
  label,
  count,
  variant,
}: {
  label: string;
  count: number;
  variant: "success" | "warning" | "neutral" | "danger";
}) {
  const styles: Record<typeof variant, { bg: string; color: string }> = {
    success: { bg: "success.light", color: "success.main" },
    warning: { bg: "warning.light", color: "warning.main" },
    neutral: { bg: "neutral.subtle", color: "text.secondary" },
    danger: { bg: "danger.subtle", color: "danger.main" },
  };
  const { bg, color } = styles[variant];

  return (
    <Box
      sx={{ bgcolor: bg, borderRadius: "8px", px: layout.stack, py: layout.inline, minWidth: 96 }}
    >
      <Typography variant="caption" sx={{ color, display: "block" }}>
        {label}
      </Typography>
      <Typography variant="h4" sx={{ color, fontFamily: typography.fontFamily.mono }}>
        {count}
      </Typography>
    </Box>
  );
}
