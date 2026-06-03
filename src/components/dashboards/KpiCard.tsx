import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingFlatIcon from "@mui/icons-material/TrendingFlat";
import type { SvgIconComponent } from "@mui/icons-material";

type Props = {
  title: string;
  value: string;
  subtitle?: string;
  delta?: { value: string; positive: boolean } | null;
  icon?: SvgIconComponent;
  color?: "default" | "success" | "warning" | "error" | "info";
};

const colorMap = {
  default: { bg: "background.paper", text: "text.primary" },
  success: { bg: "success.50", text: "success.main" },
  warning: { bg: "warning.50", text: "warning.main" },
  error: { bg: "error.50", text: "error.main" },
  info: { bg: "info.50", text: "info.main" },
} as const;

export function KpiCard({ title, value, subtitle, delta, icon: Icon, color = "default" }: Props) {
  const colors = colorMap[color];

  return (
    <Paper
      variant="outlined"
      sx={{ p: 2.5, bgcolor: colors.bg, height: "100%", display: "flex", flexDirection: "column" }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 1 }}>
        <Typography variant="body2" color="text.secondary" fontWeight="medium">
          {title}
        </Typography>
        {Icon && <Icon sx={{ color: colors.text, fontSize: 20, opacity: 0.7 }} />}
      </Box>

      <Typography variant="h5" fontWeight="bold" color={colors.text} sx={{ mb: 0.5 }}>
        {value}
      </Typography>

      {subtitle && (
        <Typography variant="caption" color="text.secondary">
          {subtitle}
        </Typography>
      )}

      {delta && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: "auto", pt: 1 }}>
          {delta.positive ? (
            <TrendingUpIcon fontSize="small" sx={{ color: "success.main" }} />
          ) : delta.value === "0%" ? (
            <TrendingFlatIcon fontSize="small" sx={{ color: "text.disabled" }} />
          ) : (
            <TrendingDownIcon fontSize="small" sx={{ color: "error.main" }} />
          )}
          <Typography
            variant="caption"
            color={delta.positive ? "success.main" : delta.value === "0%" ? "text.disabled" : "error.main"}
          >
            {delta.value}
          </Typography>
        </Box>
      )}
    </Paper>
  );
}
