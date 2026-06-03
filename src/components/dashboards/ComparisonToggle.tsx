"use client";

import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Typography from "@mui/material/Typography";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import { m } from "@/lib/messages";

export type CompareMode = "none" | "prevMonth" | "prevYear" | "avg3m";

type Props = {
  value: CompareMode;
  onChange: (mode: CompareMode) => void;
  hasPrevYear: boolean;
  hasAvg3m: boolean;
};

export function ComparisonToggle({ value, onChange, hasPrevYear, hasAvg3m }: Props) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <CompareArrowsIcon sx={{ fontSize: 18, color: "text.secondary" }} />
      <Typography variant="caption" color="text.secondary" noWrap>
        {m.dashboards.comparison.label}:
      </Typography>
      <FormControl size="small" sx={{ minWidth: 180 }}>
        <Select
          value={value}
          onChange={(e) => onChange(e.target.value as CompareMode)}
          variant="outlined"
          sx={{ fontSize: 13, height: 32 }}
          displayEmpty
        >
          <MenuItem value="none">
            <em>{m.dashboards.comparison.none}</em>
          </MenuItem>
          <MenuItem value="prevMonth">{m.dashboards.comparison.prevMonth}</MenuItem>
          <MenuItem value="prevYear" disabled={!hasPrevYear}>
            {m.dashboards.comparison.prevYear}
            {!hasPrevYear && (
              <Typography variant="caption" color="text.disabled" sx={{ ml: 1 }}>
                (sem dados)
              </Typography>
            )}
          </MenuItem>
          <MenuItem value="avg3m" disabled={!hasAvg3m}>
            {m.dashboards.comparison.avg3months}
            {!hasAvg3m && (
              <Typography variant="caption" color="text.disabled" sx={{ ml: 1 }}>
                (sem dados)
              </Typography>
            )}
          </MenuItem>
        </Select>
      </FormControl>
    </Box>
  );
}
