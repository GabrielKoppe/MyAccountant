import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { AppLink } from "@/components/ui/AppLink";
import { formatCentsToBrl } from "@/lib/money";
import type { MonthSummary } from "@/lib/queries/dashboards";

type Props = {
  accountId: string;
  months: MonthSummary[];
  currentMonthId?: string;
};

const MONTH_NAMES = [
  "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function MonthCardGrid({ accountId, months, currentMonthId }: Props) {
  if (months.length === 0) return null;

  return (
    <Box>
      <Typography variant="subtitle2" fontWeight="bold" mb={1.5}>
        Ir para um mês específico
      </Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)", md: "repeat(4, 1fr)", lg: "repeat(6, 1fr)" },
          gap: 1.5,
        }}
      >
        {months.map((m) => {
          const total = BigInt(m.total);
          const isCurrent = m.id === currentMonthId;
          return (
            <Paper
              key={m.id}
              variant="outlined"
              component={AppLink}
              href={`/${accountId}/dashboards/monthly/${m.id}`}
              sx={{
                p: 1.5,
                textDecoration: "none",
                color: "inherit",
                display: "flex",
                flexDirection: "column",
                gap: 0.5,
                borderColor: isCurrent ? "primary.main" : "divider",
                borderWidth: isCurrent ? 2 : 1,
                "&:hover": {
                  bgcolor: "action.hover",
                  borderColor: "primary.main",
                },
                transition: "all 0.15s",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Typography variant="caption" color="text.secondary" fontWeight="medium">
                  {MONTH_NAMES[m.month]}
                </Typography>
                {isCurrent && (
                  <Chip label="atual" size="small" color="primary" sx={{ height: 16, fontSize: 9 }} />
                )}
              </Box>
              <Typography
                variant="body2"
                fontWeight="bold"
                color={total >= 0n ? "success.main" : "error.main"}
                sx={{ fontSize: 13 }}
              >
                {formatCentsToBrl(total)}
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", mt: 0.5 }}>
                <ArrowForwardIcon sx={{ fontSize: 13, color: "text.disabled" }} />
              </Box>
            </Paper>
          );
        })}
      </Box>
    </Box>
  );
}
