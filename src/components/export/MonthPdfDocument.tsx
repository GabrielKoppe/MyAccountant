import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { MonthPdfData } from "@/server/services/export-service";
import { applyFinancialSign, formatDateDDMMYYYY } from "@/lib/export-utils";

// ─── Styles ───────────────────────────────────────────────────────────────────

const COLORS = {
  text: "#1A1815",
  textSecondary: "#4A453C",
  textTertiary: "#7A7368",
  border: "#D8D3C7",
  surface: "#F5F4F0",
  accent: "#4E5FD9",
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: COLORS.text,
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 40,
    backgroundColor: "#FAFAF7",
  },
  // Header
  header: {
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  appName: {
    fontSize: 8,
    color: COLORS.textTertiary,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  accountName: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: COLORS.text,
    marginBottom: 2,
  },
  monthLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  // KPI box
  kpiBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 4,
    padding: 12,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  kpiLabel: {
    fontSize: 8,
    color: COLORS.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  kpiValue: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: COLORS.text,
  },
  // Two-column layout
  twoCol: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  col: {
    flex: 1,
  },
  // Section block
  block: {
    backgroundColor: "#FFFFFF",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 10,
    marginBottom: 12,
  },
  blockTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: COLORS.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  // Row in summary tables
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#F0EDE5",
  },
  rowLabel: {
    fontSize: 9,
    color: COLORS.text,
    flex: 1,
  },
  rowValue: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: COLORS.text,
    textAlign: "right",
  },
  // Transaction table
  txHeader: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    padding: 4,
    borderRadius: 2,
    marginBottom: 2,
  },
  txHeaderCell: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: COLORS.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  txRow: {
    flexDirection: "row",
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#F0EDE5",
  },
  txRowAlt: {
    backgroundColor: "#FAFAF7",
  },
  txCell: {
    fontSize: 8,
    color: COLORS.text,
  },
  // Column widths
  colDate: { width: 55 },
  colDesc: { width: 155, paddingRight: 4 },
  colCat: { width: 115, paddingRight: 4 },
  colAmount: { width: 85, textAlign: "right" },
  // Group headers
  sectionHeader: {
    backgroundColor: COLORS.accent,
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 12,
    marginBottom: 4,
  },
  sectionHeaderText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
  },
  tableHeader: {
    paddingHorizontal: 4,
    paddingVertical: 3,
    marginBottom: 2,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.border,
  },
  tableHeaderText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: COLORS.textSecondary,
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 7,
    color: COLORS.textTertiary,
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMoney(cents: bigint): string {
  const value = Number(cents) / 100;
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return value < 0 ? `-R$ ${formatted}` : `R$ ${formatted}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

type Props = { data: MonthPdfData };

export function MonthPdfDocument({ data }: Props) {
  // Group transactions by section → table
  const groups: Array<{
    section: string;
    tables: Array<{
      name: string;
      rows: typeof data.transactions;
    }>;
  }> = [];

  let currentSection = "";
  let currentTable = "";

  for (const tx of data.transactions) {
    if (tx.sectionName !== currentSection) {
      currentSection = tx.sectionName;
      currentTable = tx.tableName;
      groups.push({ section: currentSection, tables: [{ name: currentTable, rows: [tx] }] });
    } else {
      const lastGroup = groups[groups.length - 1];
      if (tx.tableName !== currentTable) {
        currentTable = tx.tableName;
        lastGroup.tables.push({ name: currentTable, rows: [tx] });
      } else {
        lastGroup.tables[lastGroup.tables.length - 1].rows.push(tx);
      }
    }
  }

  return (
    <Document
      title={`${data.accountName} — ${data.monthLabel}`}
      author="MyAccountant"
      creator="MyAccountant"
    >
      <Page size="A4" style={styles.page}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.appName}>MyAccountant</Text>
          <Text style={styles.accountName}>{data.accountName}</Text>
          <Text style={styles.monthLabel}>{data.monthLabel}</Text>
        </View>

        {/* ── Total do mês ── */}
        <View style={styles.kpiBox}>
          <View>
            <Text style={styles.kpiLabel}>Total do mês</Text>
            <Text style={styles.kpiValue}>{formatMoney(data.monthTotal)}</Text>
          </View>
          <Text style={[styles.kpiLabel, { textAlign: "right" }]}>
            {data.transactions.length} transações
          </Text>
        </View>

        {/* ── Duas colunas: seções + categorias ── */}
        <View style={styles.twoCol}>
          {/* Seções */}
          <View style={styles.col}>
            <View style={styles.block}>
              <Text style={styles.blockTitle}>Por seção</Text>
              {data.sections.map((s) => {
                const displayValue =
                  s.countType === "subtract" ? -s.total : s.total;
                return (
                  <View key={s.name} style={styles.row}>
                    <Text style={styles.rowLabel}>{s.name}</Text>
                    <Text style={styles.rowValue}>{formatMoney(displayValue)}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Top categorias */}
          {data.topCategories.length > 0 && (
            <View style={styles.col}>
              <View style={styles.block}>
                <Text style={styles.blockTitle}>Top categorias</Text>
                {data.topCategories.map((c) => (
                  <View key={c.name} style={styles.row}>
                    <Text style={styles.rowLabel}>{c.name}</Text>
                    <Text style={styles.rowValue}>{formatMoney(c.totalCents)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* ── Lista de transações ── */}
        <Text style={[styles.blockTitle, { marginBottom: 8 }]}>Transações</Text>

        <View style={styles.txHeader}>
          <Text style={[styles.txHeaderCell, styles.colDate]}>Data</Text>
          <Text style={[styles.txHeaderCell, styles.colDesc]}>Descrição</Text>
          <Text style={[styles.txHeaderCell, styles.colCat]}>Categoria</Text>
          <Text style={[styles.txHeaderCell, styles.colAmount]}>Valor</Text>
        </View>

        {groups.map((group) => (
          <View key={group.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{group.section}</Text>
            </View>

            {group.tables.map((table) => (
              <View key={table.name}>
                <View style={styles.tableHeader}>
                  <Text style={styles.tableHeaderText}>{table.name}</Text>
                </View>

                {table.rows.map((tx, i) => {
                  const value = applyFinancialSign(tx.amountCents, tx.sectionCountType);
                  return (
                    <View
                      key={i}
                      style={[styles.txRow, i % 2 === 1 ? styles.txRowAlt : {}]}
                    >
                      <Text style={[styles.txCell, styles.colDate]}>
                        {formatDateDDMMYYYY(tx.occurredOn)}
                      </Text>
                      <Text style={[styles.txCell, styles.colDesc]}>
                        {tx.description ?? "—"}
                        {tx.isPending ? " ⏳" : ""}
                      </Text>
                      <Text style={[styles.txCell, styles.colCat]}>
                        {tx.categoryName ?? ""}
                      </Text>
                      <Text style={[styles.txCell, styles.colAmount]}>
                        {value < 0
                          ? `-R$ ${Math.abs(value).toFixed(2).replace(".", ",")}`
                          : `R$ ${value.toFixed(2).replace(".", ",")}`}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        ))}

        {/* ── Footer ── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>MyAccountant — {data.accountName} — {data.monthLabel}</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
