import type { SectionCountType } from "@prisma/client";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import StarIcon from "@mui/icons-material/Star";
import PendingActionsIcon from "@mui/icons-material/PendingActions";

import { AppLink } from "@/components/ui/AppLink";
import { formatCentsToBrl } from "@/lib/money";
import { m } from "@/lib/messages";
import { MonthSectionBarChart } from "./MonthSectionBarChart";
import { CategoryPieChart } from "@/components/dashboards/CategoryPieChart";
import { TransactionQuickList } from "./TransactionQuickList";

type Section = {
  id: string;
  name: string;
  countType: SectionCountType;
  isActive: boolean;
};

type FinanceTableItem = {
  id: string;
  name: string;
  sectionId: string;
  countInMonth: boolean;
};

type QuickTx = {
  id: string;
  description: string | null;
  amountCents: string;
  sectionId: string;
};

type CategoryTotal = {
  categoryId: string;
  name: string;
  totalCents: string;
};

type Props = {
  sections: Section[];
  sectionTotals: Record<string, string>;
  monthTotal: string;
  tables: FinanceTableItem[];
  accountId: string;
  monthId: string;
  pendingTransactions: QuickTx[];
  favoriteTransactions: QuickTx[];
  categoryTotals: CategoryTotal[];
};

const COUNT_TYPE_COLORS: Record<SectionCountType, "success" | "error" | "default" | "warning"> = {
  add: "success",
  subtract: "error",
  ignore: "default",
  neutral: "warning",
};

export function MonthSummary({
  sections,
  sectionTotals,
  monthTotal,
  tables,
  accountId,
  monthId,
  pendingTransactions,
  favoriteTransactions,
  categoryTotals,
}: Props) {
  const totalBigInt = BigInt(monthTotal);
  const isPositive = totalBigInt >= 0n;
  const visibleSections = sections.filter((s) => s.countType !== "ignore");

  return (
    <Box sx={{ p: 3 }}>
      {/* ── Top: total + seções lado a lado ── */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          flexWrap: "wrap",
          mb: 3,
          pb: 2.5,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        {/* Total do mês */}
        <Box sx={{ minWidth: 160 }}>
          <Typography variant="caption" color="text.secondary" display="block">
            {m.months.monthTotal}
          </Typography>
          <Typography
            variant="h4"
            fontWeight="bold"
            color={isPositive ? "success.main" : "error.main"}
          >
            {formatCentsToBrl(totalBigInt)}
          </Typography>
        </Box>

        <Divider orientation="vertical" flexItem />

        {/* Cards compactos por seção */}
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", flex: 1 }}>
          {visibleSections.map((section) => {
            const sectionTotal = BigInt(sectionTotals[section.id] ?? "0");
            const sectionTables = tables.filter((t) => t.sectionId === section.id);
            return (
              <Box
                key={section.id}
                component={AppLink}
                href={`/${accountId}/months/${monthId}?tab=${section.id}`}
                sx={{
                  textDecoration: "none",
                  color: "inherit",
                  p: 1.5,
                  borderRadius: 1,
                  border: 1,
                  borderColor: "divider",
                  minWidth: 130,
                  "&:hover": { bgcolor: "action.hover", borderColor: "primary.main" },
                  transition: "all 0.15s",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {section.name}
                  </Typography>
                  <Chip
                    size="small"
                    label={m.settings.sections.countTypes[section.countType]}
                    color={COUNT_TYPE_COLORS[section.countType]}
                    sx={{ height: 16, fontSize: 10 }}
                  />
                </Box>
                <Typography variant="subtitle2" fontWeight="bold">
                  {formatCentsToBrl(sectionTotal)}
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  {sectionTables.length} {sectionTables.length === 1 ? "tabela" : "tabelas"}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* ── Corpo: gráfico + listas ── */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 320px" },
          gap: 3,
          alignItems: "start",
        }}
      >
        {/* Coluna esquerda: gráficos */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {/* Barras por seção */}
          {visibleSections.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                Por seção — clique para navegar
              </Typography>
              <MonthSectionBarChart
                sections={visibleSections}
                sectionTotals={sectionTotals}
                accountId={accountId}
                monthId={monthId}
              />
            </Paper>
          )}

          {/* Distribuição por categoria */}
          {categoryTotals.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                {m.dashboards.sections.categoryBreakdown}
              </Typography>
              <CategoryPieChart categories={categoryTotals} />
            </Paper>
          )}
        </Box>

        {/* Coluna direita: listas */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {/* Favoritas */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
              <StarIcon sx={{ fontSize: 18, color: "warning.main" }} />
              <Typography variant="subtitle2" fontWeight="bold">
                Favoritas
              </Typography>
              {favoriteTransactions.length > 0 && (
                <Chip label={favoriteTransactions.length} size="small" color="warning" />
              )}
            </Box>
            <TransactionQuickList
              accountId={accountId}
              monthId={monthId}
              transactions={favoriteTransactions}
              mode="favorite"
            />
          </Paper>

          {/* Pendentes */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
              <PendingActionsIcon sx={{ fontSize: 18, color: "info.main" }} />
              <Typography variant="subtitle2" fontWeight="bold">
                Pendentes
              </Typography>
              {pendingTransactions.length > 0 && (
                <Chip label={pendingTransactions.length} size="small" color="info" />
              )}
            </Box>
            <TransactionQuickList
              accountId={accountId}
              monthId={monthId}
              transactions={pendingTransactions}
              mode="pending"
            />
          </Paper>
        </Box>
      </Box>

      {sections.length === 0 && (
        <Typography color="text.secondary" textAlign="center" mt={4}>
          Configure seções em Configurações → Seções para organizar seus dados.
        </Typography>
      )}
    </Box>
  );
}
