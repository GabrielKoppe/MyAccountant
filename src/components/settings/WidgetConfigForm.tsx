"use client";

import { Controller, useForm, type DefaultValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import { useState } from "react";
import Collapse from "@mui/material/Collapse";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FilterListIcon from "@mui/icons-material/FilterList";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { m } from "@/lib/messages";
import {
  sandboxConfigSchema,
  SANDBOX_METRICS,
  getValidSeriesBy,
  getValidChartTypes,
  getValidMetrics,
  autoFixConfig,
  type SandboxConfig,
  type SandboxGroupBy,
} from "@/lib/schemas/sandbox";
import {
  budgetsConfigSchema,
  dailyHeatmapConfigSchema,
  filteredTransactionsConfigSchema,
  kpiCustomConfigSchema,
  memberBreakdownConfigSchema,
  moneyFlowConfigSchema,
  pieChartConfigSchema,
  topCategoriesConfigSchema,
  topTransactionsConfigSchema,
  transactionCountConfigSchema,
  treemapConfigSchema,
  weekChartConfigSchema,
} from "@/lib/schemas/widget-config";
import type { DashboardContext, WidgetDef } from "@/components/dashboards/_core/widget-registry";
import type { StoredWidget } from "@/lib/schemas/dashboard-layout";
import type { ConfigFormOption, WidgetConfigOptions } from "@/server/queries/widget-config-options";

type Props = {
  context: DashboardContext;
  def: WidgetDef;
  widget: StoredWidget;
  options: WidgetConfigOptions;
  onSave: (config: unknown) => void;
};

// Resolve os defaults do form a partir do config salvo, caindo nos defaults do
// schema quando ausente/inválido.
function resolveDefaults<S extends z.ZodTypeAny>(schema: S, config: unknown): z.infer<S> {
  const parsed = schema.safeParse(config);
  return parsed.success ? parsed.data : schema.parse({});
}

// ─── Design tokens locais (mesmo padrão do SandboxControls) ─────────────────

const selectSx = { fontSize: "0.75rem" };
const menuItemSx = { fontSize: "0.75rem" };
const radioLabelSx = { "& .MuiFormControlLabel-label": { fontSize: "0.75rem" } };
const radioSx = { py: 1, px: 4, "& .MuiSvgIcon-root": { fontSize: 16, padding: 0 } };
const switchLabelSx = { "& .MuiFormControlLabel-label": { fontSize: "0.75rem" } };

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      sx={{
        fontSize: "0.65rem",
        fontWeight: 400,
        textTransform: "uppercase" as const,
        letterSpacing: "0.06em",
        color: "text.secondary",
        display: "block",
      }}
    >
      {children}
    </Typography>
  );
}

function SaveButton() {
  return (
    <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 0.5 }}>
      <Button
        type="submit"
        variant="contained"
        color="inherit"
        size="small"
        fullWidth
        sx={{ fontSize: "0.8rem", mt: 1 }}
      >
        {m.settings.dashboards.configSave}
      </Button>
    </Box>
  );
}

const METRIC_LABELS: Record<(typeof SANDBOX_METRICS)[number], string> = {
  total: m.dashboards.sandbox.controls.metricTotal,
  income: m.dashboards.sandbox.controls.metricIncome,
  expense: m.dashboards.sandbox.controls.metricExpense,
  count: m.dashboards.sandbox.controls.metricCount,
  avg: m.dashboards.sandbox.controls.metricAvg,
};

// ─── money-flow ──────────────────────────────────────────────────────────────

function MoneyFlowForm({ widget, onSave }: { widget: StoredWidget; onSave: (c: unknown) => void }) {
  const { control, handleSubmit } = useForm<z.infer<typeof moneyFlowConfigSchema>>({
    resolver: zodResolver(moneyFlowConfigSchema),
    defaultValues: resolveDefaults(moneyFlowConfigSchema, widget.config) as DefaultValues<
      z.infer<typeof moneyFlowConfigSchema>
    >,
  });
  return (
    <form onSubmit={handleSubmit(onSave)}>
      <Stack spacing={1}>
        <Box>
          <FieldLabel>{m.settings.dashboards.config.groupByLabel}</FieldLabel>
          <Controller
            control={control}
            name="groupBy"
            render={({ field }) => (
              <RadioGroup {...field}>
                <FormControlLabel
                  value="category"
                  control={<Radio size="small" sx={radioSx} />}
                  label={m.settings.dashboards.config.groupByCategory}
                  sx={radioLabelSx}
                />
                <FormControlLabel
                  value="section"
                  control={<Radio size="small" sx={radioSx} />}
                  label={m.settings.dashboards.config.groupBySection}
                  sx={radioLabelSx}
                />
              </RadioGroup>
            )}
          />
        </Box>
        <SaveButton />
      </Stack>
    </form>
  );
}

// ─── category-treemap ────────────────────────────────────────────────────────

function TreemapForm({ widget, onSave }: { widget: StoredWidget; onSave: (c: unknown) => void }) {
  const { control, handleSubmit } = useForm<z.infer<typeof treemapConfigSchema>>({
    resolver: zodResolver(treemapConfigSchema),
    defaultValues: resolveDefaults(treemapConfigSchema, widget.config) as DefaultValues<
      z.infer<typeof treemapConfigSchema>
    >,
  });
  return (
    <form onSubmit={handleSubmit(onSave)}>
      <Stack spacing={1}>
        <Box>
          <FieldLabel>{m.settings.dashboards.config.topNLabel}</FieldLabel>
          <Controller
            control={control}
            name="topN"
            render={({ field }) => (
              <Select
                size="small"
                fullWidth
                sx={selectSx}
                value={String(field.value)}
                onChange={(e) =>
                  field.onChange(e.target.value === "all" ? "all" : Number(e.target.value))
                }
              >
                {[5, 10, 20].map((n) => (
                  <MenuItem key={n} value={String(n)} sx={menuItemSx}>
                    {m.settings.dashboards.config.topNValue(n)}
                  </MenuItem>
                ))}
                <MenuItem value="all" sx={menuItemSx}>
                  {m.settings.dashboards.config.topNAll}
                </MenuItem>
              </Select>
            )}
          />
        </Box>
        <SaveButton />
      </Stack>
    </form>
  );
}

// ─── budgets ─────────────────────────────────────────────────────────────────

function BudgetsForm({ widget, onSave }: { widget: StoredWidget; onSave: (c: unknown) => void }) {
  const { control, handleSubmit } = useForm<z.infer<typeof budgetsConfigSchema>>({
    resolver: zodResolver(budgetsConfigSchema),
    defaultValues: resolveDefaults(budgetsConfigSchema, widget.config) as DefaultValues<
      z.infer<typeof budgetsConfigSchema>
    >,
  });
  return (
    <form onSubmit={handleSubmit(onSave)}>
      <Stack spacing={1}>
        <Box>
          <FieldLabel>{m.settings.dashboards.config.showOnlyLabel}</FieldLabel>
          <Controller
            control={control}
            name="showOnly"
            render={({ field }) => (
              <RadioGroup {...field}>
                <FormControlLabel
                  value="all"
                  control={<Radio size="small" sx={radioSx} />}
                  label={m.settings.dashboards.config.showOnlyAll}
                  sx={radioLabelSx}
                />
                <FormControlLabel
                  value="near_limit"
                  control={<Radio size="small" sx={radioSx} />}
                  label={m.settings.dashboards.config.showOnlyNearLimit}
                  sx={radioLabelSx}
                />
              </RadioGroup>
            )}
          />
        </Box>
        <SaveButton />
      </Stack>
    </form>
  );
}

// ─── top-transactions ────────────────────────────────────────────────────────

function TopTransactionsForm({
  widget,
  options,
  onSave,
}: {
  widget: StoredWidget;
  options: WidgetConfigOptions;
  onSave: (c: unknown) => void;
}) {
  const { control, handleSubmit } = useForm<z.infer<typeof topTransactionsConfigSchema>>({
    resolver: zodResolver(topTransactionsConfigSchema),
    defaultValues: resolveDefaults(topTransactionsConfigSchema, widget.config) as DefaultValues<
      z.infer<typeof topTransactionsConfigSchema>
    >,
  });
  return (
    <form onSubmit={handleSubmit(onSave)}>
      <Stack spacing={1}>
        <Box>
          <FieldLabel>{m.settings.dashboards.config.limitLabel}</FieldLabel>
          <Controller
            control={control}
            name="limit"
            render={({ field }) => (
              <Select
                size="small"
                fullWidth
                sx={selectSx}
                value={String(field.value)}
                onChange={(e) => field.onChange(Number(e.target.value))}
              >
                {[5, 10, 20].map((n) => (
                  <MenuItem key={n} value={String(n)} sx={menuItemSx}>
                    {n}
                  </MenuItem>
                ))}
              </Select>
            )}
          />
        </Box>
        <Controller
          control={control}
          name="excludeSectionIds"
          render={({ field }) => (
            <OptionsAutocomplete
              label={m.settings.dashboards.config.excludeSectionsLabel}
              options={options.sections}
              value={field.value ?? []}
              onChange={field.onChange}
            />
          )}
        />
        <SaveButton />
      </Stack>
    </form>
  );
}

// ─── member-breakdown ────────────────────────────────────────────────────────

function MemberBreakdownForm({
  widget,
  onSave,
}: {
  widget: StoredWidget;
  onSave: (c: unknown) => void;
}) {
  const { control, handleSubmit } = useForm<z.infer<typeof memberBreakdownConfigSchema>>({
    resolver: zodResolver(memberBreakdownConfigSchema),
    defaultValues: resolveDefaults(memberBreakdownConfigSchema, widget.config) as DefaultValues<
      z.infer<typeof memberBreakdownConfigSchema>
    >,
  });
  return (
    <form onSubmit={handleSubmit(onSave)}>
      <Stack spacing={1}>
        <Box>
          <FieldLabel>{m.settings.dashboards.config.viewLabel}</FieldLabel>
          <Controller
            control={control}
            name="view"
            render={({ field }) => (
              <RadioGroup {...field}>
                <FormControlLabel
                  value="donut"
                  control={<Radio size="small" sx={radioSx} />}
                  label={m.settings.dashboards.config.viewDonut}
                  sx={radioLabelSx}
                />
                <FormControlLabel
                  value="bars"
                  control={<Radio size="small" sx={radioSx} />}
                  label={m.settings.dashboards.config.viewBars}
                  sx={radioLabelSx}
                />
              </RadioGroup>
            )}
          />
        </Box>
        <SaveButton />
      </Stack>
    </form>
  );
}

// ─── top-categories ───────────────────────────────────────────────────────

function TopCategoriesForm({
  widget,
  onSave,
}: {
  widget: StoredWidget;
  onSave: (c: unknown) => void;
}) {
  const { control, handleSubmit } = useForm<z.infer<typeof topCategoriesConfigSchema>>({
    resolver: zodResolver(topCategoriesConfigSchema),
    defaultValues: resolveDefaults(topCategoriesConfigSchema, widget.config) as DefaultValues<
      z.infer<typeof topCategoriesConfigSchema>
    >,
  });
  return (
    <form onSubmit={handleSubmit(onSave)}>
      <Stack spacing={1}>
        <Box>
          <FieldLabel>{m.settings.dashboards.config.topNLabel}</FieldLabel>
          <Controller
            control={control}
            name="limit"
            render={({ field }) => (
              <Select
                size="small"
                fullWidth
                sx={selectSx}
                value={String(field.value)}
                onChange={(e) => field.onChange(Number(e.target.value))}
              >
                {[5, 10, 20].map((n) => (
                  <MenuItem key={n} value={String(n)} sx={menuItemSx}>
                    {m.settings.dashboards.config.topNValue(n)}
                  </MenuItem>
                ))}
              </Select>
            )}
          />
        </Box>
        <SaveButton />
      </Stack>
    </form>
  );
}

// ─── section-breakdown / category-breakdown (pizza ou barras) ────────────────

function PieChartForm({ widget, onSave }: { widget: StoredWidget; onSave: (c: unknown) => void }) {
  const { control, handleSubmit } = useForm<z.infer<typeof pieChartConfigSchema>>({
    resolver: zodResolver(pieChartConfigSchema),
    defaultValues: resolveDefaults(pieChartConfigSchema, widget.config) as DefaultValues<
      z.infer<typeof pieChartConfigSchema>
    >,
  });
  return (
    <form onSubmit={handleSubmit(onSave)}>
      <Stack spacing={1}>
        <Box>
          <FieldLabel>{m.settings.dashboards.config.chartTypeLabel}</FieldLabel>
          <Controller
            control={control}
            name="chartType"
            render={({ field }) => (
              <RadioGroup {...field}>
                <FormControlLabel
                  value="pie"
                  control={<Radio size="small" sx={radioSx} />}
                  label={m.settings.dashboards.config.chartTypePie}
                  sx={radioLabelSx}
                />
                <FormControlLabel
                  value="bar"
                  control={<Radio size="small" sx={radioSx} />}
                  label={m.settings.dashboards.config.chartTypeBar}
                  sx={radioLabelSx}
                />
                <FormControlLabel
                  value="hbar"
                  control={<Radio size="small" sx={radioSx} />}
                  label={m.settings.dashboards.config.chartTypeHBar}
                  sx={radioLabelSx}
                />
                <FormControlLabel
                  value="vbar"
                  control={<Radio size="small" sx={radioSx} />}
                  label={m.settings.dashboards.config.chartTypeVBar}
                  sx={radioLabelSx}
                />
              </RadioGroup>
            )}
          />
        </Box>
        <SaveButton />
      </Stack>
    </form>
  );
}

// ─── daily-heatmap ────────────────────────────────────────────────────────────

function DailyHeatmapForm({
  widget,
  onSave,
}: {
  widget: StoredWidget;
  onSave: (c: unknown) => void;
}) {
  const { control, handleSubmit } = useForm<z.infer<typeof dailyHeatmapConfigSchema>>({
    resolver: zodResolver(dailyHeatmapConfigSchema),
    defaultValues: resolveDefaults(dailyHeatmapConfigSchema, widget.config) as DefaultValues<
      z.infer<typeof dailyHeatmapConfigSchema>
    >,
  });
  return (
    <form onSubmit={handleSubmit(onSave)}>
      <Stack spacing={1}>
        <Box>
          <FieldLabel>{m.settings.dashboards.config.heatmapMetricLabel}</FieldLabel>
          <Controller
            control={control}
            name="metric"
            render={({ field }) => (
              <RadioGroup {...field}>
                <FormControlLabel
                  value="expense"
                  control={<Radio size="small" sx={radioSx} />}
                  label={m.settings.dashboards.config.heatmapMetricExpense}
                  sx={radioLabelSx}
                />
                <FormControlLabel
                  value="all_activity"
                  control={<Radio size="small" sx={radioSx} />}
                  label={m.settings.dashboards.config.heatmapMetricAll}
                  sx={radioLabelSx}
                />
              </RadioGroup>
            )}
          />
        </Box>
        <SaveButton />
      </Stack>
    </form>
  );
}

// ─── kpi-custom ──────────────────────────────────────────────────────────────

function OptionsAutocomplete({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ConfigFormOption[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const selected = options.filter((o) => value.includes(o.id));
  return (
    <Box>
      <FieldLabel>{label}</FieldLabel>
      <Autocomplete
        multiple
        size="small"
        options={options}
        value={selected}
        getOptionLabel={(o) => o.name}
        isOptionEqualToValue={(o, v) => o.id === v.id}
        onChange={(_, v) => onChange(v.map((o) => o.id))}
        renderInput={(params) => (
          <TextField
            {...params}
            sx={{ "& input, & .MuiInputBase-root": { fontSize: "0.8125rem" } }}
          />
        )}
        ChipProps={{ size: "small", sx: { fontSize: "0.75rem" } }}
      />
    </Box>
  );
}

function KpiCustomForm({
  widget,
  options,
  onSave,
}: {
  widget: StoredWidget;
  options: WidgetConfigOptions;
  onSave: (c: unknown) => void;
}) {
  const { control, handleSubmit } = useForm<z.infer<typeof kpiCustomConfigSchema>>({
    resolver: zodResolver(kpiCustomConfigSchema),
    defaultValues: resolveDefaults(kpiCustomConfigSchema, widget.config) as DefaultValues<
      z.infer<typeof kpiCustomConfigSchema>
    >,
  });
  return (
    <form onSubmit={handleSubmit(onSave)}>
      <Stack spacing={1.25}>
        <Box>
          <FieldLabel>{m.settings.dashboards.config.labelLabel}</FieldLabel>
          <Controller
            control={control}
            name="label"
            render={({ field }) => (
              <TextField
                {...field}
                value={field.value ?? ""}
                size="small"
                fullWidth
                placeholder={m.settings.dashboards.config.labelPlaceholder}
                sx={{ "& input": { fontSize: "0.8125rem" } }}
              />
            )}
          />
        </Box>
        <Box>
          <FieldLabel>{m.settings.dashboards.config.metricLabel}</FieldLabel>
          <Controller
            control={control}
            name="metric"
            render={({ field }) => (
              <Select size="small" fullWidth sx={selectSx} {...field}>
                {SANDBOX_METRICS.map((metric) => (
                  <MenuItem key={metric} value={metric} sx={menuItemSx}>
                    {METRIC_LABELS[metric]}
                  </MenuItem>
                ))}
              </Select>
            )}
          />
        </Box>
        <Controller
          control={control}
          name="filterSectionIds"
          render={({ field }) => (
            <OptionsAutocomplete
              label={m.settings.dashboards.config.sectionsLabel}
              options={options.sections}
              value={field.value ?? []}
              onChange={field.onChange}
            />
          )}
        />
        <Controller
          control={control}
          name="filterCategoryIds"
          render={({ field }) => (
            <OptionsAutocomplete
              label={m.settings.dashboards.config.categoriesLabel}
              options={options.categories}
              value={field.value ?? []}
              onChange={field.onChange}
            />
          )}
        />
        <Controller
          control={control}
          name="filterMemberIds"
          render={({ field }) => (
            <OptionsAutocomplete
              label={m.settings.dashboards.config.membersLabel}
              options={options.members}
              value={field.value ?? []}
              onChange={field.onChange}
            />
          )}
        />
        <SaveButton />
      </Stack>
    </form>
  );
}

// ─── filtered-transactions ───────────────────────────────────────────────────

function FilteredTransactionsForm({
  widget,
  options,
  onSave,
}: {
  widget: StoredWidget;
  options: WidgetConfigOptions;
  onSave: (c: unknown) => void;
}) {
  const { control, handleSubmit } = useForm<z.infer<typeof filteredTransactionsConfigSchema>>({
    resolver: zodResolver(filteredTransactionsConfigSchema),
    defaultValues: resolveDefaults(
      filteredTransactionsConfigSchema,
      widget.config,
    ) as DefaultValues<z.infer<typeof filteredTransactionsConfigSchema>>,
  });
  return (
    <form onSubmit={handleSubmit(onSave)}>
      <Stack spacing={1.25}>
        <Controller
          control={control}
          name="categories"
          render={({ field }) => (
            <OptionsAutocomplete
              label={m.settings.dashboards.config.categoriesLabel}
              options={options.categories}
              value={field.value ?? []}
              onChange={field.onChange}
            />
          )}
        />
        <Controller
          control={control}
          name="institutions"
          render={({ field }) => (
            <OptionsAutocomplete
              label={m.settings.dashboards.config.institutionsLabel}
              options={options.institutions}
              value={field.value ?? []}
              onChange={field.onChange}
            />
          )}
        />
        <Controller
          control={control}
          name="responsible"
          render={({ field }) => (
            <OptionsAutocomplete
              label={m.settings.dashboards.config.responsibleLabel}
              options={options.members}
              value={field.value ?? []}
              onChange={field.onChange}
            />
          )}
        />
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
          <Controller
            control={control}
            name="pending"
            render={({ field }) => (
              <FormControlLabel
                control={<Switch size="small" checked={field.value} onChange={field.onChange} />}
                label={m.settings.dashboards.config.pendingLabel}
                sx={switchLabelSx}
              />
            )}
          />
          <Controller
            control={control}
            name="favorite"
            render={({ field }) => (
              <FormControlLabel
                control={<Switch size="small" checked={field.value} onChange={field.onChange} />}
                label={m.settings.dashboards.config.favoriteLabel}
                sx={switchLabelSx}
              />
            )}
          />
        </Box>
        <Box>
          <FieldLabel>{m.settings.dashboards.config.limitLabel}</FieldLabel>
          <Controller
            control={control}
            name="limit"
            render={({ field }) => (
              <Select
                size="small"
                fullWidth
                sx={selectSx}
                value={String(field.value)}
                onChange={(e) => field.onChange(Number(e.target.value))}
              >
                <MenuItem value="0" sx={menuItemSx}>
                  Todas
                </MenuItem>
                {[5, 10, 20].map((n) => (
                  <MenuItem key={n} value={String(n)} sx={menuItemSx}>
                    {n}
                  </MenuItem>
                ))}
              </Select>
            )}
          />
        </Box>
        <SaveButton />
      </Stack>
    </form>
  );
}

// ─── analysis (instanciável) ─────────────────────────────────────────────────

const PERIOD_LABELS_MONTHLY: Record<string, string> = {
  current_month: m.dashboards.sandbox.controls.periodCurrentMonth,
  last_3_months: m.dashboards.sandbox.controls.periodLast3,
  last_6_months: m.dashboards.sandbox.controls.periodLast6,
};

const GROUP_BY_LABELS: Record<string, string> = {
  month: m.dashboards.sandbox.controls.groupByMonth,
  section: m.dashboards.sandbox.controls.groupBySection,
  category: m.dashboards.sandbox.controls.groupByCategory,
  institution: m.dashboards.sandbox.controls.groupByInstitution,
  table_type: m.dashboards.sandbox.controls.groupByTableType,
};

const SERIES_BY_LABELS: Record<string, string> = {
  section: m.dashboards.sandbox.controls.seriesBySection,
  category: m.dashboards.sandbox.controls.seriesByCategory,
  member: m.dashboards.sandbox.controls.seriesByMember,
  institution: m.dashboards.sandbox.controls.seriesByInstitution,
  table_type: m.dashboards.sandbox.controls.seriesByTableType,
  none: m.dashboards.sandbox.controls.seriesByNone,
};

const CHART_TYPE_LABELS: Record<string, string> = {
  bar_grouped: m.dashboards.sandbox.controls.chartBarGrouped,
  bar_stacked: m.dashboards.sandbox.controls.chartBarStacked,
  line: m.dashboards.sandbox.controls.chartLine,
  area: m.dashboards.sandbox.controls.chartArea,
  pie: m.dashboards.sandbox.controls.chartPie,
  donut: m.dashboards.sandbox.controls.chartDonut,
};

const METRIC_LABELS_MAP: Record<(typeof SANDBOX_METRICS)[number], string> = {
  total: m.dashboards.sandbox.controls.metricTotal,
  income: m.dashboards.sandbox.controls.metricIncome,
  expense: m.dashboards.sandbox.controls.metricExpense,
  count: m.dashboards.sandbox.controls.metricCount,
  avg: m.dashboards.sandbox.controls.metricAvg,
};

function AnalysisForm({
  widget,
  options,
  context,
  onSave,
}: {
  widget: StoredWidget;
  options: WidgetConfigOptions;
  context: DashboardContext;
  onSave: (c: unknown) => void;
}) {
  const defaults = (() => {
    const parsed = sandboxConfigSchema.safeParse(widget.config);
    if (parsed.success) return parsed.data;
    return context === "yearly"
      ? ({
          periodType: "year",
          year: new Date().getFullYear(),
          groupBy: "category",
          seriesBy: "none",
          metric: "total",
          chartType: "bar_grouped",
        } as SandboxConfig)
      : ({
          periodType: "current_month",
          groupBy: "category",
          seriesBy: "none",
          metric: "total",
          chartType: "bar_grouped",
        } as SandboxConfig);
  })();

  const { control, handleSubmit, watch, setValue } = useForm<SandboxConfig>({
    resolver: zodResolver(sandboxConfigSchema),
    defaultValues: defaults as DefaultValues<SandboxConfig>,
  });

  const groupBy = watch("groupBy") as SandboxGroupBy;
  const seriesBy = watch("seriesBy");
  const metric = watch("metric");
  const chartType = watch("chartType");
  const periodType = watch("periodType");
  const filterSectionIds = watch("filterSectionIds");
  const filterCategoryIds = watch("filterCategoryIds");
  const filterMemberIds = watch("filterMemberIds");

  const validSeriesBy = getValidSeriesBy(groupBy);
  const validChartTypes = getValidChartTypes(seriesBy);
  const validMetrics = getValidMetrics(groupBy);

  function handleGroupByChange(newGroupBy: SandboxGroupBy) {
    const fixed = autoFixConfig({ ...defaults, groupBy: newGroupBy });
    setValue("groupBy", fixed.groupBy);
    setValue("seriesBy", fixed.seriesBy);
    setValue("metric", fixed.metric);
    setValue("chartType", fixed.chartType);
  }

  // ─── Labels e valores para o preview e painel de detalhes ─────────────────
  const _metricLabels: Record<string, string> = {
    total: "Total",
    income: "Entradas",
    expense: "Despesas",
    count: "Qtd. transações",
    avg: "Média",
  };
  const _groupLabels: Record<string, string> = {
    month: "mês a mês",
    section: "por seção",
    category: "por categoria",
    institution: "por instituição",
    table_type: "por tipo de tabela",
  };
  const _seriesLabels: Record<string, string> = {
    section: "por seção",
    category: "por categoria",
    member: "por membro",
    institution: "por instituição",
    table_type: "por tipo de tabela",
  };
  const _chartLabels: Record<string, string> = {
    bar_grouped: "em barras",
    bar_stacked: "em barras empilhadas",
    line: "em linhas",
    area: "em área",
    pie: "em pizza",
    donut: "em rosca",
  };
  // Labels descritivos para o painel de detalhes (mais legíveis que os abreviados acima)
  const _groupDetail: Record<string, string> = {
    month: "Meses",
    section: "Seções",
    category: "Categorias",
    institution: "Instituições",
    table_type: "Tipos de tabela",
  };
  const _seriesDetail: Record<string, string> = {
    section: "Seções",
    category: "Categorias",
    member: "Membros",
    institution: "Instituições",
    table_type: "Tipos de tabela",
  };
  const _chartDetail: Record<string, string> = {
    bar_grouped: "Barras agrupadas",
    bar_stacked: "Barras empilhadas",
    line: "Linhas",
    area: "Área",
    pie: "Pizza",
    donut: "Rosca",
  };
  const _metricDetail: Record<string, string> = {
    total: "Total (líquido)",
    income: "Entradas",
    expense: "Despesas",
    count: "Qtd. transações",
    avg: "Média por transação",
  };

  const periodLabel =
    context === "yearly"
      ? "ano atual"
      : (PERIOD_LABELS_MONTHLY[periodType as keyof typeof PERIOD_LABELS_MONTHLY] ?? periodType);

  const filterNames: string[] = [
    ...(filterSectionIds ?? []).map((id) => options.sections.find((s) => s.id === id)?.name ?? id),
    ...(filterCategoryIds ?? []).map(
      (id) => options.categories.find((c) => c.id === id)?.name ?? id,
    ),
    ...(filterMemberIds ?? []).map(
      (id) => options.members.find((mem) => mem.id === id)?.name ?? id,
    ),
  ];

  const seriesPart =
    seriesBy && seriesBy !== "none" ? ` ${_seriesLabels[seriesBy] ?? seriesBy}` : "";
  const filterPart = filterNames.length > 0 ? ` · filtrado por ${filterNames.join(", ")}` : "";
  const autoName = `${_metricLabels[metric] ?? metric} ${_groupLabels[groupBy] ?? groupBy}${seriesPart} ${_chartLabels[chartType] ?? chartType} (${periodLabel})${filterPart}`;

  const activeFilterCount =
    (filterSectionIds?.length ?? 0) +
    (filterCategoryIds?.length ?? 0) +
    (filterMemberIds?.length ?? 0);

  const [detailOpen, setDetailOpen] = useState(false);

  return (
    <form onSubmit={handleSubmit(onSave)}>
      <Stack spacing={1.25}>
        {/* Preview do nome — clícavel para expandir detalhes do gráfico */}
        <Box>
          <Box
            component="button"
            type="button"
            onClick={() => setDetailOpen((v) => !v)}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              width: "100%",
              background: "none",
              border: "none",
              cursor: "pointer",
              p: 0,
              textAlign: "left",
            }}
          >
            <ExpandMoreIcon
              sx={{
                fontSize: 16,
                color: "text.disabled",
                flexShrink: 0,
                transform: detailOpen ? "rotate(0deg)" : "rotate(-90deg)",
                transition: "transform 150ms ease",
              }}
            />
            <Typography
              variant="caption"
              sx={{ color: "text.secondary", fontWeight: 600, lineHeight: 1.4 }}
            >
              {autoName}
            </Typography>
          </Box>
          <Collapse in={detailOpen}>
            <Box sx={{ mt: 0.75, pl: 2.5, display: "flex", flexDirection: "column", gap: 0.4 }}>
              {(
                [
                  ["Eixo X", _groupDetail[groupBy] ?? groupBy],
                  ["Eixo Y", _metricDetail[metric] ?? metric],
                  ...(seriesBy && seriesBy !== "none"
                    ? ([["Séries", _seriesDetail[seriesBy] ?? seriesBy]] as [string, string][])
                    : []),
                  ["Gráfico", _chartDetail[chartType] ?? chartType],
                  ["Período", periodLabel],
                  ...(filterNames.length > 0
                    ? ([["Filtros", filterNames.join(", ")]] as [string, string][])
                    : []),
                ] as [string, string][]
              ).map(([label, value]) => (
                <Box key={label} sx={{ display: "flex", gap: 0.75 }}>
                  <Typography
                    sx={{
                      fontSize: "0.65rem",
                      color: "text.disabled",
                      flexShrink: 0,
                      minWidth: 52,
                      lineHeight: 1.6,
                    }}
                  >
                    {label}
                  </Typography>
                  <Typography
                    sx={{ fontSize: "0.75rem", color: "text.secondary", lineHeight: 1.6 }}
                  >
                    {value}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Collapse>
        </Box>

        {/* Período — filtrado por contexto */}
        {context === "monthly" && (
          <Box>
            <FieldLabel>{m.dashboards.sandbox.controls.period}</FieldLabel>
            <Controller
              control={control}
              name="periodType"
              render={({ field }) => (
                <RadioGroup {...field}>
                  {Object.entries(PERIOD_LABELS_MONTHLY).map(([value, label]) => (
                    <FormControlLabel
                      key={value}
                      value={value}
                      control={<Radio size="small" sx={radioSx} />}
                      label={label}
                      sx={radioLabelSx}
                    />
                  ))}
                </RadioGroup>
              )}
            />
          </Box>
        )}
        {/* {context === "yearly" && (
          <Typography
            variant="caption"
            sx={{ color: "text.secondary", display: "block", fontStyle: "italic" }}
          >
            {m.settings.dashboards.config.analysisYearNote}
          </Typography>
        )} */}

        {/* Agrupar por */}
        <Box>
          <FieldLabel>{m.dashboards.sandbox.controls.groupBy}</FieldLabel>
          <Controller
            control={control}
            name="groupBy"
            render={({ field }) => (
              <Select
                size="small"
                fullWidth
                sx={selectSx}
                value={field.value}
                onChange={(e) => handleGroupByChange(e.target.value as SandboxGroupBy)}
              >
                {Object.entries(GROUP_BY_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value} sx={menuItemSx}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            )}
          />
        </Box>

        {/* Séries por */}
        <Box>
          <FieldLabel>{m.dashboards.sandbox.controls.seriesBy}</FieldLabel>
          <Controller
            control={control}
            name="seriesBy"
            render={({ field }) => (
              <Select size="small" fullWidth sx={selectSx} {...field}>
                {validSeriesBy.map((value) => (
                  <MenuItem key={value} value={value} sx={menuItemSx}>
                    {SERIES_BY_LABELS[value] ?? value}
                  </MenuItem>
                ))}
              </Select>
            )}
          />
        </Box>

        {/* Métrica */}
        <Box>
          <FieldLabel>{m.dashboards.sandbox.controls.metric}</FieldLabel>
          <Controller
            control={control}
            name="metric"
            render={({ field }) => (
              <Select size="small" fullWidth sx={selectSx} {...field}>
                {validMetrics.map((m2) => (
                  <MenuItem key={m2} value={m2} sx={menuItemSx}>
                    {METRIC_LABELS_MAP[m2]}
                  </MenuItem>
                ))}
              </Select>
            )}
          />
        </Box>

        {/* Tipo de gráfico */}
        <Box>
          <FieldLabel>{m.dashboards.sandbox.controls.chartType}</FieldLabel>
          <Controller
            control={control}
            name="chartType"
            render={({ field }) => (
              <Select size="small" fullWidth sx={selectSx} {...field}>
                {validChartTypes.map((ct) => (
                  <MenuItem key={ct} value={ct} sx={menuItemSx}>
                    {CHART_TYPE_LABELS[ct] ?? ct}
                  </MenuItem>
                ))}
              </Select>
            )}
          />
        </Box>

        {/* Filtros — accordion sem contraste, integrado ao form */}
        <Accordion
          disableGutters
          elevation={0}
          sx={{
            background: "transparent",
            "&:before": { display: "none" },
            borderTop: 1,
            borderColor: "divider",
            mt: 0.5,
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon sx={{ fontSize: 14, color: "text.disabled" }} />}
            sx={{
              minHeight: 32,
              px: 0,
              py: 0,
              "& .MuiAccordionSummary-content": { my: 0.75, alignItems: "center", gap: 0.75 },
            }}
          >
            <FilterListIcon sx={{ fontSize: 13, color: "text.disabled" }} />
            <Typography sx={{ fontSize: "0.75rem", color: "text.tertiary" }}>Filtros</Typography>
            {activeFilterCount > 0 && (
              <Typography
                component="span"
                sx={{
                  fontSize: "0.65rem",
                  color: "primary.main",
                  fontWeight: 600,
                }}
              >
                {activeFilterCount}
              </Typography>
            )}
          </AccordionSummary>
          <AccordionDetails sx={{ px: 0, pb: 1, pt: 0 }}>
            <Stack spacing={1.25}>
              <Controller
                control={control}
                name="filterSectionIds"
                render={({ field }) => (
                  <OptionsAutocomplete
                    label={m.dashboards.sandbox.controls.filterSections}
                    options={options.sections}
                    value={field.value ?? []}
                    onChange={field.onChange}
                  />
                )}
              />
              <Controller
                control={control}
                name="filterCategoryIds"
                render={({ field }) => (
                  <OptionsAutocomplete
                    label={m.dashboards.sandbox.controls.filterCategories}
                    options={options.categories}
                    value={field.value ?? []}
                    onChange={field.onChange}
                  />
                )}
              />
              <Controller
                control={control}
                name="filterMemberIds"
                render={({ field }) => (
                  <OptionsAutocomplete
                    label={m.dashboards.sandbox.controls.filterMembers}
                    options={options.members}
                    value={field.value ?? []}
                    onChange={field.onChange}
                  />
                )}
              />
            </Stack>
          </AccordionDetails>
        </Accordion>

        <SaveButton />
      </Stack>
    </form>
  );
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────

export function WidgetConfigForm({ context, def, widget, options, onSave }: Props) {
  switch (def.id) {
    case "money-flow":
      return <MoneyFlowForm widget={widget} onSave={onSave} />;
    case "category-treemap":
      return <TreemapForm widget={widget} onSave={onSave} />;
    case "budgets":
      return <BudgetsForm widget={widget} onSave={onSave} />;
    case "top-transactions":
      return <TopTransactionsForm widget={widget} options={options} onSave={onSave} />;
    case "member-breakdown":
      return <MemberBreakdownForm widget={widget} onSave={onSave} />;
    case "top-categories":
      return <TopCategoriesForm widget={widget} onSave={onSave} />;
    case "section-breakdown":
    case "category-breakdown":
      return <PieChartForm widget={widget} onSave={onSave} />;
    case "daily-heatmap":
      return <DailyHeatmapForm widget={widget} onSave={onSave} />;
    case "kpi-custom":
      return <KpiCustomForm widget={widget} options={options} onSave={onSave} />;
    case "filtered-transactions":
      return <FilteredTransactionsForm widget={widget} options={options} onSave={onSave} />;
    case "analysis":
      return <AnalysisForm widget={widget} options={options} context={context} onSave={onSave} />;
    // ─── Spec 38 ─────────────────────────────────────────────────────────────
    case "institution-breakdown":
      return <PieChartForm widget={widget} onSave={onSave} />;
    case "week-chart":
      return <WeekChartForm widget={widget} onSave={onSave} />;
    case "kpi-transaction-count":
      return <TransactionCountForm widget={widget} onSave={onSave} />;
    default:
      return null;
  }
}

// ─── Spec 38 — week-chart ─────────────────────────────────────────────────────

function WeekChartForm({ widget, onSave }: { widget: StoredWidget; onSave: (c: unknown) => void }) {
  const { control, handleSubmit } = useForm<z.infer<typeof weekChartConfigSchema>>({
    resolver: zodResolver(weekChartConfigSchema),
    defaultValues: resolveDefaults(weekChartConfigSchema, widget.config) as DefaultValues<
      z.infer<typeof weekChartConfigSchema>
    >,
  });
  return (
    <form onSubmit={handleSubmit(onSave)}>
      <Stack spacing={1}>
        <Box>
          <FieldLabel>{m.settings.dashboards.config.weekMetricLabel}</FieldLabel>
          <Controller
            control={control}
            name="metric"
            render={({ field }) => (
              <RadioGroup {...field}>
                <FormControlLabel
                  value="expense"
                  control={<Radio size="small" sx={radioSx} />}
                  label={m.settings.dashboards.config.weekMetricExpense}
                  sx={radioLabelSx}
                />
                <FormControlLabel
                  value="income"
                  control={<Radio size="small" sx={radioSx} />}
                  label={m.settings.dashboards.config.weekMetricIncome}
                  sx={radioLabelSx}
                />
                <FormControlLabel
                  value="both"
                  control={<Radio size="small" sx={radioSx} />}
                  label={m.settings.dashboards.config.weekMetricBoth}
                  sx={radioLabelSx}
                />
              </RadioGroup>
            )}
          />
        </Box>
        <SaveButton />
      </Stack>
    </form>
  );
}

// ─── Spec 38 — kpi-transaction-count ─────────────────────────────────────────

function TransactionCountForm({
  widget,
  onSave,
}: {
  widget: StoredWidget;
  onSave: (c: unknown) => void;
}) {
  const { control, handleSubmit } = useForm<z.infer<typeof transactionCountConfigSchema>>({
    resolver: zodResolver(transactionCountConfigSchema),
    defaultValues: resolveDefaults(transactionCountConfigSchema, widget.config) as DefaultValues<
      z.infer<typeof transactionCountConfigSchema>
    >,
  });
  return (
    <form onSubmit={handleSubmit(onSave)}>
      <Stack spacing={1}>
        <Box>
          <FieldLabel>{m.settings.dashboards.config.countInMonthLabel}</FieldLabel>
          <Controller
            control={control}
            name="countInMonth"
            render={({ field }) => (
              <RadioGroup {...field}>
                <FormControlLabel
                  value="all"
                  control={<Radio size="small" sx={radioSx} />}
                  label={m.settings.dashboards.config.countInMonthAll}
                  sx={radioLabelSx}
                />
                <FormControlLabel
                  value="only"
                  control={<Radio size="small" sx={radioSx} />}
                  label={m.settings.dashboards.config.countInMonthOnly}
                  sx={radioLabelSx}
                />
              </RadioGroup>
            )}
          />
        </Box>
        <Box>
          <FieldLabel>{m.settings.dashboards.config.sectionTypeLabel}</FieldLabel>
          <Controller
            control={control}
            name="sectionType"
            render={({ field }) => (
              <RadioGroup {...field}>
                <FormControlLabel
                  value="all"
                  control={<Radio size="small" sx={radioSx} />}
                  label={m.settings.dashboards.config.sectionTypeAll}
                  sx={radioLabelSx}
                />
                <FormControlLabel
                  value="subtract"
                  control={<Radio size="small" sx={radioSx} />}
                  label={m.settings.dashboards.config.sectionTypeExpense}
                  sx={radioLabelSx}
                />
                <FormControlLabel
                  value="add"
                  control={<Radio size="small" sx={radioSx} />}
                  label={m.settings.dashboards.config.sectionTypeIncome}
                  sx={radioLabelSx}
                />
              </RadioGroup>
            )}
          />
        </Box>
        <Controller
          control={control}
          name="includePending"
          render={({ field }) => (
            <FormControlLabel
              control={<Switch size="small" checked={field.value} onChange={field.onChange} />}
              label={m.settings.dashboards.config.includePendingLabel}
              sx={switchLabelSx}
            />
          )}
        />
        <SaveButton />
      </Stack>
    </form>
  );
}
