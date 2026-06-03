"use client";

import { useMemo, useState } from "react";
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
import Typography from "@mui/material/Typography";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import { DATE_FORMATS } from "@/lib/schemas/csv-import";
import { m } from "@/lib/messages";
import type { ImportMapping } from "@/lib/schemas/csv-import";
import type { ParsedRow } from "@/lib/csv-parser";

type TemplateOption = { id: string; name: string; mapping: ImportMapping };
type MemberOption = { id: string; name: string | null; email: string };

type Props = {
  headers: string[];
  sampleRows: ParsedRow[]; // all rows (used both for display and for computing distinct values)
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
      <Select
        value={value ?? ""}
        label={label}
        onChange={(e) => onChange(e.target.value)}
      >
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

export function StepMapping({ headers, sampleRows, mapping, templates, members, onChange }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showAdditional, setShowAdditional] = useState(false);

  // Distinct non-empty values in the responsibleUser column (from all rows)
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
    if (tpl) onChange({ ...tpl.mapping });
  }

  const preview = sampleRows.slice(0, 5);

  return (
    <Box sx={{ display: "flex", gap: 3, flexDirection: { xs: "column", md: "row" } }}>
      {/* Left: file sample */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
          Amostra do arquivo (5 linhas)
        </Typography>
        {preview.length > 0 ? (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 200 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: "background.default" }}>
                  {headers.slice(0, 6).map((h) => (
                    <TableCell key={h} sx={{ fontSize: 11, fontWeight: "bold", whiteSpace: "nowrap" }}>
                      {h}
                    </TableCell>
                  ))}
                  {headers.length > 6 && (
                    <TableCell sx={{ fontSize: 11, color: "text.disabled" }}>
                      +{headers.length - 6} colunas
                    </TableCell>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {preview.map((row, i) => (
                  <TableRow key={i}>
                    {headers.slice(0, 6).map((h) => (
                      <TableCell key={h} sx={{ fontSize: 11, maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {row[h] ?? ""}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Nenhuma linha para exibir.
          </Typography>
        )}
      </Box>

      {/* Right: mapping config */}
      <Box sx={{ width: { xs: "100%", md: 320 }, flexShrink: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        {/* Template select */}
        {templates.length > 0 && (
          <FormControl fullWidth size="small">
            <InputLabel>{m.csvImport.mapping.templateLabel}</InputLabel>
            <Select
              value=""
              label={m.csvImport.mapping.templateLabel}
              onChange={(e) => applyTemplate(e.target.value)}
              displayEmpty
            >
              <MenuItem value="">— {m.csvImport.mapping.templateNone} —</MenuItem>
              {templates.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <Divider />
        <Typography variant="caption" fontWeight="bold" color="text.secondary">
          {m.csvImport.mapping.columnsTitle.toUpperCase()}
        </Typography>

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
        <ColumnSelect
          label={m.csvImport.mapping.descriptionColumn}
          value={mapping.columns.description ?? ""}
          headers={headers}
          optional
          onChange={(v) => patchColumns({ description: v || undefined })}
        />
        <ColumnSelect
          label={m.csvImport.mapping.categoryColumn}
          value={mapping.columns.category ?? ""}
          headers={headers}
          optional
          onChange={(v) => patchColumns({ category: v || undefined })}
        />
        {mapping.columns.category && (
          <FormControlLabel
            sx={{ ml: 1 }}
            control={
              <Switch
                size="small"
                checked={mapping.onCategoryNotFound === "create"}
                onChange={(e) =>
                  patch({ onCategoryNotFound: e.target.checked ? "create" : "ignore" })
                }
              />
            }
            label={
              <Typography variant="caption">
                {m.csvImport.mapping.createCategoriesLabel}
              </Typography>
            }
          />
        )}
        <ColumnSelect
          label={m.csvImport.mapping.subcategoryColumn}
          value={mapping.columns.subcategory ?? ""}
          headers={headers}
          optional
          onChange={(v) => patchColumns({ subcategory: v || undefined })}
        />
        {mapping.columns.subcategory && (
          <FormControlLabel
            sx={{ ml: 1 }}
            control={
              <Switch
                size="small"
                checked={mapping.onSubcategoryNotFound === "create"}
                onChange={(e) =>
                  patch({ onSubcategoryNotFound: e.target.checked ? "create" : "ignore" })
                }
              />
            }
            label={
              <Typography variant="caption">
                {m.csvImport.mapping.createSubcategoriesLabel}
              </Typography>
            }
          />
        )}
        <ColumnSelect
          label={m.csvImport.mapping.institutionColumn}
          value={mapping.columns.institution ?? ""}
          headers={headers}
          optional
          onChange={(v) => patchColumns({ institution: v || undefined })}
        />
        {mapping.columns.institution && (
          <FormControlLabel
            sx={{ ml: 1 }}
            control={
              <Switch
                size="small"
                checked={mapping.onInstitutionNotFound === "create"}
                onChange={(e) =>
                  patch({ onInstitutionNotFound: e.target.checked ? "create" : "ignore" })
                }
              />
            }
            label={
              <Typography variant="caption">
                {m.csvImport.mapping.createInstitutionsLabel}
              </Typography>
            }
          />
        )}

        {/* Campos adicionais em seção colapsável */}
        <Box
          sx={{ display: "flex", alignItems: "center", cursor: "pointer", mt: 0.5 }}
          onClick={() => setShowAdditional((p) => !p)}
        >
          <Typography variant="caption" fontWeight="bold" color="text.secondary">
            {m.csvImport.mapping.additionalFields.toUpperCase()}
          </Typography>
          <IconButton size="small">
            {showAdditional ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        </Box>
        <Collapse in={showAdditional}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
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
            {/* Responsável — coluna + mapeamento texto→membro */}
            {members.length > 0 && (
              <>
                <ColumnSelect
                  label={m.csvImport.mapping.responsibleUserColumn}
                  value={mapping.columns.responsibleUser ?? ""}
                  headers={headers}
                  optional
                  onChange={(v) => {
                    patchColumns({ responsibleUser: v || undefined });
                    // Limpar mapeamentos anteriores ao trocar de coluna
                    if (!v) patch({ responsibleUserMappings: [] });
                  }}
                />
                {mapping.columns.responsibleUser && distinctResponsibleValues.length > 0 && (
                  <Box sx={{ ml: 1, p: 1.5, bgcolor: "background.default", borderRadius: 1, border: 1, borderColor: "divider" }}>
                    <Typography variant="caption" fontWeight="bold" color="text.secondary" display="block" mb={1}>
                      {m.csvImport.mapping.responsibleUserMappingsTitle}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
                      {m.csvImport.mapping.responsibleUserMappingsHint}
                    </Typography>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      {distinctResponsibleValues.map((text) => {
                        const current = mapping.responsibleUserMappings.find(
                          (rm) => rm.text === text,
                        )?.userId ?? "";
                        return (
                          <Box key={text} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Typography
                              variant="caption"
                              sx={{
                                minWidth: 140,
                                maxWidth: 140,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                fontFamily: "monospace",
                                bgcolor: "background.paper",
                                px: 1,
                                py: 0.5,
                                borderRadius: 0.5,
                                border: 1,
                                borderColor: "divider",
                              }}
                              title={text}
                            >
                              {text}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">→</Typography>
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
                                <MenuItem value="">
                                  <Typography variant="caption" color="text.secondary">
                                    — {m.csvImport.mapping.noMapping} —
                                  </Typography>
                                </MenuItem>
                                {members.map((mem) => (
                                  <MenuItem key={mem.id} value={mem.id}>
                                    <Typography variant="caption">
                                      {mem.name ?? mem.email}
                                    </Typography>
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
              </>
            )}
          </Box>
        </Collapse>

        <Divider />

        {/* Date format */}
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

        {/* Amount format */}
        <FormControl>
          <FormLabel sx={{ fontSize: 12 }}>{m.csvImport.mapping.amountFormatLabel}</FormLabel>
          <RadioGroup
            row
            value={mapping.amountFormat}
            onChange={(e) => patch({ amountFormat: e.target.value as "brl" | "us" })}
          >
            <FormControlLabel value="brl" control={<Radio size="small" />} label={m.csvImport.mapping.amountFormats.brl} />
            <FormControlLabel value="us" control={<Radio size="small" />} label={m.csvImport.mapping.amountFormats.us} />
          </RadioGroup>
        </FormControl>

        {/* Amount sign */}
        <FormControl>
          <FormLabel sx={{ fontSize: 12 }}>{m.csvImport.mapping.amountSignLabel}</FormLabel>
          <RadioGroup
            row
            value={mapping.amountSign}
            onChange={(e) => patch({ amountSign: e.target.value as "raw" | "invert" | "abs" })}
          >
            <FormControlLabel value="raw" control={<Radio size="small" />} label={m.csvImport.mapping.amountSigns.raw} />
            <FormControlLabel value="invert" control={<Radio size="small" />} label={m.csvImport.mapping.amountSigns.invert} />
            <FormControlLabel value="abs" control={<Radio size="small" />} label={m.csvImport.mapping.amountSigns.abs} />
          </RadioGroup>
        </FormControl>

        {/* Advanced toggle */}
        <Box
          sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          onClick={() => setShowAdvanced((p) => !p)}
        >
          <Typography variant="caption" fontWeight="bold" color="text.secondary">
            {m.csvImport.mapping.advancedTitle.toUpperCase()}
          </Typography>
          <IconButton size="small">
            {showAdvanced ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        </Box>

        <Collapse in={showAdvanced}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
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
            <Box sx={{ display: "flex", gap: 1.5 }}>
              <TextField
                label={m.csvImport.mapping.skipRowsLabel}
                type="number"
                value={mapping.skipRows}
                onChange={(e) => patch({ skipRows: Math.max(0, parseInt(e.target.value) || 0) })}
                size="small"
                inputProps={{ min: 0 }}
                sx={{ flex: 1 }}
              />
              <FormControl size="small" sx={{ flex: 1 }}>
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
        </Collapse>
      </Box>
    </Box>
  );
}
