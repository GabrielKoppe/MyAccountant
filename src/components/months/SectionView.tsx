"use client";

import { useMemo, useState } from "react";
import type { SectionCountType } from "@prisma/client";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";

import { formatCentsToBrl } from "@/lib/money";
import { m } from "@/lib/messages";
import { applyGlobalFilters, useMonthFilters } from "@/components/months/MonthFilterContext";
import { CreateTableModal } from "@/components/finance-tables/CreateTableModal";
import { FinanceTableCard } from "@/components/finance-tables/FinanceTableCard";
import { ImportWizard } from "@/components/csv-import/ImportWizard";
import type {
  CategoryOption,
  HiddenColumns,
  InstitutionOption,
  MemberOption,
  TransactionRow,
} from "@/components/transactions/types";

type Section = {
  id: string;
  name: string;
  countType: SectionCountType;
  isActive: boolean;
};

type TableData = {
  id: string;
  name: string;
  sectionId: string;
  countInMonth: boolean;
  tableTypeName: string | null;
  hiddenColumns: HiddenColumns;
  total: string;
  transactionCount: number;
};

const COUNT_TYPE_LABELS: Record<SectionCountType, string> = {
  add: "Soma ao mês",
  subtract: "Subtrai do mês",
  neutral: "Sinal original",
  ignore: "Não afeta o mês",
};

type SourceTableOption = { id: string; name: string; sectionName: string; monthYear: string };
type TableTypeOption = { id: string; name: string; isDefault: boolean };
type SectionOption = { id: string; name: string };

type Props = {
  section: Section;
  tables: TableData[];
  sectionTotal: string;
  accountId: string;
  monthId: string;
  currentUserId: string;
  canEdit: boolean;
  timezone: string;
  allSections: SectionOption[];
  tableTypes: TableTypeOption[];
  sourceTables: SourceTableOption[];
  transactionsByTable: Record<string, TransactionRow[]>;
  categories: CategoryOption[];
  institutions: InstitutionOption[];
  members: MemberOption[];
  defaultResponsibleUserId: string | null;
};

export function SectionView({
  section,
  tables,
  sectionTotal,
  accountId,
  monthId,
  currentUserId,
  canEdit,
  timezone,
  allSections,
  tableTypes,
  sourceTables,
  transactionsByTable,
  categories,
  institutions,
  members,
  defaultResponsibleUserId,
}: Props) {
  const [duplicateFrom, setDuplicateFrom] = useState<string | null>(null);
  const { filters, isActive: hasGlobalFilters } = useMonthFilters();

  const filteredSectionTotal = useMemo(() => {
    if (!hasGlobalFilters) return null;
    const allSectionTxs = tables.flatMap((t) => transactionsByTable[t.id] ?? []);
    const filtered = applyGlobalFilters(allSectionTxs, filters);
    return filtered.reduce((sum, tx) => sum + BigInt(tx.amountCents), 0n);
  }, [tables, transactionsByTable, filters, hasGlobalFilters]);

  return (
    <Box sx={{ p: 3 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h5">{section.name}</Typography>
          {!section.isActive && (
            <Typography variant="caption" color="text.secondary">
              Seção inativa — somente leitura
            </Typography>
          )}
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
          <Tooltip
            placement="bottom-end"
            title={
              <Box sx={{ minWidth: 210, p: 0.25 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mb: 1 }}
                >
                  {COUNT_TYPE_LABELS[section.countType]}
                </Typography>
                {tables.map((t) => (
                  <Box
                    key={t.id}
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      gap: 2,
                      py: 0.25,
                      opacity: t.countInMonth ? 1 : 0.45,
                    }}
                  >
                    <Typography variant="caption" noWrap sx={{ maxWidth: 140 }}>
                      {t.name}
                      {!t.countInMonth && (
                        <Typography component="span" variant="caption" color="text.disabled">
                          {" "}
                          (não conta)
                        </Typography>
                      )}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ fontVariantNumeric: "tabular-nums", flexShrink: 0 }}
                    >
                      {formatCentsToBrl(BigInt(t.total))}
                    </Typography>
                  </Box>
                ))}
                {tables.length > 0 && <Divider sx={{ my: 1 }} />}
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                  <Typography variant="caption" fontWeight={600}>
                    Total
                  </Typography>
                  <Typography
                    variant="caption"
                    fontWeight={600}
                    sx={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {formatCentsToBrl(BigInt(sectionTotal))}
                  </Typography>
                </Box>
              </Box>
            }
            slotProps={{
              tooltip: {
                sx: {
                  bgcolor: "background.paper",
                  color: "text.primary",
                  border: 1,
                  borderColor: "border.subtle",
                  borderRadius: 2,
                  p: 1.5,
                  boxShadow: 4,
                  maxWidth: 320,
                },
              },
            }}
          >
            <Box sx={{ textAlign: "right", cursor: "default" }}>
              <Typography variant="h5" color="text.secondary">
                {formatCentsToBrl(BigInt(sectionTotal))}
              </Typography>
              {filteredSectionTotal !== null && (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: 0.5,
                  }}
                >
                  <Typography variant="caption" color="warning.main" fontWeight={500}>
                    {formatCentsToBrl(filteredSectionTotal)}
                  </Typography>
                  <Typography variant="caption" color="text.tertiary">
                    {m.transactions.filters.filteredLabel}
                  </Typography>
                  {BigInt(sectionTotal) !== 0n && (
                    <Typography variant="caption" color="text.tertiary">
                      ·{" "}
                      {Math.round(
                        (Math.abs(Number(filteredSectionTotal)) /
                          Math.abs(Number(BigInt(sectionTotal)))) *
                          100,
                      )}
                      %
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          </Tooltip>
          {section.isActive && (
            <>
              <Divider orientation="vertical" flexItem />
              <Box sx={{ display: "flex", gap: 1 }}>
                <CreateTableModal
                  accountId={accountId}
                  monthId={monthId}
                  sections={allSections}
                  tableTypes={tableTypes}
                  preSelectedSectionId={section.id}
                  sourceTables={sourceTables}
                  trigger="button"
                />
                <ImportWizard
                  accountId={accountId}
                  monthId={monthId}
                  sections={allSections}
                  tableTypes={tableTypes}
                  members={members}
                  preSelectedSectionId={section.id}
                />
              </Box>
            </>
          )}
        </Box>
      </Box>

      {tables.length === 0 && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            py: 8,
            color: "text.secondary",
            gap: 2,
          }}
        >
          <TableChartOutlinedIcon sx={{ fontSize: 64, opacity: 0.3 }} />
          <Typography variant="h6">{m.financeTables.noTables}</Typography>
          <Typography variant="body2">{m.financeTables.noTablesHint}</Typography>
          {section.isActive && (
            <CreateTableModal
              accountId={accountId}
              monthId={monthId}
              sections={allSections}
              tableTypes={tableTypes}
              preSelectedSectionId={section.id}
              sourceTables={sourceTables}
              trigger="icon"
            />
          )}
        </Box>
      )}

      {tables.map((table) => (
        <FinanceTableCard
          key={table.id}
          table={table}
          accountId={accountId}
          monthId={monthId}
          currentUserId={currentUserId}
          canEdit={canEdit}
          timezone={timezone}
          sectionIsActive={section.isActive}
          sectionCountType={section.countType}
          transactions={transactionsByTable[table.id] ?? []}
          categories={categories}
          institutions={institutions}
          members={members}
          defaultResponsibleUserId={defaultResponsibleUserId}
          onDuplicate={() => setDuplicateFrom(table.id)}
        />
      ))}

      {duplicateFrom && (
        <CreateTableModal
          accountId={accountId}
          monthId={monthId}
          sections={allSections}
          tableTypes={tableTypes}
          preSelectedSectionId={section.id}
          sourceTables={sourceTables}
          trigger="button"
          onCreated={() => setDuplicateFrom(null)}
        />
      )}
    </Box>
  );
}
