import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import { formatCentsToBrl } from "@/lib/money";
import { m } from "@/lib/messages";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { WidgetContainer } from "@/components/ui/WidgetContainer";
import { WIDGET_ICONS } from "@/components/dashboards/_core/widget-icons";
import type { TopTransactionsConfig } from "@/lib/schemas/widget-config";

export type TxRow = {
  id: string;
  description: string | null;
  occurredOn: string;
  amountCents: string;
  sectionId: string;
  sectionName: string;
  sectionCountType: string;
  source?: string;
  installmentGroupId?: string | null;
  installmentNumber?: number | null;
  installmentGroupCount?: number | null;
};

function getAmountColor(amountCents: bigint, countType: string): string {
  if (countType === "ignore") return "text.disabled";
  const impact = countType === "subtract" ? -amountCents : amountCents;
  if (impact > 0n) return "success.main";
  if (impact < 0n) return "danger.main";
  return "text.tertiary";
}

export function TxTable({ transactions }: { transactions: TxRow[] }) {
  if (transactions.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Nenhuma transação.
      </Typography>
    );
  }

  return (
    <Box sx={{ overflowX: "auto" }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontSize: 11, whiteSpace: "nowrap" }}>Data</TableCell>
            <TableCell sx={{ fontSize: 11 }}>Descrição</TableCell>
            <TableCell sx={{ fontSize: 11 }}>Seção</TableCell>
            <TableCell sx={{ fontSize: 11 }} align="right">
              Valor
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {transactions.map((tx) => {
            const cents = BigInt(tx.amountCents);
            const amountColor = getAmountColor(cents, tx.sectionCountType);
            const hasInstallment =
              tx.installmentGroupId && tx.installmentNumber && tx.installmentGroupCount;
            return (
              <TableRow key={tx.id} hover>
                <TableCell sx={{ fontSize: 12, whiteSpace: "nowrap" }}>
                  {tx.occurredOn.slice(8, 10)}/{tx.occurredOn.slice(5, 7)}
                </TableCell>
                <TableCell
                  sx={{
                    fontSize: 12,
                    maxWidth: 220,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Box
                      sx={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      {tx.description ?? (
                        <Typography
                          component="span"
                          variant="caption"
                          sx={{ color: "text.disabled", fontStyle: "italic" }}
                        >
                          Sem descrição
                        </Typography>
                      )}
                    </Box>
                    {hasInstallment && (
                      <Tooltip
                        title={`Parcela ${tx.installmentNumber} de ${tx.installmentGroupCount}`}
                      >
                        <Chip
                          label={`${tx.installmentNumber}/${tx.installmentGroupCount}`}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: 10, height: 18, px: 0.25, flexShrink: 0 }}
                        />
                      </Tooltip>
                    )}
                  </Box>
                </TableCell>
                <TableCell sx={{ fontSize: 11 }}>
                  <StatusBadge variant="neutral">{tx.sectionName}</StatusBadge>
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                  <Typography
                    component="span"
                    variant="caption"
                    sx={{
                      fontFamily: "var(--font-jetbrains-mono), 'JetBrains Mono', monospace",
                      fontWeight: 500,
                      fontVariantNumeric: "tabular-nums",
                      color: amountColor,
                    }}
                  >
                    {formatCentsToBrl(cents)}
                  </Typography>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
}

export function TopTransactionTable({
  transactions,
  config,
}: {
  transactions: TxRow[];
  config?: TopTransactionsConfig;
}) {
  const limit = config?.limit ?? 10;
  const excludeIds = config?.excludeSectionIds ?? [];
  const filterSource = config?.filterSource ?? "all";

  let filtered =
    excludeIds.length > 0
      ? transactions.filter((tx) => !excludeIds.includes(tx.sectionId))
      : transactions;

  if (filterSource !== "all") {
    filtered = filtered.filter((tx) => tx.source === filterSource);
  }

  const shown = filtered.slice(0, limit);

  const subtitleParts: string[] = [`Top ${limit}`];
  if (excludeIds.length > 0)
    subtitleParts.push(`${excludeIds.length} seção ignorada${excludeIds.length > 1 ? "s" : ""}`);
  if (filterSource !== "all") subtitleParts.push(`origem: ${filterSource.replace("_", " ")}`);
  const subtitle = subtitleParts.join(" · ");

  return (
    <WidgetContainer
      title={m.dashboards.sections.biggestTransactions}
      icon={WIDGET_ICONS["top-transactions"]}
      subtitle={subtitle}
    >
      <TxTable transactions={shown} />
    </WidgetContainer>
  );
}
