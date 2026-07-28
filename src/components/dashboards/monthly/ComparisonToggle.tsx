"use client";

import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";

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
    <ToggleButtonGroup
      exclusive
      size="small"
      color="primary"
      value={value}
      onChange={(_, newValue: CompareMode | null) => {
        onChange(newValue ?? "none");
      }}
      sx={{ "& .MuiToggleButton-root": { px: "12px", py: "6px", fontSize: 12 } }}
    >
      <ToggleButton value="prevMonth">{m.dashboards.comparison.prevMonth}</ToggleButton>
      <ToggleButton value="prevYear" disabled={!hasPrevYear}>
        {m.dashboards.comparison.prevYear}
      </ToggleButton>
      <ToggleButton value="avg3m" disabled={!hasAvg3m}>
        {m.dashboards.comparison.avg3months}
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
