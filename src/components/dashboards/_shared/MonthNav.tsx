"use client";

import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import { AppLink } from "@/components/ui/AppLink";

type MonthOption = {
  id: string;
  year: number;
  month: number;
  label: string;
};

type Props = {
  accountId: string;
  currentMonthId: string;
  currentLabel: string;
  currentYear: number;
  allMonths: MonthOption[];
};

export function MonthNav({ accountId, currentMonthId, currentLabel: _currentLabel, currentYear, allMonths }: Props) {
  const router = useRouter();

  const idx = allMonths.findIndex((m) => m.id === currentMonthId);
  const prev = idx > 0 ? allMonths[idx - 1] : null;
  const next = idx < allMonths.length - 1 ? allMonths[idx + 1] : null;

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
      {/* Breadcrumb: Dashboards > Ano */}
      <Button
        component={AppLink}
        href={`/${accountId}/dashboards/yearly/${currentYear}`}
        size="small"
        variant="text"
        sx={{ color: "text.secondary", fontWeight: "normal", minWidth: 0, px: 1 }}
      >
        Dashboards · {currentYear}
      </Button>

      <Typography variant="body2" color="text.disabled">/</Typography>

      {/* Prev month */}
      <Tooltip title={prev ? prev.label : "Primeiro mês"}>
        <span>
          <Button
            size="small"
            variant="outlined"
            disabled={!prev}
            onClick={() => prev && router.push(`/${accountId}/dashboards/monthly/${prev.id}`)}
            sx={{ minWidth: 36, px: 1 }}
          >
            <ArrowBackIosNewIcon sx={{ fontSize: 14 }} />
          </Button>
        </span>
      </Tooltip>

      {/* Month selector dropdown */}
      <FormControl size="small" sx={{ minWidth: 150 }}>
        <Select
          value={currentMonthId}
          onChange={(e) => {
            if (e.target.value !== currentMonthId) {
              router.push(`/${accountId}/dashboards/monthly/${e.target.value}`);
            }
          }}
          startAdornment={<CalendarTodayIcon sx={{ fontSize: 14, mr: 0.5, color: "text.secondary" }} />}
          sx={{ fontWeight: "bold", fontSize: 14 }}
        >
          {allMonths.map((m) => (
            <MenuItem key={m.id} value={m.id} sx={{ fontSize: 13 }}>
              {m.label}
              {m.id === currentMonthId && (
                <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                  (atual)
                </Typography>
              )}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Next month */}
      <Tooltip title={next ? next.label : "Último mês"}>
        <span>
          <Button
            size="small"
            variant="outlined"
            disabled={!next}
            onClick={() => next && router.push(`/${accountId}/dashboards/monthly/${next.id}`)}
            sx={{ minWidth: 36, px: 1 }}
          >
            <ArrowForwardIosIcon sx={{ fontSize: 14 }} />
          </Button>
        </span>
      </Tooltip>
    </Box>
  );
}
