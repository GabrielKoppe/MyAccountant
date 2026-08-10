"use client";

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormLabel from "@mui/material/FormLabel";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import { CSV_ENCODINGS, DATE_FORMATS, DEFAULT_MAPPING } from "@/lib/schemas/csv-import";
import { m } from "@/lib/messages";
import { layout } from "@/lib/design-tokens";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { FieldGroup } from "@/components/ui/FieldGroup";
import { detectAmountFormat } from "@/lib/csv-parser";
import type { ImportMapping } from "@/lib/schemas/csv-import";
import type { ParsedRow } from "@/lib/csv-parser";

type TemplateOption = { id: string; name: string; mapping: ImportMapping };
type MemberOption = { id: string; name: string | null; email: string };

type Props = {
  headers: string[];
  sampleRows: ParsedRow[];
  /** Primeiras linhas físicas cruas do arquivo (para ajustar skipRows visualmente) */
  rawPreviewLines: string[][];
  /** Tipo do arquivo — encoding/delimitador só se aplicam a CSV */
  fileType: "csv" | "xlsx";
  mapping: ImportMapping;
  templates: TemplateOption[];
  members: MemberOption[];
  onChange: (mapping: ImportMapping) => void;
  /**
   * Avisa o wizard qual template originou o mapeamento atual (`null` ao limpar).
   * Só serve para o wizard mandar `templateId` no import e o servidor gravar
   * `CsvTemplate.lastUsedAt` (spec 67 §7.4). O estado visual do seletor continua
   * sendo deste componente — nada aqui muda de comportamento.
   */
  onTemplateSelect?: (templateId: string | null) => void;
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componentes de campo
// ─────────────────────────────────────────────────────────────────────────────

function ColumnSelect({
  label,
  value,
  headers,
  optional,
  onChange,
}: {
  label: string;
  value: string;
  headers: string[];
  optional?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <FormControl fullWidth size="small">
      <InputLabel>{label}</InputLabel>
      <Select value={value ?? ""} label={label} onChange={(e) => onChange(e.target.value)}>
        {optional && <MenuItem value="">— {m.csvImport.mapping.noMapping} —</MenuItem>}
        {headers.map((h) => (
          <MenuItem key={h} value={h}>
            {h}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function MultiColumnSelect({
  label,
  values,
  headers,
  onChange,
}: {
  label: string;
  values: string[];
  headers: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <FormControl fullWidth size="small">
      <InputLabel>{label}</InputLabel>
      <Select
        multiple
        value={values}
        label={label}
        onChange={(e) =>
          onChange(typeof e.target.value === "string" ? e.target.value.split(",") : e.target.value)
        }
        renderValue={(selected) => (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {selected.map((v) => (
              <Chip key={v} label={v} size="small" />
            ))}
          </Box>
        )}
      >
        {headers.map((h) => (
          <MenuItem key={h} value={h}>
            <Checkbox size="small" checked={values.includes(h)} />
            <ListItemText primary={h} />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function AutoCreateSwitch({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <FormControlLabel
      sx={{ ml: 0, mt: layout.micro }}
      control={
        <Switch size="small" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      }
      label={
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      }
    />
  );
}

// grid de 2 colunas responsivo (padrão dos grupos)
const twoCol = {
  display: "grid",
  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
  gap: layout.stack,
} as const;

// radios compactos: label menor + espaçamento reduzido entre opções
const compactRadioSx = {
  "& .MuiFormControlLabel-root": { mr: layout.stack },
  "& .MuiFormControlLabel-label": { fontSize: "0.8125rem" },
} as const;

// ─────────────────────────────────────────────────────────────────────────────

export function StepMapping({
  headers,
  sampleRows,
  rawPreviewLines,
  fileType,
  mapping,
  templates,
  members,
  onChange,
  onTemplateSelect,
}: Props) {
  const [showRawLines, setShowRawLines] = useState(false);
  const [showAdditional, setShowAdditional] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const distinctResponsibleValues = useMemo(() => {
    if (!mapping.columns.responsibleUser) return [];
    const col = mapping.columns.responsibleUser;
    return [...new Set(sampleRows.map((r) => r[col]?.trim()).filter(Boolean))].slice(0, 30);
  }, [mapping.columns.responsibleUser, sampleRows]);

  // Sugere brl/us analisando os valores das colunas de valor mapeadas
  const suggestedFormat = useMemo(() => {
    const cols = [
      mapping.columns.amount,
      mapping.columns.amountCredit,
      mapping.columns.amountDebit,
    ].filter((c): c is string => Boolean(c));
    if (cols.length === 0) return null;
    const values = sampleRows
      .flatMap((r) => cols.map((c) => r[c] ?? ""))
      .filter((v) => v.trim())
      .slice(0, 40);
    return detectAmountFormat(values);
  }, [
    mapping.columns.amount,
    mapping.columns.amountCredit,
    mapping.columns.amountDebit,
    sampleRows,
  ]);

  function patch(partial: Partial<ImportMapping>) {
    onChange({ ...mapping, ...partial });
  }

  function patchColumns(partial: Partial<ImportMapping["columns"]>) {
    onChange({ ...mapping, columns: { ...mapping.columns, ...partial } });
  }

  function applyTemplate(templateId: string) {
    if (!templateId) return;
    const tpl = templates.find((t) => t.id === templateId);
    if (tpl) {
      setSelectedTemplateId(templateId);
      onTemplateSelect?.(templateId);
      onChange({ ...tpl.mapping });
    }
  }

  function clearTemplate() {
    setSelectedTemplateId(null);
    onTemplateSelect?.(null);
    onChange(DEFAULT_MAPPING);
  }

  const preview = sampleRows.slice(0, 5);
  const notesCount = mapping.columns.notes?.length ?? 0;

  // ── Coluna esquerda: amostra + leitura ────────────────────────────────────
  const leftColumn = (
    <Stack spacing={layout.stack} sx={{ position: { md: "sticky" }, top: 0 }}>
      {/* Amostra do arquivo */}
      <Box sx={{ border: 1, borderColor: "border.subtle", borderRadius: 2, overflow: "hidden" }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: layout.inline,
            px: layout.stack,
            py: layout.inline,
            bgcolor: "background.subtle",
          }}
        >
          <Typography variant="overline" color="text.secondary" sx={{ flex: 1, lineHeight: 1 }}>
            {m.csvImport.mapping.sampleTitle}
          </Typography>
          <Typography variant="caption" color="text.disabled">
            {headers.length} colunas · {sampleRows.length} linhas
          </Typography>
        </Box>
        <Divider sx={{ borderColor: "border.subtle" }} />

        {/* Tabela reconhecida (pós-skipRows) */}
        <Box sx={{ p: layout.inline }}>
          <Box sx={{ overflowX: "auto", maxHeight: 260, overflowY: "auto" }}>
            {preview.length > 0 && headers.length > 0 ? (
              <Table
                size="small"
                stickyHeader
                sx={{ "& .MuiTableCell-root": { py: "3px", px: "10px", fontSize: 11 } }}
              >
                <TableHead>
                  <TableRow>
                    {headers.map((h) => (
                      <TableCell
                        key={h}
                        sx={{
                          fontWeight: "medium",
                          whiteSpace: "nowrap",
                          bgcolor: "background.subtle",
                        }}
                      >
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {preview.map((row, i) => (
                    <TableRow key={i}>
                      {headers.map((h) => (
                        <TableCell
                          key={h}
                          sx={{
                            whiteSpace: "nowrap",
                            maxWidth: 180,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {row[h] ?? "—"}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ p: layout.inline }}>
                Nenhuma linha para exibir.
              </Typography>
            )}
          </Box>
        </Box>

        {/* Linhas cruas + skipRows — colapsável */}
        {rawPreviewLines.length > 0 && (
          <>
            <Divider sx={{ borderColor: "border.subtle" }} />
            <Box
              onClick={() => setShowRawLines((p) => !p)}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: layout.inline,
                px: layout.stack,
                py: layout.inline,
                cursor: "pointer",
                userSelect: "none",
                "&:hover": { bgcolor: "background.subtle" },
                transition: "background-color 0.15s ease",
              }}
            >
              <Typography variant="overline" color="text.secondary" sx={{ flex: 1, lineHeight: 1 }}>
                {m.csvImport.mapping.rawLinesTitle}
              </Typography>
              {mapping.skipRows > 0 && (
                <Typography variant="caption" color="accent.primary" fontWeight="medium">
                  {m.csvImport.mapping.skippingLines(mapping.skipRows)}
                </Typography>
              )}
              <ExpandMoreIcon
                fontSize="small"
                sx={{
                  color: "text.disabled",
                  transform: showRawLines ? "rotate(180deg)" : "none",
                  transition: "transform 0.2s ease",
                }}
              />
            </Box>
            <Collapse in={showRawLines}>
              <Divider sx={{ borderColor: "border.subtle" }} />
              <Box sx={{ p: layout.stack }}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: layout.inline,
                    mb: layout.inline,
                    flexWrap: "wrap",
                  }}
                >
                  <TextField
                    label={m.csvImport.mapping.skipRowsLabel}
                    type="number"
                    value={mapping.skipRows}
                    onChange={(e) =>
                      patch({ skipRows: Math.max(0, parseInt(e.target.value) || 0) })
                    }
                    size="small"
                    inputProps={{ min: 0 }}
                    sx={{ width: 150 }}
                  />
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ flex: 1, minWidth: 160 }}
                  >
                    {m.csvImport.mapping.skipRowsHint}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    border: 1,
                    borderColor: "border.subtle",
                    borderRadius: 1,
                    overflow: "hidden",
                  }}
                >
                  {rawPreviewLines.map((cells, i) => {
                    const isSkipped = i < mapping.skipRows;
                    const isHeader = mapping.hasHeader && i === mapping.skipRows;
                    const isEmpty = cells.every((c) => !c.trim());
                    const content = isEmpty
                      ? m.csvImport.mapping.rawLineEmpty
                      : cells.join("  ·  ");
                    return (
                      <Box
                        key={i}
                        onClick={() => patch({ skipRows: i })}
                        title={`Definir pular linhas = ${i}`}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: layout.inline,
                          px: layout.inline,
                          py: "3px",
                          cursor: "pointer",
                          borderTop: i === 0 ? 0 : 1,
                          borderColor: "border.subtle",
                          bgcolor: isHeader
                            ? "accent.primarySubtle"
                            : isSkipped
                              ? "background.subtle"
                              : "transparent",
                          opacity: isSkipped ? 0.5 : 1,
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            flex: "0 0 auto",
                            width: 22,
                            textAlign: "right",
                            fontFamily: "monospace",
                            color: "text.disabled",
                          }}
                        >
                          {i + 1}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            flex: 1,
                            fontFamily: "monospace",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            textDecoration: isSkipped ? "line-through" : "none",
                            color: isEmpty ? "text.disabled" : "text.primary",
                          }}
                        >
                          {content}
                        </Typography>
                        {isSkipped && (
                          <Typography
                            variant="caption"
                            color="text.disabled"
                            sx={{ flex: "0 0 auto", textTransform: "uppercase", fontSize: 9 }}
                          >
                            {m.csvImport.mapping.lineSkipped}
                          </Typography>
                        )}
                        {isHeader && (
                          <Typography
                            variant="caption"
                            color="accent.primary"
                            sx={{
                              flex: "0 0 auto",
                              textTransform: "uppercase",
                              fontSize: 9,
                              fontWeight: "medium",
                            }}
                          >
                            {m.csvImport.mapping.lineHeader}
                          </Typography>
                        )}
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            </Collapse>
          </>
        )}
      </Box>

      {/* Leitura do arquivo */}
      <FieldGroup title={m.csvImport.mapping.readingTitle}>
        <Stack spacing={layout.stack}>
          <FormControlLabel
            sx={{ ml: 0 }}
            control={
              <Switch
                size="small"
                checked={mapping.hasHeader}
                onChange={(e) => patch({ hasHeader: e.target.checked })}
              />
            }
            label={<Typography variant="body2">{m.csvImport.mapping.hasHeaderLabel}</Typography>}
          />
          {fileType === "csv" && (
            <Box sx={twoCol}>
              <FormControl size="small" fullWidth>
                <InputLabel>{m.csvImport.mapping.delimiterLabel}</InputLabel>
                <Select
                  value={mapping.csvDelimiter}
                  label={m.csvImport.mapping.delimiterLabel}
                  onChange={(e) => patch({ csvDelimiter: e.target.value })}
                >
                  <MenuItem value=",">, (vírgula)</MenuItem>
                  <MenuItem value=";">; (ponto-e-vírgula)</MenuItem>
                  <MenuItem value="\t">↹ (tab)</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" fullWidth>
                <InputLabel>{m.csvImport.mapping.encodingLabel}</InputLabel>
                <Select
                  value={mapping.encoding}
                  label={m.csvImport.mapping.encodingLabel}
                  onChange={(e) => patch({ encoding: e.target.value as ImportMapping["encoding"] })}
                >
                  {CSV_ENCODINGS.map((enc) => (
                    <MenuItem key={enc.value} value={enc.value}>
                      {enc.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          )}
        </Stack>
      </FieldGroup>
    </Stack>
  );

  // ── Coluna direita: mapeamento ────────────────────────────────────────────
  const rightColumn = (
    <Stack spacing={layout.stack}>
      {/* Data */}
      <FieldGroup title={m.csvImport.mapping.groupDate}>
        <Box sx={twoCol}>
          <ColumnSelect
            label={m.csvImport.mapping.dateColumn}
            value={mapping.columns.date}
            headers={headers}
            onChange={(v) => patchColumns({ date: v })}
          />
          <FormControl fullWidth size="small">
            <InputLabel>{m.csvImport.mapping.dateFormatLabel}</InputLabel>
            <Select
              value={mapping.dateFormat}
              label={m.csvImport.mapping.dateFormatLabel}
              onChange={(e) => patch({ dateFormat: e.target.value })}
            >
              {DATE_FORMATS.map((f) => (
                <MenuItem key={f.value} value={f.value}>
                  {f.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </FieldGroup>

      {/* Valor */}
      <FieldGroup title={m.csvImport.mapping.groupAmount}>
        <Stack spacing={layout.stack}>
          <FormControl>
            <FormLabel sx={{ fontSize: 12 }}>{m.csvImport.mapping.amountSourceLabel}</FormLabel>
            <RadioGroup
              row
              value={mapping.amountMode}
              onChange={(e) => patch({ amountMode: e.target.value as "single" | "creditDebit" })}
              sx={compactRadioSx}
            >
              <FormControlLabel
                value="single"
                control={<Radio size="small" />}
                label={m.csvImport.mapping.amountSourceSingle}
              />
              <FormControlLabel
                value="creditDebit"
                control={<Radio size="small" />}
                label={m.csvImport.mapping.amountSourceCreditDebit}
              />
            </RadioGroup>
          </FormControl>

          {mapping.amountMode === "single" ? (
            <Box sx={{ maxWidth: { sm: "calc(50% - 8px)" } }}>
              <ColumnSelect
                label={m.csvImport.mapping.amountColumn}
                value={mapping.columns.amount}
                headers={headers}
                onChange={(v) => patchColumns({ amount: v })}
              />
            </Box>
          ) : (
            <Box>
              <Box sx={twoCol}>
                <ColumnSelect
                  label={m.csvImport.mapping.amountCreditColumn}
                  value={mapping.columns.amountCredit ?? ""}
                  headers={headers}
                  optional
                  onChange={(v) => patchColumns({ amountCredit: v || undefined })}
                />
                <ColumnSelect
                  label={m.csvImport.mapping.amountDebitColumn}
                  value={mapping.columns.amountDebit ?? ""}
                  headers={headers}
                  optional
                  onChange={(v) => patchColumns({ amountDebit: v || undefined })}
                />
              </Box>
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
                sx={{ mt: layout.micro }}
              >
                {m.csvImport.mapping.amountCreditDebitHint}
              </Typography>
            </Box>
          )}

          <Divider sx={{ borderColor: "border.subtle" }} />

          <Box sx={{ ...twoCol, alignItems: "start" }}>
            <FormControl>
              <FormLabel sx={{ fontSize: 12 }}>{m.csvImport.mapping.amountFormatLabel}</FormLabel>
              <RadioGroup
                row
                value={mapping.amountFormat}
                onChange={(e) => patch({ amountFormat: e.target.value as "brl" | "us" })}
                sx={compactRadioSx}
              >
                <FormControlLabel
                  value="brl"
                  control={<Radio size="small" />}
                  label={m.csvImport.mapping.amountFormats.brl}
                />
                <FormControlLabel
                  value="us"
                  control={<Radio size="small" />}
                  label={m.csvImport.mapping.amountFormats.us}
                />
              </RadioGroup>
              {suggestedFormat && suggestedFormat !== mapping.amountFormat && (
                <Chip
                  size="small"
                  variant="outlined"
                  color="primary"
                  onClick={() => patch({ amountFormat: suggestedFormat })}
                  label={m.csvImport.mapping.formatSuggestion(
                    suggestedFormat === "brl"
                      ? m.csvImport.mapping.amountFormats.brl
                      : m.csvImport.mapping.amountFormats.us,
                  )}
                  sx={{ alignSelf: "flex-start", mt: layout.micro, cursor: "pointer" }}
                />
              )}
            </FormControl>

            <FormControl>
              <FormLabel sx={{ fontSize: 12 }}>{m.csvImport.mapping.amountSignLabel}</FormLabel>
              <RadioGroup
                row
                value={mapping.amountSign}
                onChange={(e) => patch({ amountSign: e.target.value as "raw" | "invert" | "abs" })}
                sx={compactRadioSx}
              >
                <FormControlLabel
                  value="raw"
                  control={<Radio size="small" />}
                  label={m.csvImport.mapping.amountSigns.raw}
                />
                <FormControlLabel
                  value="invert"
                  control={<Radio size="small" />}
                  label={m.csvImport.mapping.amountSigns.invert}
                />
                <FormControlLabel
                  value="abs"
                  control={<Radio size="small" />}
                  label={m.csvImport.mapping.amountSigns.abs}
                />
              </RadioGroup>
            </FormControl>
          </Box>
        </Stack>
      </FieldGroup>

      {/* Categorização */}
      <FieldGroup title={m.csvImport.mapping.groupCategorization}>
        <Box sx={twoCol}>
          <ColumnSelect
            label={m.csvImport.mapping.descriptionColumn}
            value={mapping.columns.description ?? ""}
            headers={headers}
            optional
            onChange={(v) => patchColumns({ description: v || undefined })}
          />
          <Box>
            <ColumnSelect
              label={m.csvImport.mapping.institutionColumn}
              value={mapping.columns.institution ?? ""}
              headers={headers}
              optional
              onChange={(v) => patchColumns({ institution: v || undefined })}
            />
            {mapping.columns.institution && (
              <AutoCreateSwitch
                checked={mapping.onInstitutionNotFound === "create"}
                label={m.csvImport.mapping.createInstitutionsLabel}
                onChange={(v) => patch({ onInstitutionNotFound: v ? "create" : "ignore" })}
              />
            )}
          </Box>
          <Box>
            <ColumnSelect
              label={m.csvImport.mapping.categoryColumn}
              value={mapping.columns.category ?? ""}
              headers={headers}
              optional
              onChange={(v) => patchColumns({ category: v || undefined })}
            />
            {mapping.columns.category && (
              <AutoCreateSwitch
                checked={mapping.onCategoryNotFound === "create"}
                label={m.csvImport.mapping.createCategoriesLabel}
                onChange={(v) => patch({ onCategoryNotFound: v ? "create" : "ignore" })}
              />
            )}
          </Box>
          <Box>
            <ColumnSelect
              label={m.csvImport.mapping.subcategoryColumn}
              value={mapping.columns.subcategory ?? ""}
              headers={headers}
              optional
              onChange={(v) => patchColumns({ subcategory: v || undefined })}
            />
            {mapping.columns.subcategory && (
              <AutoCreateSwitch
                checked={mapping.onSubcategoryNotFound === "create"}
                label={m.csvImport.mapping.createSubcategoriesLabel}
                onChange={(v) => patch({ onSubcategoryNotFound: v ? "create" : "ignore" })}
              />
            )}
          </Box>
        </Box>
      </FieldGroup>

      {/* Mais campos — colapsável */}
      <CollapsibleSection
        label={m.csvImport.mapping.additionalFields}
        open={showAdditional}
        onToggle={() => setShowAdditional((p) => !p)}
      >
        <Stack spacing={layout.stack}>
          <Box>
            <MultiColumnSelect
              label={m.csvImport.mapping.notesColumn}
              values={mapping.columns.notes ?? []}
              headers={headers}
              onChange={(vals) => patchColumns({ notes: vals })}
            />
            {notesCount > 0 && (
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
                sx={{ mt: layout.micro }}
              >
                {m.csvImport.mapping.notesHint}
              </Typography>
            )}
          </Box>

          <Box sx={twoCol}>
            <ColumnSelect
              label={m.csvImport.mapping.cardInstallmentColumn}
              value={mapping.columns.cardInstallment ?? ""}
              headers={headers}
              optional
              onChange={(v) => patchColumns({ cardInstallment: v || undefined })}
            />
            <ColumnSelect
              label={m.csvImport.mapping.investmentTypeColumn}
              value={mapping.columns.investmentType ?? ""}
              headers={headers}
              optional
              onChange={(v) => patchColumns({ investmentType: v || undefined })}
            />
          </Box>

          {/* Moeda estrangeira */}
          <Box>
            <Typography
              variant="caption"
              color="text.disabled"
              sx={{ display: "block", mb: layout.inline, textTransform: "uppercase", fontSize: 10 }}
            >
              {m.csvImport.mapping.fxSection}
            </Typography>
            <Box sx={twoCol}>
              <ColumnSelect
                label={m.csvImport.mapping.fxAmountColumn}
                value={mapping.columns.fxAmount ?? ""}
                headers={headers}
                optional
                onChange={(v) => patchColumns({ fxAmount: v || undefined })}
              />
              <ColumnSelect
                label={m.csvImport.mapping.fxRateColumn}
                value={mapping.columns.fxRate ?? ""}
                headers={headers}
                optional
                onChange={(v) => patchColumns({ fxRate: v || undefined })}
              />
              {mapping.columns.fxAmount && (
                <>
                  <ColumnSelect
                    label={m.csvImport.mapping.fxCurrencyColumn}
                    value={mapping.columns.fxCurrency ?? ""}
                    headers={headers}
                    optional
                    onChange={(v) => patchColumns({ fxCurrency: v || undefined })}
                  />
                  {!mapping.columns.fxCurrency && (
                    <TextField
                      size="small"
                      label={m.csvImport.mapping.fxCurrencyDefault}
                      helperText={m.csvImport.mapping.fxCurrencyDefaultHint}
                      value={mapping.fxCurrencyDefault ?? ""}
                      inputProps={{ maxLength: 3, style: { textTransform: "uppercase" } }}
                      onChange={(e) =>
                        patch({ fxCurrencyDefault: e.target.value.toUpperCase().slice(0, 3) })
                      }
                    />
                  )}
                </>
              )}
            </Box>
          </Box>

          {/* Responsável */}
          {members.length > 0 && (
            <Box>
              <ColumnSelect
                label={m.csvImport.mapping.responsibleUserColumn}
                value={mapping.columns.responsibleUser ?? ""}
                headers={headers}
                optional
                onChange={(v) => {
                  patchColumns({ responsibleUser: v || undefined });
                  if (!v) patch({ responsibleUserMappings: [] });
                }}
              />
              {mapping.columns.responsibleUser && distinctResponsibleValues.length > 0 && (
                <Box
                  sx={{
                    mt: layout.inline,
                    p: layout.inline,
                    bgcolor: "background.subtle",
                    borderRadius: 1,
                    border: 1,
                    borderColor: "border.subtle",
                  }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    display="block"
                    fontWeight="medium"
                    mb={layout.micro}
                  >
                    {m.csvImport.mapping.responsibleUserMappingsTitle}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    display="block"
                    mb={layout.inline}
                  >
                    {m.csvImport.mapping.responsibleUserMappingsHint}
                  </Typography>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                      gap: layout.inline,
                    }}
                  >
                    {distinctResponsibleValues.map((text) => {
                      const current =
                        mapping.responsibleUserMappings.find((rm) => rm.text === text)?.userId ??
                        "";
                      return (
                        <Box
                          key={text}
                          sx={{ display: "flex", alignItems: "center", gap: layout.inline }}
                        >
                          <Typography
                            variant="caption"
                            title={text}
                            sx={{
                              flex: "0 0 auto",
                              maxWidth: 140,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              fontFamily: "monospace",
                              bgcolor: "background.surface",
                              px: layout.micro,
                              py: 0.5,
                              borderRadius: 0.5,
                              border: 1,
                              borderColor: "border.subtle",
                            }}
                          >
                            {text}
                          </Typography>
                          <Typography variant="caption" color="text.disabled">
                            →
                          </Typography>
                          <FormControl size="small" sx={{ flex: 1 }}>
                            <Select
                              value={current}
                              displayEmpty
                              onChange={(e) => {
                                const userId = e.target.value;
                                const others = mapping.responsibleUserMappings.filter(
                                  (rm) => rm.text !== text,
                                );
                                patch({
                                  responsibleUserMappings: userId
                                    ? [...others, { text, userId }]
                                    : others,
                                });
                              }}
                            >
                              <MenuItem value="">— {m.csvImport.mapping.noMapping} —</MenuItem>
                              {members.map((mem) => (
                                <MenuItem key={mem.id} value={mem.id}>
                                  {mem.name ?? mem.email}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </Stack>
      </CollapsibleSection>
    </Stack>
  );

  return (
    <Stack spacing={layout.stack}>
      {/* Template salvo — barra full-width */}
      {templates.length > 0 && (
        <Box sx={{ display: "flex", gap: layout.inline, alignItems: "center" }}>
          <FormControl fullWidth size="small">
            <InputLabel>{m.csvImport.mapping.templateLabel}</InputLabel>
            <Select
              value={selectedTemplateId ?? ""}
              label={m.csvImport.mapping.templateLabel}
              onChange={(e) => applyTemplate(e.target.value)}
            >
              {templates.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {selectedTemplateId && (
            <Tooltip title={m.csvImport.mapping.clearTemplate}>
              <IconButton
                size="small"
                onClick={clearTemplate}
                aria-label={m.csvImport.mapping.clearTemplate}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      )}

      <Typography variant="caption" color="text.secondary">
        {m.csvImport.mapping.mapIntro}
      </Typography>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "minmax(0, 5fr) minmax(0, 7fr)" },
          gap: layout.stack,
          alignItems: "start",
        }}
      >
        {leftColumn}
        {rightColumn}
      </Box>
    </Stack>
  );
}
