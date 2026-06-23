"use client";

import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";

import { formatCentsToBrl } from "@/lib/money";
import type { SandboxConfig, SandboxMetric } from "@/lib/schemas/sandbox";
import type { SandboxResult } from "@/server/queries/sandbox";

const GROUPBY_LABEL: Record<SandboxConfig["groupBy"], string> = {
  month: "Mês",
  section: "Seção",
  category: "Categoria",
  institution: "Instituição",
  table_type: "Tipo de Tabela",
};

type Props = {
  result: SandboxResult;
  config: SandboxConfig;
};

function formatCell(v: number, metric: SandboxMetric): string {
  if (metric === "count") return v.toFixed(0);
  try {
    return formatCentsToBrl(BigInt(Math.round(v * 100)));
  } catch {
    return v.toFixed(2);
  }
}

export function SandboxDataTable({ result, config }: Props) {
  const { rows, series } = result;

  if (rows.length === 0) return null;

  const hasSeries = series.length > 1;

  return (
    <Box sx={{ overflowX: "auto", mt: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
              {GROUPBY_LABEL[config.groupBy]}
            </TableCell>
            {hasSeries ? (
              series.map((s) => (
                <TableCell key={s.key} align="right" sx={{ fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
                  {s.label}
                </TableCell>
              ))
            ) : (
              <TableCell align="right" sx={{ fontSize: 11, fontWeight: 600 }}>
                Valor
              </TableCell>
            )}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.xKey} hover>
              <TableCell sx={{ fontSize: 12 }}>{row.xLabel}</TableCell>
              {hasSeries ? (
                series.map((s) => (
                  <TableCell
                    key={s.key}
                    align="right"
                    sx={{
                      fontSize: 12,
                      fontFamily: "var(--font-jetbrains-mono), 'JetBrains Mono', monospace",
                      fontVariantNumeric: "tabular-nums",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatCell((row[s.key] as number) ?? 0, config.metric)}
                  </TableCell>
                ))
              ) : (
                <TableCell
                  align="right"
                  sx={{
                    fontSize: 12,
                    fontFamily: "var(--font-jetbrains-mono), 'JetBrains Mono', monospace",
                    fontVariantNumeric: "tabular-nums",
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatCell((row["total"] as number) ?? 0, config.metric)}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {config.metric !== "count" && result.grandTotalCents !== 0n && (
        <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Total:{" "}
            <Typography
              component="span"
              variant="caption"
              sx={{
                fontFamily: "var(--font-jetbrains-mono), 'JetBrains Mono', monospace",
                fontWeight: 600,
                color: result.grandTotalCents >= 0n ? "success.main" : "danger.main",
              }}
            >
              {formatCentsToBrl(result.grandTotalCents < 0n ? -result.grandTotalCents : result.grandTotalCents)}
            </Typography>
          </Typography>
        </Box>
      )}
    </Box>
  );
}
