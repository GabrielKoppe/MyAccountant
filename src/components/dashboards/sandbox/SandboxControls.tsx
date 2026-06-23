"use client";

import { useState } from "react";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormLabel from "@mui/material/FormLabel";
import ListSubheader from "@mui/material/ListSubheader";
import MenuItem from "@mui/material/MenuItem";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Select from "@mui/material/Select";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import { m } from "@/lib/messages";
import type { SandboxConfig } from "@/lib/schemas/sandbox";
import type { SectionMeta } from "@/server/queries/dashboards";
import {
  getValidSeriesBy,
  getValidChartTypes,
  getValidMetrics,
  autoFixConfig,
  SANDBOX_CHART_TYPES,
  SANDBOX_METRICS,
} from "@/lib/schemas/sandbox";

type CategoryMeta = { id: string; name: string };
type MemberMeta = { userId: string; name: string };
type MonthMeta = { id: string; label: string; year: number; month: number };

// Special values for the period select that map to relative period types
const PERIOD_YEAR_ALL = "__year_all__";
const PERIOD_LAST_3 = "__last_3__";
const PERIOD_LAST_6 = "__last_6__";
const PERIOD_CURRENT_MONTH = "__current_month__";

type Props = {
  config: SandboxConfig;
  onChange: (config: SandboxConfig) => void;
  allYears: number[];
  allMonths: MonthMeta[];
  sections: SectionMeta[];
  categories: CategoryMeta[];
  members: MemberMeta[];
};

const labelStyle = {
  fontSize: "0.68rem",
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  color: "text.secondary",
  mb: 0.5,
};

const radioLabelStyle = {
  "& .MuiFormControlLabel-label": { fontSize: "0.8125rem" },
};

function getPeriodSelectValue(config: SandboxConfig): string {
  if (config.periodType === "year") return PERIOD_YEAR_ALL;
  if (config.periodType === "last_3_months") return PERIOD_LAST_3;
  if (config.periodType === "last_6_months") return PERIOD_LAST_6;
  if (config.periodType === "current_month") return PERIOD_CURRENT_MONTH;
  if (config.periodType === "months" && config.monthIds?.length === 1) return config.monthIds[0];
  return PERIOD_YEAR_ALL;
}

export function SandboxControls({
  config,
  onChange,
  allYears,
  allMonths,
  sections,
  categories,
  members,
}: Props) {
  const ms = m.dashboards.sandbox;

  // Track display year separately — controls which months show in the period select
  const [displayYear, setDisplayYear] = useState<number>(
    config.year ?? allYears[0] ?? new Date().getFullYear(),
  );

  function update(partial: Partial<SandboxConfig>) {
    onChange(autoFixConfig({ ...config, ...partial }));
  }

  const validSeriesBy = getValidSeriesBy(config.groupBy);
  const validChartTypes = getValidChartTypes(config.seriesBy);
  const validMetrics = getValidMetrics(config.groupBy);

  const chartTypeLabels: Record<string, string> = {
    bar_grouped: ms.controls.chartBarGrouped,
    bar_stacked: ms.controls.chartBarStacked,
    line: ms.controls.chartLine,
    area: ms.controls.chartArea,
    pie: ms.controls.chartPie,
    donut: ms.controls.chartDonut,
  };

  const metricLabels: Record<string, string> = {
    total: ms.controls.metricTotal,
    income: ms.controls.metricIncome,
    expense: ms.controls.metricExpense,
    count: ms.controls.metricCount,
    avg: ms.controls.metricAvg,
  };

  const periodSelectValue = getPeriodSelectValue(config);
  const monthsForYear = allMonths.filter((m) => m.year === displayYear);

  // Year select is irrelevant for relative period types
  const yearSelectDisabled =
    config.periodType === "last_3_months" ||
    config.periodType === "last_6_months" ||
    config.periodType === "current_month";

  function handleYearChange(year: number) {
    setDisplayYear(year);
    // If current period is year-based, update config too
    if (config.periodType === "year") {
      update({ year });
    }
    // If a specific month from another year was selected, keep config but update display
  }

  function handlePeriodChange(value: string) {
    if (value === PERIOD_YEAR_ALL) {
      update({ periodType: "year", year: displayYear, monthIds: undefined });
    } else if (value === PERIOD_LAST_3) {
      update({ periodType: "last_3_months", year: undefined, monthIds: undefined });
    } else if (value === PERIOD_LAST_6) {
      update({ periodType: "last_6_months", year: undefined, monthIds: undefined });
    } else if (value === PERIOD_CURRENT_MONTH) {
      update({ periodType: "current_month", year: undefined, monthIds: undefined });
    } else {
      // Specific month ID
      update({ periodType: "months", monthIds: [value], year: undefined });
    }
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Period — two selects */}
      <Box>
        <Typography sx={labelStyle}>{ms.controls.period}</Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          {/* Year select */}
          <FormControl size="small" disabled={yearSelectDisabled} sx={{ minWidth: 80 }}>
            <Select
              value={displayYear}
              onChange={(e) => handleYearChange(Number(e.target.value))}
              sx={{ fontSize: "0.8125rem" }}
            >
              {allYears.map((y) => (
                <MenuItem key={y} value={y} sx={{ fontSize: "0.8125rem" }}>
                  {y}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Period / month select */}
          <FormControl size="small" sx={{ flex: 1 }}>
            <Select
              value={periodSelectValue}
              onChange={(e) => handlePeriodChange(e.target.value as string)}
              sx={{ fontSize: "0.8125rem" }}
            >
              {/* Relative / aggregate options */}
              <MenuItem value={PERIOD_YEAR_ALL} sx={{ fontSize: "0.8125rem" }}>
                {ms.controls.periodYearAll}
              </MenuItem>
              <MenuItem value={PERIOD_LAST_3} sx={{ fontSize: "0.8125rem" }}>
                {ms.controls.periodLast3}
              </MenuItem>
              <MenuItem value={PERIOD_LAST_6} sx={{ fontSize: "0.8125rem" }}>
                {ms.controls.periodLast6}
              </MenuItem>
              <MenuItem value={PERIOD_CURRENT_MONTH} sx={{ fontSize: "0.8125rem" }}>
                {ms.controls.periodCurrentMonth}
              </MenuItem>

              {/* Specific months for the selected year */}
              {monthsForYear.length > 0 && [
                <Divider key="divider" />,
                <ListSubheader key="header" sx={{ fontSize: "0.7rem", lineHeight: "28px" }}>
                  {displayYear}
                </ListSubheader>,
                ...monthsForYear.map((m) => (
                  <MenuItem key={m.id} value={m.id} sx={{ fontSize: "0.8125rem" }}>
                    {m.label}
                  </MenuItem>
                )),
              ]}
            </Select>
          </FormControl>
        </Box>
      </Box>

      {/* GroupBy */}
      <Box>
        <Typography sx={labelStyle}>{ms.controls.groupBy}</Typography>
        <RadioGroup
          value={config.groupBy}
          onChange={(e) => update({ groupBy: e.target.value as SandboxConfig["groupBy"] })}
        >
          {(
            [
              ["month",       ms.controls.groupByMonth],
              ["section",     ms.controls.groupBySection],
              ["category",    ms.controls.groupByCategory],
              ["institution", ms.controls.groupByInstitution],
              ["table_type",  ms.controls.groupByTableType],
            ] as const
          ).map(([v, label]) => (
            <FormControlLabel
              key={v}
              value={v}
              control={<Radio size="small" />}
              label={label}
              sx={radioLabelStyle}
            />
          ))}
        </RadioGroup>
      </Box>

      {/* SeriesBy */}
      <Box>
        <Typography sx={labelStyle}>{ms.controls.seriesBy}</Typography>
        <RadioGroup
          value={config.seriesBy}
          onChange={(e) => update({ seriesBy: e.target.value as SandboxConfig["seriesBy"] })}
        >
          {(
            [
              ["none",        ms.controls.seriesByNone],
              ["section",     ms.controls.seriesBySection],
              ["category",    ms.controls.seriesByCategory],
              ["member",      ms.controls.seriesByMember],
              ["institution", ms.controls.seriesByInstitution],
              ["table_type",  ms.controls.seriesByTableType],
            ] as const
          ).map(([v, label]) => (
            <FormControlLabel
              key={v}
              value={v}
              disabled={!validSeriesBy.includes(v)}
              control={<Radio size="small" />}
              label={label}
              sx={radioLabelStyle}
            />
          ))}
        </RadioGroup>
      </Box>

      {/* Metric */}
      <Box>
        <Typography sx={labelStyle}>{ms.controls.metric}</Typography>
        <FormControl fullWidth size="small">
          <Select
            value={validMetrics.includes(config.metric) ? config.metric : validMetrics[0]}
            onChange={(e) => update({ metric: e.target.value as SandboxConfig["metric"] })}
            sx={{ fontSize: "0.8125rem" }}
          >
            {SANDBOX_METRICS.filter((metric) => validMetrics.includes(metric)).map((metric) => (
              <MenuItem key={metric} value={metric} sx={{ fontSize: "0.8125rem" }}>
                {metricLabels[metric]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Chart type */}
      <Box>
        <Typography sx={labelStyle}>{ms.controls.chartType}</Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
          {SANDBOX_CHART_TYPES.map((ct) => {
            const disabled = !validChartTypes.includes(ct);
            const selected = config.chartType === ct;
            return (
              <Chip
                key={ct}
                label={chartTypeLabels[ct]}
                size="small"
                variant={selected ? "filled" : "outlined"}
                color={selected ? "primary" : undefined}
                disabled={disabled}
                onClick={() => !disabled && update({ chartType: ct })}
                sx={{
                  fontSize: "0.7rem",
                  cursor: disabled ? "default" : "pointer",
                  ...(!selected && {
                    borderColor: "border.default",
                    color: disabled ? "text.disabled" : "text.secondary",
                    bgcolor: "background.subtle",
                  }),
                }}
              />
            );
          })}
        </Box>
      </Box>

      {/* Filters */}
      <Accordion disableGutters elevation={0} sx={{ border: 1, borderColor: "divider" }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 36, py: 0 }}>
          <Typography sx={{ fontSize: "0.8125rem", fontWeight: 500 }}>
            {ms.controls.filters}
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0.5, pb: 1 }}>
          <FilterMultiSelect
            label={ms.controls.filterSections}
            items={sections.map((s) => ({ id: s.id, name: s.name }))}
            selected={config.filterSectionIds}
            onChange={(ids) => update({ filterSectionIds: ids })}
          />
          <FilterMultiSelect
            label={ms.controls.filterCategories}
            items={categories}
            selected={config.filterCategoryIds}
            onChange={(ids) => update({ filterCategoryIds: ids })}
          />
          <FilterMultiSelect
            label={ms.controls.filterMembers}
            items={members.map((member) => ({ id: member.userId, name: member.name }))}
            selected={config.filterMemberIds}
            onChange={(ids) => update({ filterMemberIds: ids })}
          />
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}

function FilterMultiSelect({
  label,
  items,
  selected,
  onChange,
}: {
  label: string;
  items: Array<{ id: string; name: string }>;
  selected?: string[];
  onChange: (ids: string[] | undefined) => void;
}) {
  if (items.length === 0) return null;

  const selectedSet = new Set(selected ?? []);
  const allSelected = selectedSet.size === 0;

  return (
    <Box sx={{ mb: 1 }}>
      <FormControl fullWidth size="small">
        <FormLabel
          sx={{
            fontSize: "0.7rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "text.secondary",
            mb: 0.5,
          }}
        >
          {label}
        </FormLabel>
        <Select
          multiple
          displayEmpty
          value={selected ?? []}
          onChange={(e) => {
            const v = e.target.value as string[];
            onChange(v.length === 0 ? undefined : v);
          }}
          renderValue={(v) =>
            (v as string[]).length === 0 ? (
              <Typography component="span" sx={{ fontSize: "0.8125rem", color: "text.secondary" }}>
                {m.dashboards.sandbox.controls.allSelected}
              </Typography>
            ) : (
              <Typography component="span" sx={{ fontSize: "0.8125rem" }}>
                {(v as string[]).length} selecionadas
              </Typography>
            )
          }
          sx={{ fontSize: "0.8125rem" }}
        >
          {/* "All" option that clears the filter */}
          <MenuItem
            value=""
            onClick={() => onChange(undefined)}
            sx={{ fontSize: "0.8125rem", fontStyle: "italic" }}
          >
            <Checkbox
              size="small"
              checked={allSelected}
              indeterminate={false}
              sx={{ p: 0, mr: 1 }}
            />
            {m.dashboards.sandbox.controls.allSelected}
          </MenuItem>
          <Divider />
          {items.map((item) => (
            <MenuItem key={item.id} value={item.id} sx={{ fontSize: "0.8125rem" }}>
              <Checkbox
                size="small"
                checked={selectedSet.has(item.id)}
                sx={{ p: 0, mr: 1 }}
              />
              {item.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
}
