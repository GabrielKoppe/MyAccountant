"use client";

import { useMemo, useState, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormLabel from "@mui/material/FormLabel";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Select from "@mui/material/Select";
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

import { DATE_FORMATS, DEFAULT_MAPPING } from "@/lib/schemas/csv-import";
import { m } from "@/lib/messages";
import { layout } from "@/lib/design-tokens";
import type { ImportMapping } from "@/lib/schemas/csv-import";
import type { ParsedRow } from "@/lib/csv-parser";

type TemplateOption = { id: string; name: string; mapping: ImportMapping };
type MemberOption = { id: string; name: string | null; email: string };

type Props = {
  headers: string[];
  sampleRows: ParsedRow[];
  /** Primeiras linhas físicas cruas do arquivo (para ajustar skipRows visualmente) */
  rawPreviewLines: string[][];
  mapping: ImportMapping;
  templates: TemplateOption[];
  members: MemberOption[];
  onChange: (mapping: ImportMapping) => void;
};

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

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Typography
      variant="overline"
      color="text.tertiary"
      display="block"
      sx={{ lineHeight: 1, mb: layout.inline }}
    >
      {children}
    </Typography>
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

function CollapsibleSection({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <Box
      sx={{
        border: 1,
        borderColor: "border.subtle",
        borderRadius: 1,
        overflow: "hidden",
      }}
    >
      <Box
        onClick={onToggle}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: layout.inline,
          py: layout.micro,
          cursor: "pointer",
          userSelect: "none",
          bgcolor: "background.subtle",
          "&:hover": { bgcolor: "background.muted" },
          transition: "background-color 0.15s ease",
        }}
      >
        <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1 }}>
          {label}
        </Typography>
        <ExpandMoreIcon
          fontSize="small"
          sx={{
            color: "text.disabled",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.2s ease",
          }}
        />
      </Box>
      <Collapse in={open}>
        <Divider sx={{ borderColor: "border.subtle" }} />
        {children}
      </Collapse>
    </Box>
  );
}

export function StepMapping({
  headers,
  sampleRows,
  rawPreviewLines,
  mapping,
  templates,
  members,
  onChange,
}: Props) {
  const [showSample, setShowSample] = useState(true);
  const [showRawLines, setShowRawLines] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showAdditional, setShowAdditional] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const distinctResponsibleValues = useMemo(() => {
    if (!mapping.columns.responsibleUser) return [];
    const col = mapping.columns.responsibleUser;
    return [...new Set(sampleRows.map((r) => r[col]?.trim()).filter(Boolean))].slice(0, 30);
  }, [mapping.columns.responsibleUser, sampleRows]);

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
      onChange({ ...tpl.mapping });
    }
  }

  function clearTemplate() {
    setSelectedTemplateId(null);
    onChange(DEFAULT_MAPPING);
  }

  const preview = sampleRows.slice(0, 5);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: layout.stack }}>
      {/* 1. Amostra do arquivo — colapsável */}
      <Box
        sx={{
          border: 1,
          borderColor: "border.subtle",
          borderRadius: 1,
          overflow: "hidden",
        }}
      >
        <Box
          onClick={() => setShowSample((p) => !p)}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: layout.inline,
            px: layout.inline,
            py: layout.micro,
            cursor: "pointer",
            userSelect: "none",
            bgcolor: "background.subtle",
            "&:hover": { bgcolor: "background.muted" },
            transition: "background-color 0.15s ease",
          }}
        >
          <Typography variant="overline" color="text.secondary" sx={{ flex: 1, lineHeight: 1 }}>
            {m.csvImport.mapping.sampleTitle}
          </Typography>
          {!showSample && (
            <Typography variant="caption" color="text.disabled">
              {headers.length} colunas · {sampleRows.length} linhas
            </Typography>
          )}
          <ExpandMoreIcon
            fontSize="small"
            sx={{
              color: "text.disabled",
              transform: showSample ? "rotate(180deg)" : "none",
              transition: "transform 0.2s ease",
            }}
          />
        </Box>
        <Collapse in={showSample}>
          <Box
            sx={{ p: layout.inline, display: "flex", flexDirection: "column", gap: layout.stack }}
          >
            {/* Linhas cruas + controle de skipRows — colapsável (fechado por padrão) */}
            {rawPreviewLines.length > 0 && (
              <Box
                sx={{
                  border: 1,
                  borderColor: "border.subtle",
                  borderRadius: 1,
                  overflow: "hidden",
                }}
              >
                <Box
                  onClick={() => setShowRawLines((p) => !p)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: layout.inline,
                    px: layout.inline,
                    py: layout.micro,
                    cursor: "pointer",
                    userSelect: "none",
                    bgcolor: "background.subtle",
                    "&:hover": { bgcolor: "background.muted" },
                    transition: "background-color 0.15s ease",
                  }}
                >
                  <Typography
                    variant="overline"
                    color="text.secondary"
                    sx={{ flex: 1, lineHeight: 1 }}
                  >
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
                  <Box sx={{ p: layout.inline }}>
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
                      <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
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
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: layout.inline,
                              px: layout.inline,
                              py: "3px",
                              borderTop: i === 0 ? 0 : 1,
                              borderColor: "border.subtle",
                              bgcolor: isHeader
                                ? "accent.primarySubtle"
                                : isSkipped
                                  ? "background.subtle"
                                  : "transparent",
                              opacity: isSkipped ? 0.5 : 1,
                            }}
                            onClick={() => patch({ skipRows: i })}
                            title={`Definir pular linhas = ${i}`}
                          >
                            <Typography
                              variant="caption"
                              sx={{
                                flex: "0 0 auto",
                                width: 22,
                                textAlign: "right",
                                fontFamily: "monospace",
                                color: "text.disabled",
                                cursor: "pointer",
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
                                cursor: "pointer",
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
              </Box>
            )}

            {/* Tabela derivada (pós-skipRows) */}
            <Box>
              <Typography
                variant="overline"
                color="text.tertiary"
                display="block"
                sx={{ lineHeight: 1, mb: layout.micro }}
              >
                {m.csvImport.mapping.derivedTableTitle}
              </Typography>
              <Box sx={{ overflowX: "auto" }}>
                {preview.length > 0 && headers.length > 0 ? (
                  <Table
                    size="small"
                    sx={{ "& .MuiTableCell-root": { py: "3px", px: "10px", fontSize: 11 } }}
                  >
                    <TableHead>
                      <TableRow sx={{ bgcolor: "background.subtle" }}>
                        {headers.map((h) => (
                          <TableCell key={h} sx={{ fontWeight: "medium", whiteSpace: "nowrap" }}>
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
                  <Typography variant="body2" color="text.secondary">
                    Nenhuma linha para exibir.
                  </Typography>
                )}
              </Box>
            </Box>
          </Box>
        </Collapse>
      </Box>

      {/* 2. Template salvo */}
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
              <IconButton size="small" onClick={clearTemplate}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      )}

      <Divider />

      {/* 3. Mapeamento de colunas */}
      <Box>
        <SectionLabel>{m.csvImport.mapping.columnsTitle}</SectionLabel>

        {/* Obrigatórias */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: layout.stack,
            mb: layout.stack,
          }}
        >
          <ColumnSelect
            label={m.csvImport.mapping.dateColumn}
            value={mapping.columns.date}
            headers={headers}
            onChange={(v) => patchColumns({ date: v })}
          />
          <ColumnSelect
            label={m.csvImport.mapping.amountColumn}
            value={mapping.columns.amount}
            headers={headers}
            onChange={(v) => patchColumns({ amount: v })}
          />
        </Box>

        {/* Opcionais */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: layout.stack,
          }}
        >
          <Box>
            <ColumnSelect
              label={m.csvImport.mapping.descriptionColumn}
              value={mapping.columns.description ?? ""}
              headers={headers}
              optional
              onChange={(v) => patchColumns({ description: v || undefined })}
            />
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
        </Box>
      </Box>

      <Divider />

      {/* 4. Formato */}
      <Box>
        <SectionLabel>{m.csvImport.mapping.formatTitle}</SectionLabel>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: layout.stack,
            alignItems: "start",
          }}
        >
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

          <Box sx={{ display: "flex", flexDirection: "column", gap: layout.inline }}>
            <FormControl>
              <FormLabel sx={{ fontSize: 12 }}>{m.csvImport.mapping.amountFormatLabel}</FormLabel>
              <RadioGroup
                row
                value={mapping.amountFormat}
                onChange={(e) => patch({ amountFormat: e.target.value as "brl" | "us" })}
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
            </FormControl>

            <FormControl>
              <FormLabel sx={{ fontSize: 12 }}>{m.csvImport.mapping.amountSignLabel}</FormLabel>
              <RadioGroup
                row
                value={mapping.amountSign}
                onChange={(e) => patch({ amountSign: e.target.value as "raw" | "invert" | "abs" })}
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
        </Box>
      </Box>

      {/* 5. Campos adicionais — colapsável */}
      <CollapsibleSection
        label={m.csvImport.mapping.additionalFields}
        open={showAdditional}
        onToggle={() => setShowAdditional((p) => !p)}
      >
        <Box
          sx={{
            p: layout.stack,
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: layout.stack,
          }}
        >
          <ColumnSelect
            label={m.csvImport.mapping.notesColumn}
            value={mapping.columns.notes ?? ""}
            headers={headers}
            optional
            onChange={(v) => patchColumns({ notes: v || undefined })}
          />
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

          {/* Moeda estrangeira */}
          <Box sx={{ gridColumn: "1 / -1" }}>
            <Typography
              variant="caption"
              color="text.disabled"
              sx={{
                display: "block",
                mb: 1,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                fontSize: 10,
              }}
            >
              {m.csvImport.mapping.fxSection}
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: layout.stack,
              }}
            >
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
            </Box>
          )}

          {/* Mapeamento texto→membro — ocupa largura total */}
          {mapping.columns.responsibleUser && distinctResponsibleValues.length > 0 && (
            <Box
              sx={{
                gridColumn: "1 / -1",
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
                    mapping.responsibleUserMappings.find((rm) => rm.text === text)?.userId ?? "";
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
      </CollapsibleSection>

      {/* 6. Opções avançadas — colapsável */}
      <CollapsibleSection
        label={m.csvImport.mapping.advancedTitle}
        open={showAdvanced}
        onToggle={() => setShowAdvanced((p) => !p)}
      >
        <Box sx={{ p: layout.stack, display: "flex", flexDirection: "column", gap: layout.stack }}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={mapping.hasHeader}
                onChange={(e) => patch({ hasHeader: e.target.checked })}
              />
            }
            label={<Typography variant="body2">{m.csvImport.mapping.hasHeaderLabel}</Typography>}
          />
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "160px 1fr",
              gap: layout.stack,
            }}
          >
            <TextField
              label={m.csvImport.mapping.skipRowsLabel}
              type="number"
              value={mapping.skipRows}
              onChange={(e) => patch({ skipRows: Math.max(0, parseInt(e.target.value) || 0) })}
              size="small"
              inputProps={{ min: 0 }}
            />
            <FormControl size="small">
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
          </Box>
        </Box>
      </CollapsibleSection>
    </Box>
  );
}
