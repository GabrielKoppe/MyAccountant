"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";

import { formatCentsToBrl } from "@/lib/money";
import { m } from "@/lib/messages";
import type { PreviewRow } from "@/lib/csv-parser";
import type { InstallmentSuggestion } from "@/lib/installment-detector";
import { InstallmentDetectionSection } from "@/components/import/InstallmentDetectionSection";

type Props = {
  previewRows: PreviewRow[];
  installmentSuggestions?: InstallmentSuggestion[];
  acceptedInstallmentIds?: Set<string>;
  onToggleInstallment?: (id: string) => void;
};

export function StepPreview({
  previewRows,
  installmentSuggestions = [],
  acceptedInstallmentIds = new Set(),
  onToggleInstallment = () => {},
}: Props) {
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);

  const okCount = previewRows.filter((r) => r.status === "ok").length;
  const ignoredCount = previewRows.filter((r) => r.status === "ignored").length;
  const errorCount = previewRows.filter((r) => r.status === "error").length;

  const displayed = showErrorsOnly
    ? previewRows.filter((r) => r.status === "error")
    : previewRows.slice(0, 100);

  return (
    <Box>
      {/* Summary */}
      <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap", alignItems: "center" }}>
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
            {displayed.map((row) => (
              <TableRow
                key={row.rowIndex}
                sx={{
                  bgcolor:
                    row.status === "error"
                      ? "error.subtle"
                      : row.status === "ignored"
                        ? "action.hover"
                        : "inherit",
                }}
              >
                <TableCell sx={{ fontSize: 11, color: "text.disabled" }}>
                  {row.rowIndex + 1}
                </TableCell>
                <TableCell sx={{ fontSize: 11 }}>
                  {row.status === "ok" && (
                    <Tooltip title="Será importada">
                      <CheckCircleOutlineIcon color="success" fontSize="small" />
                    </Tooltip>
                  )}
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
                    maxWidth: 200,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.status === "error" ? row.error : (row.parsed?.description ?? "—")}
                </TableCell>
                <TableCell sx={{ fontSize: 11 }}>{row.parsed?.categoryName ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>

      {/* Seção de parcelamentos detectados já aparece acima da tabela */}
    </Box>
  );
}
