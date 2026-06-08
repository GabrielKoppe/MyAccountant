"use client";

import { useEffect, useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import Stepper from "@mui/material/Stepper";
import { layout } from "@/lib/design-tokens";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { DialogShell } from "@/components/ui/DialogShell";
import { useSnackbar } from "notistack";

import { executeImportAction, listTemplatesAction } from "@/actions/csv-import";
import { applyMappingToRows } from "@/lib/csv-parser";
import { DEFAULT_MAPPING } from "@/lib/schemas/csv-import";
import { m } from "@/lib/messages";
import { StepUpload } from "./StepUpload";
import { StepMapping } from "./StepMapping";
import { StepPreview } from "./StepPreview";
import { StepConfig, type ImportConfig } from "./StepConfig";
import { StepResult } from "./StepResult";
import type { ParsedRow, PreviewRow } from "@/lib/csv-parser";
import type { ImportMapping } from "@/lib/schemas/csv-import";
import type { ImportResult } from "@/server/services/csv-import-service";

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
  preSelectedSectionId?: string;
  trigger?: "button";
};

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
  preSelectedSectionId,
}: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [isPending, startTransition] = useTransition();

  // Step 0
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);

  // Step 1
  const [mapping, setMapping] = useState<ImportMapping>(DEFAULT_MAPPING);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);

  // Step 2
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);

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

  // Load templates when wizard opens
  useEffect(() => {
    if (!open) return;
    listTemplatesAction(accountId, {}).then((res) => {
      if (res.ok) {
        setTemplates(
          res.data.map((t) => ({
            id: t.id,
            name: t.name,
            mapping: t.mapping as ImportMapping,
          })),
        );
      }
    });
  }, [open, accountId]);

  function openWizard() {
    setStep(0);
    setHeaders([]);
    setRows([]);
    setMapping(DEFAULT_MAPPING);
    setPreviewRows([]);
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

  function handleFileParsed(h: string[], r: ParsedRow[]) {
    setHeaders(h);
    setRows(r);
  }

  function handleNext() {
    if (step === 0) {
      if (rows.length === 0) {
        enqueueSnackbar(m.csvImport.wizard.noFile, { variant: "warning" });
        return;
      }
      setStep(1);
      return;
    }

    if (step === 1) {
      if (!mapping.columns.date || !mapping.columns.amount) {
        enqueueSnackbar(m.csvImport.wizard.noMapping, { variant: "warning" });
        return;
      }
      const preview = applyMappingToRows(rows, mapping);
      setPreviewRows(preview);
      setStep(2);
      return;
    }

    if (step === 2) {
      const okCount = previewRows.filter((r) => r.status === "ok").length;
      if (okCount === 0) {
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
      });

      if (!res.ok) {
        enqueueSnackbar(res.error.message, { variant: "error" });
        return;
      }

      setResult(res.data);
      setStep(4);
    });
  }

  const okCount = previewRows.filter((r) => r.status === "ok").length;
  const errorCount = previewRows.filter((r) => r.status === "error").length;

  const isLastStep = step === 3;
  const showStepper = step < 4;

  return (
    <>
      <Button
        variant="outlined"
        startIcon={<UploadFileIcon />}
        onClick={openWizard}
        size="small"
      >
        {m.csvImport.importButton}
      </Button>

      <DialogShell
        open={open}
        onClose={() => !isPending && setOpen(false)}
        maxWidth="lg"
        title={m.csvImport.wizardTitle}
        fullScreenOnMobile={false}
        actions={
          step < 4 ? (
            <>
              <Button
                onClick={() => setStep((s) => s - 1)}
                disabled={step === 0 || isPending}
              >
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
        <Box sx={{ display: "flex", flexDirection: "column", gap: layout.stack, minHeight: "52vh" }}>
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

          <Box sx={{ flex: 1 }}>
            {step === 0 && <StepUpload onParsed={handleFileParsed} />}
            {step === 1 && (
              <StepMapping
                headers={headers}
                sampleRows={rows}
                mapping={mapping}
                templates={templates}
                members={members}
                onChange={setMapping}
              />
            )}
            {step === 2 && <StepPreview previewRows={previewRows} />}
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
                onClose={() => setOpen(false)}
                onImportAnother={() => {
                  setStep(0);
                  setRows([]);
                  setHeaders([]);
                  setPreviewRows([]);
                  setResult(null);
                }}
              />
            )}
          </Box>
        </Box>
      </DialogShell>
    </>
  );
}
