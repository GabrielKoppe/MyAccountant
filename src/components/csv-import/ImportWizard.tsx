"use client";

import UploadIcon from "@mui/icons-material/Upload";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Fade from "@mui/material/Fade";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import Stepper from "@mui/material/Stepper";
import { useSnackbar } from "notistack";
import { useEffect, useMemo, useState, useTransition } from "react";

import { executeImportAction, listTemplatesAction } from "@/actions/csv-import";
import { DialogShell } from "@/components/ui/DialogShell";
import { applyMappingToRows, deriveHeadersAndRows } from "@/lib/csv-parser";
import type { FileMatrix, PreviewRow } from "@/lib/csv-parser";
import { layout } from "@/lib/design-tokens";
import { parseFileToMatrix } from "@/lib/import-file";
import { detectInstallments, type InstallmentSuggestion } from "@/lib/installment-detector";
import { m } from "@/lib/messages";
import { DEFAULT_MAPPING, importMappingSchema } from "@/lib/schemas/csv-import";
import type { ImportMapping } from "@/lib/schemas/csv-import";
import type { SerializedTransactionAlias } from "@/lib/serializers/transaction-alias";
import type { ImportResult } from "@/server/services/csv-import-service";

import { StepConfig, type ImportConfig } from "./StepConfig";
import { StepMapping } from "./StepMapping";
import { StepPreview } from "./StepPreview";
import { StepResult } from "./StepResult";
import { StepUpload } from "./StepUpload";

type SectionOption = { id: string; name: string };
type TableTypeOption = { id: string; name: string; isDefault: boolean };
type TemplateOption = { id: string; name: string; mapping: ImportMapping };
type MemberOption = { id: string; name: string | null; email: string };

type Props = {
  accountId: string;
  monthId: string;
  sections: SectionOption[];
  tableTypes: TableTypeOption[];
  members: MemberOption[];
  aliases: SerializedTransactionAlias[];
  preSelectedSectionId?: string;
  trigger?: "button";
};

// Linhas físicas cruas exibidas na "Amostra do arquivo" para ajustar skipRows
const RAW_PREVIEW_LINES = 12;

const STEPS = [
  m.csvImport.steps.upload,
  m.csvImport.steps.mapping,
  m.csvImport.steps.preview,
  m.csvImport.steps.config,
];

export function ImportWizard({
  accountId,
  monthId,
  sections,
  tableTypes,
  members,
  aliases,
  preSelectedSectionId,
}: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [isPending, startTransition] = useTransition();

  // Step 0 — arquivo selecionado + matriz crua tokenizada (sem interpretar cabeçalho)
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<"csv" | "xlsx">("csv");
  const [matrix, setMatrix] = useState<FileMatrix>([]);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Step 1
  const [mapping, setMapping] = useState<ImportMapping>(DEFAULT_MAPPING);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);

  // headers/rows derivados da matriz conforme skipRows + hasHeader (reativo)
  const { headers, rows } = useMemo(
    () => deriveHeadersAndRows(matrix, mapping.skipRows, mapping.hasHeader),
    [matrix, mapping.skipRows, mapping.hasHeader],
  );

  // Step 2
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [installmentSuggestions, setInstallmentSuggestions] = useState<InstallmentSuggestion[]>([]);
  const [acceptedInstallmentIds, setAcceptedInstallmentIds] = useState<Set<string>>(new Set());
  // rowIndexes que o usuário marcou para ignorar manualmente no preview
  const [manualIgnoredRows, setManualIgnoredRows] = useState<Set<number>>(new Set());
  // rowIndexes casadas por um apelido que o usuário optou por NÃO aplicar (DD-16)
  const [aliasIgnoredRows, setAliasIgnoredRows] = useState<Set<number>>(new Set());

  // Step 3
  const defaultType = tableTypes.find((t) => t.isDefault) ?? tableTypes[0];
  const [config, setConfig] = useState<ImportConfig>({
    tableName: "",
    sectionId: preSelectedSectionId ?? sections[0]?.id ?? "",
    tableTypeId: defaultType?.id ?? "",
    countInMonth: true,
    saveTemplate: false,
    templateName: "",
  });

  // Step 4 (result)
  const [result, setResult] = useState<ImportResult | null>(null);

  // Tokeniza o arquivo em matriz crua. Re-executa quando o encoding muda (CSV),
  // fechando o loop do seletor de encoding sem re-selecionar o arquivo.
  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    setParsing(true);
    setParseError(null);
    parseFileToMatrix(file, fileType, mapping.encoding)
      .then((mtx) => {
        if (!cancelled) setMatrix(mtx);
      })
      .catch(() => {
        if (!cancelled) {
          setMatrix([]);
          setParseError(m.csvImport.upload.parseError);
        }
      })
      .finally(() => {
        if (!cancelled) setParsing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [file, fileType, mapping.encoding]);

  // Load templates when wizard opens
  useEffect(() => {
    if (!open) return;
    listTemplatesAction(accountId, {}).then((res) => {
      if (res.ok) {
        setTemplates(
          res.data.map((t) => {
            // Normaliza mappings antigos: coage notes string→array e preenche defaults novos
            const parsed = importMappingSchema.safeParse(t.mapping);
            return {
              id: t.id,
              name: t.name,
              mapping: parsed.success ? parsed.data : (t.mapping as ImportMapping),
            };
          }),
        );
      }
    });
  }, [open, accountId]);

  function openWizard() {
    setStep(0);
    setFile(null);
    setMatrix([]);
    setFileType("csv");
    setParseError(null);
    setMapping(DEFAULT_MAPPING);
    setPreviewRows([]);
    setManualIgnoredRows(new Set());
    setAliasIgnoredRows(new Set());
    setConfig({
      tableName: "",
      sectionId: preSelectedSectionId ?? sections[0]?.id ?? "",
      tableTypeId: defaultType?.id ?? "",
      countInMonth: true,
      saveTemplate: false,
      templateName: "",
    });
    setResult(null);
    setOpen(true);
  }

  function handleFileSelected(f: File, ft: "csv" | "xlsx") {
    setFileType(ft);
    setMatrix([]);
    setFile(f);
  }

  function handleNext() {
    if (step === 0) {
      if (parsing) {
        enqueueSnackbar(m.csvImport.wizard.stillParsing, { variant: "warning" });
        return;
      }
      if (matrix.length === 0) {
        enqueueSnackbar(m.csvImport.wizard.noFile, { variant: "warning" });
        return;
      }
      setStep(1);
      return;
    }

    if (step === 1) {
      const amountMapped =
        mapping.amountMode === "creditDebit"
          ? Boolean(mapping.columns.amountCredit || mapping.columns.amountDebit)
          : Boolean(mapping.columns.amount);
      if (!mapping.columns.date || !amountMapped) {
        enqueueSnackbar(m.csvImport.wizard.noMapping, { variant: "warning" });
        return;
      }
      const preview = applyMappingToRows(rows, mapping, aliases);
      setPreviewRows(preview);
      setManualIgnoredRows(new Set()); // reinicia escolhas manuais ao recomputar o preview
      setAliasIgnoredRows(new Set());
      // Detectar sugestões de parcelamento
      const suggestions = detectInstallments(preview);
      setInstallmentSuggestions(suggestions);
      // Pré-marcar sugestões de alta confiança
      setAcceptedInstallmentIds(
        new Set(suggestions.filter((s) => s.confidence === "high").map((s) => s.id)),
      );
      setStep(2);
      return;
    }

    if (step === 2) {
      const effectiveOk = previewRows.filter(
        (r) => r.status === "ok" && !manualIgnoredRows.has(r.rowIndex),
      ).length;
      if (effectiveOk === 0) {
        enqueueSnackbar(m.csvImport.wizard.noValidRows, { variant: "warning" });
        return;
      }
      setStep(3);
      return;
    }

    if (step === 3) {
      if (!config.tableName.trim()) {
        enqueueSnackbar(m.csvImport.wizard.noTableName, { variant: "warning" });
        return;
      }
      if (!config.sectionId) {
        enqueueSnackbar(m.csvImport.wizard.noSection, { variant: "warning" });
        return;
      }
      if (config.saveTemplate && !config.templateName.trim()) {
        enqueueSnackbar(m.csvImport.wizard.noTemplateName, { variant: "warning" });
        return;
      }
      handleImport();
    }
  }

  function handleImport() {
    startTransition(async () => {
      const res = await executeImportAction(accountId, {
        monthId,
        sectionId: config.sectionId,
        tableTypeId: config.tableTypeId,
        tableName: config.tableName.trim(),
        countInMonth: config.countInMonth,
        mapping,
        saveTemplateAs: config.saveTemplate ? config.templateName.trim() : undefined,
        rows,
        fileType,
        manualIgnoreRows: [...manualIgnoredRows],
        aliasIgnoreRows: [...aliasIgnoredRows],
        acceptedInstallments: installmentSuggestions
          .filter((s) => acceptedInstallmentIds.has(s.id))
          .map((s) => ({
            groupDescription: s.groupDescription,
            installmentCount: s.installmentCount,
            lines: s.lines,
            totalAmountCents: s.totalAmountCents.toString(),
          })),
      });

      if (!res.ok) {
        enqueueSnackbar(res.error.message, { variant: "error" });
        return;
      }

      setResult(res.data);
      setStep(4);
    });
  }

  const okCount = previewRows.filter(
    (r) => r.status === "ok" && !manualIgnoredRows.has(r.rowIndex),
  ).length;
  const errorCount = previewRows.filter((r) => r.status === "error").length;

  const isLastStep = step === 3;
  const showStepper = step < 4;

  return (
    <>
      <Button
        variant={"outlined"}
        startIcon={<UploadIcon />}
        onClick={openWizard}
        size="small"
        sx={{ fontSize: "0.875rem", textTransform: "none" }}
      >
        {m.csvImport.importButton}
      </Button>

      <DialogShell
        open={open}
        onClose={() => !isPending && setOpen(false)}
        maxWidth={step === 1 ? "xl" : "lg"}
        title={m.csvImport.wizardTitle}
        fullScreenOnMobile={false}
        actions={
          step < 4 ? (
            <>
              <Button onClick={() => setStep((s) => s - 1)} disabled={step === 0 || isPending}>
                {m.csvImport.wizard.back}
              </Button>
              <Button
                variant="contained"
                onClick={handleNext}
                disabled={isPending}
                endIcon={isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
              >
                {isPending
                  ? m.csvImport.wizard.importing
                  : isLastStep
                    ? m.csvImport.config.confirmButton
                    : m.csvImport.wizard.next}
              </Button>
            </>
          ) : undefined
        }
      >
        <Box
          sx={{ display: "flex", flexDirection: "column", gap: layout.stack, minHeight: "52vh" }}
        >
          {showStepper && (
            <Stepper
              activeStep={step}
              alternativeLabel
              sx={{
                "& .MuiStepIcon-root": { fontSize: 20 },
                "& .MuiStepLabel-label": { typography: "caption", mt: "2px" },
              }}
            >
              {STEPS.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
          )}

          <Fade in appear key={step} timeout={{ enter: 220, exit: 0 }}>
            <Box sx={{ flex: 1 }}>
              {step === 0 && (
                <StepUpload
                  fileName={file?.name ?? null}
                  parsing={parsing}
                  parseError={parseError}
                  onFileSelected={handleFileSelected}
                />
              )}
              {step === 1 && (
                <StepMapping
                  headers={headers}
                  sampleRows={rows}
                  rawPreviewLines={matrix.slice(0, RAW_PREVIEW_LINES)}
                  fileType={fileType}
                  mapping={mapping}
                  templates={templates}
                  members={members}
                  onChange={setMapping}
                />
              )}
              {step === 2 && (
                <StepPreview
                  previewRows={previewRows}
                  manualIgnoredRows={manualIgnoredRows}
                  onToggleRow={(rowIndex) =>
                    setManualIgnoredRows((prev) => {
                      const next = new Set(prev);
                      if (next.has(rowIndex)) next.delete(rowIndex);
                      else next.add(rowIndex);
                      return next;
                    })
                  }
                  aliases={aliases}
                  aliasIgnoredRows={aliasIgnoredRows}
                  onToggleAliasRow={(rowIndex) =>
                    setAliasIgnoredRows((prev) => {
                      const next = new Set(prev);
                      if (next.has(rowIndex)) next.delete(rowIndex);
                      else next.add(rowIndex);
                      return next;
                    })
                  }
                  installmentSuggestions={installmentSuggestions}
                  acceptedInstallmentIds={acceptedInstallmentIds}
                  onToggleInstallment={(id) =>
                    setAcceptedInstallmentIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next;
                    })
                  }
                />
              )}
              {step === 3 && (
                <StepConfig
                  config={config}
                  sections={sections}
                  tableTypes={tableTypes}
                  okCount={okCount}
                  errorCount={errorCount}
                  onChange={setConfig}
                />
              )}
              {step === 4 && result && (
                <StepResult
                  result={result}
                  accountId={accountId}
                  monthId={monthId}
                  sectionId={config.sectionId}
                  onClose={() => setOpen(false)}
                  onImportAnother={() => {
                    setStep(0);
                    setFile(null);
                    setMatrix([]);
                    setParseError(null);
                    setPreviewRows([]);
                    setManualIgnoredRows(new Set());
                    setAliasIgnoredRows(new Set());
                    setResult(null);
                  }}
                />
              )}
            </Box>
          </Fade>
        </Box>
      </DialogShell>
    </>
  );
}
