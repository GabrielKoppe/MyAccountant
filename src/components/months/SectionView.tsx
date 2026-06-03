"use client";

import { useState } from "react";
import type { SectionCountType } from "@prisma/client";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";

import { formatCentsToBrl } from "@/lib/money";
import { m } from "@/lib/messages";
import { CreateTableModal } from "@/components/finance-tables/CreateTableModal";
import { FinanceTableCard } from "@/components/finance-tables/FinanceTableCard";
import { ImportWizard } from "@/components/csv-import/ImportWizard";
import type { CategoryOption, HiddenColumns, InstitutionOption, MemberOption, TransactionRow } from "@/components/transactions/types";

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

type SourceTableOption = { id: string; name: string; sectionName: string; monthYear: string };
type TableTypeOption = { id: string; name: string; isDefault: boolean };
type SectionOption = { id: string; name: string };

type Props = {
  section: Section;
  tables: TableData[];
  sectionTotal: string;
  accountId: string;
  monthId: string;
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
          <Typography variant="h6" fontWeight="bold">
            {section.name}
          </Typography>
          {!section.isActive && (
            <Typography variant="caption" color="text.secondary">
              Seção inativa — somente leitura
            </Typography>
          )}
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Typography variant="h5" fontWeight="bold" color="text.secondary">
            {formatCentsToBrl(BigInt(sectionTotal))}
          </Typography>
          {section.isActive && (
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
          sectionIsActive={section.isActive}
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
