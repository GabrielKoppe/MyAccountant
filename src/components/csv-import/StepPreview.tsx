"use client";

import AutoFixHighOutlinedIcon from "@mui/icons-material/AutoFixHighOutlined";
import AutoFixOffOutlinedIcon from "@mui/icons-material/AutoFixOffOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import DoNotDisturbOnOutlinedIcon from "@mui/icons-material/DoNotDisturbOnOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useMemo, useState } from "react";

import { InstallmentDetectionSection } from "@/components/import/InstallmentDetectionSection";
import { describeAliasImportApplication } from "@/lib/aliases/import-preview";
import type { PreviewRow } from "@/lib/csv-parser";
import type { InstallmentSuggestion } from "@/lib/installment-detector";
import { m } from "@/lib/messages";
import { formatCentsToBrl } from "@/lib/money";
import type { SerializedTransactionAlias } from "@/lib/serializers/transaction-alias";
import type { ImportGroupMatch } from "@/server/services/installment-service";

type Props = {
  previewRows: PreviewRow[];
  /** rowIndexes que o usuário optou por ignorar manualmente */
  manualIgnoredRows?: Set<number>;
  /** Alterna uma linha válida entre "será importada" e "ignorada" */
  onToggleRow?: (rowIndex: number) => void;
  /** Apelidos ativos da Account — resolve o rótulo/preview WYSIWYG das linhas casadas (DD-08) */
  aliases?: SerializedTransactionAlias[];
  /** rowIndexes casadas por um apelido que o usuário optou por NÃO aplicar (DD-16) */
  aliasIgnoredRows?: Set<number>;
  /** Alterna uma linha casada entre "aplica o apelido" e "mantém os valores crus do extrato" */
  onToggleAliasRow?: (rowIndex: number) => void;
  installmentSuggestions?: InstallmentSuggestion[];
  acceptedInstallmentIds?: Set<string>;
  onToggleInstallment?: (id: string) => void;
  /** Parcelamentos existentes casados com cada sugestão (spec 73 §2.3) */
  installmentMatches?: Map<string, ImportGroupMatch>;
  linkedInstallmentIds?: Set<string>;
  onToggleInstallmentLink?: (id: string, link: boolean) => void;
};

export function StepPreview({
  previewRows,
  manualIgnoredRows = new Set(),
  onToggleRow = () => {},
  aliases = [],
  aliasIgnoredRows = new Set(),
  onToggleAliasRow = () => {},
  installmentSuggestions = [],
  acceptedInstallmentIds = new Set(),
  onToggleInstallment = () => {},
  installmentMatches,
  linkedInstallmentIds,
  onToggleInstallmentLink,
}: Props) {
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);
  const aliasById = useMemo(() => new Map(aliases.map((a) => [a.id, a])), [aliases]);

  const isManuallyIgnored = (r: PreviewRow) =>
    r.status === "ok" && manualIgnoredRows.has(r.rowIndex);

  const okCount = previewRows.filter((r) => r.status === "ok" && !isManuallyIgnored(r)).length;
  const ignoredCount =
    previewRows.filter((r) => r.status === "ignored").length +
    previewRows.filter((r) => isManuallyIgnored(r)).length;
  const errorCount = previewRows.filter((r) => r.status === "error").length;
  const aliasAppliedCount = previewRows.filter(
    (r) =>
      r.status === "ok" &&
      !isManuallyIgnored(r) &&
      r.parsed?.appliedAliasId &&
      aliasById.has(r.parsed.appliedAliasId) &&
      !aliasIgnoredRows.has(r.rowIndex),
  ).length;

  const displayed = showErrorsOnly
    ? previewRows.filter((r) => r.status === "error")
    : previewRows.slice(0, 100);

  return (
    <Box>
      {/* Summary */}
      <Box sx={{ display: "flex", gap: 1, mb: 1, flexWrap: "wrap", alignItems: "center" }}>
        <Chip
          icon={<CheckCircleOutlineIcon />}
          label={m.csvImport.preview.okChip(okCount)}
          color="success"
          size="small"
          variant="outlined"
        />
        {ignoredCount > 0 && (
          <Chip
            icon={<RemoveCircleOutlineIcon />}
            label={m.csvImport.preview.ignoredChip(ignoredCount)}
            size="small"
            variant="outlined"
          />
        )}
        {errorCount > 0 && (
          <Chip
            icon={<ErrorOutlineIcon />}
            label={m.csvImport.preview.errorChip(errorCount)}
            color="error"
            size="small"
            variant="outlined"
          />
        )}
        {aliasAppliedCount > 0 && (
          <Chip
            icon={<AutoFixHighOutlinedIcon />}
            label={m.csvImport.preview.aliasChip(aliasAppliedCount)}
            size="small"
            variant="outlined"
            sx={{ color: "accent.primary", borderColor: "accent.primary" }}
          />
        )}
        <Box sx={{ flex: 1 }} />
        {errorCount > 0 && (
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={showErrorsOnly}
                onChange={(e) => setShowErrorsOnly(e.target.checked)}
              />
            }
            label={<Typography variant="caption">{m.csvImport.preview.showErrors}</Typography>}
          />
        )}
      </Box>

      <Typography variant="caption" color="text.secondary" display="block">
        {m.csvImport.preview.toggleHint}
      </Typography>
      <Typography variant="caption" color="text.secondary" gutterBottom display="block">
        {m.csvImport.preview.summary(okCount, ignoredCount, errorCount)}
        {displayed.length < previewRows.length && !showErrorsOnly && (
          <> — {m.csvImport.preview.showingFirst(displayed.length)}</>
        )}
      </Typography>

      {/* Seção de parcelamentos detectados — acima da tabela, fechada por padrão */}
      {installmentSuggestions.length > 0 && (
        <InstallmentDetectionSection
          suggestions={installmentSuggestions}
          acceptedIds={acceptedInstallmentIds}
          onToggle={onToggleInstallment}
          matches={installmentMatches}
          linkedIds={linkedInstallmentIds}
          onToggleLink={onToggleInstallmentLink}
        />
      )}

      <Box sx={{ overflowX: "auto", mt: 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "background.default" }}>
              <TableCell sx={{ fontSize: 11, fontWeight: "bold", width: 40 }}>#</TableCell>
              <TableCell sx={{ fontSize: 11, fontWeight: "bold" }}>Status</TableCell>
              <TableCell sx={{ fontSize: 11, fontWeight: "bold" }}>Data</TableCell>
              <TableCell sx={{ fontSize: 11, fontWeight: "bold" }} align="right">
                Valor
              </TableCell>
              <TableCell sx={{ fontSize: 11, fontWeight: "bold" }}>Descrição</TableCell>
              <TableCell sx={{ fontSize: 11, fontWeight: "bold" }}>Categoria</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {displayed.map((row) => {
              const manual = isManuallyIgnored(row);
              // Linha manualmente ignorada (Status) não é importada — o toggle/preview
              // de apelido fica irrelevante e some junto (achado ui-critique #3).
              const alias =
                !manual && row.parsed?.appliedAliasId
                  ? aliasById.get(row.parsed.appliedAliasId)
                  : undefined;
              const aliasOff = alias ? aliasIgnoredRows.has(row.rowIndex) : false;
              const aliasApplying = Boolean(alias) && !aliasOff;
              const aliasPreview =
                alias && row.parsed ? describeAliasImportApplication(alias, row.parsed) : null;
              const displayDescription =
                aliasApplying && alias && alias.description !== null
                  ? alias.description
                  : row.parsed?.description;
              const displayCategoryName =
                aliasApplying && alias && alias.categoryId !== null
                  ? alias.categoryName
                  : row.parsed?.categoryName;
              return (
                <TableRow
                  key={row.rowIndex}
                  sx={{
                    bgcolor:
                      row.status === "error"
                        ? "error.light"
                        : row.status === "ignored" || manual
                          ? "action.hover"
                          : "inherit",
                    opacity: manual ? 0.7 : 1,
                  }}
                >
                  <TableCell sx={{ fontSize: 11, color: "text.disabled" }}>
                    {row.rowIndex + 1}
                  </TableCell>
                  <TableCell sx={{ fontSize: 11 }}>
                    {row.status === "ok" &&
                      (manual ? (
                        <Tooltip title={m.csvImport.preview.toggleToImport}>
                          <DoNotDisturbOnOutlinedIcon
                            color="warning"
                            fontSize="small"
                            onClick={() => onToggleRow(row.rowIndex)}
                            sx={{ cursor: "pointer" }}
                          />
                        </Tooltip>
                      ) : (
                        <Tooltip title={m.csvImport.preview.toggleToIgnore}>
                          <CheckCircleOutlineIcon
                            color="success"
                            fontSize="small"
                            onClick={() => onToggleRow(row.rowIndex)}
                            sx={{ cursor: "pointer" }}
                          />
                        </Tooltip>
                      ))}
                    {row.status === "error" && (
                      <Tooltip title={row.error ?? "Erro"}>
                        <ErrorOutlineIcon color="error" fontSize="small" />
                      </Tooltip>
                    )}
                    {row.status === "ignored" && (
                      <Tooltip title={row.error ?? "Ignorada"}>
                        <RemoveCircleOutlineIcon sx={{ color: "text.disabled" }} fontSize="small" />
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell sx={{ fontSize: 11, whiteSpace: "nowrap" }}>
                    {row.parsed?.occurredOn ?? "—"}
                  </TableCell>
                  <TableCell sx={{ fontSize: 11, whiteSpace: "nowrap" }} align="right">
                    {row.parsed ? (
                      <Typography
                        component="span"
                        variant="caption"
                        color={row.parsed.amountCents < 0n ? "error.main" : "success.main"}
                        sx={{ textDecoration: manual ? "line-through" : "none" }}
                      >
                        {formatCentsToBrl(row.parsed.amountCents)}
                      </Typography>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell
                    sx={{
                      fontSize: 11,
                      maxWidth: 220,
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
                      {alias && aliasPreview && (
                        <Tooltip
                          title={
                            <Box sx={{ p: 0.5, maxWidth: 280, maxHeight: 320, overflowY: "auto" }}>
                              <Typography variant="caption" fontWeight={600} display="block">
                                {aliasOff
                                  ? m.csvImport.preview.aliasOffHeader(alias.trigger)
                                  : m.csvImport.preview.aliasOnHeader(alias.trigger)}
                              </Typography>
                              {aliasApplying &&
                                aliasPreview.visibleChanges.map((c) => (
                                  <Typography key={c.label} variant="caption" display="block">
                                    {c.label}: {c.oldDisplay} → {c.newDisplay}
                                  </Typography>
                                ))}
                              {aliasApplying && aliasPreview.hiddenFields.length > 0 && (
                                <>
                                  <Typography
                                    variant="caption"
                                    display="block"
                                    sx={{ mt: 0.5, fontWeight: 600 }}
                                  >
                                    {m.csvImport.preview.aliasAlsoDefines}
                                  </Typography>
                                  {aliasPreview.hiddenFields.map((f) => (
                                    <Typography key={f.label} variant="caption" display="block">
                                      {f.label}: {f.display}
                                    </Typography>
                                  ))}
                                </>
                              )}
                              {/* Sem color="text.secondary": o Tooltip inverte fundo/texto
                                  (theme.ts), então um token calibrado pro fundo normal da
                                  app cai pra ~1.6-1.9:1 de contraste aqui — herda a cor do
                                  tooltip (igual às outras linhas deste mesmo popup). */}
                              <Typography
                                variant="caption"
                                display="block"
                                sx={{ mt: 0.5, opacity: 0.75 }}
                              >
                                {aliasOff
                                  ? m.csvImport.preview.aliasClickToApply
                                  : m.csvImport.preview.aliasClickToIgnore}
                              </Typography>
                            </Box>
                          }
                        >
                          <IconButton
                            size="small"
                            onClick={() => onToggleAliasRow(row.rowIndex)}
                            aria-label={m.csvImport.preview.aliasToggleAria(alias.trigger)}
                            sx={{ flexShrink: 0 }}
                          >
                            {aliasOff ? (
                              <AutoFixOffOutlinedIcon
                                fontSize="small"
                                sx={{ color: "text.tertiary" }}
                              />
                            ) : (
                              <AutoFixHighOutlinedIcon
                                fontSize="small"
                                sx={{ color: "accent.primary" }}
                              />
                            )}
                          </IconButton>
                        </Tooltip>
                      )}
                      <Typography
                        component="span"
                        variant="caption"
                        noWrap
                        sx={{ overflow: "hidden", textOverflow: "ellipsis" }}
                      >
                        {row.status === "error" ? row.error : (displayDescription ?? "—")}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ fontSize: 11 }}>{displayCategoryName ?? "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>
    </Box>
  );
}
