"use client";

import { Controller, useForm, type DefaultValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
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
import { SANDBOX_METRICS } from "@/lib/schemas/sandbox";
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
  treemapConfigSchema,
} from "@/lib/schemas/widget-config";
import type { WidgetDef } from "@/components/dashboards/_core/widget-registry";
import type { StoredWidget } from "@/lib/schemas/dashboard-layout";
import type { ConfigFormOption, WidgetConfigOptions } from "@/lib/queries/widget-config-options";

type Props = {
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

const selectSx = { fontSize: "0.8125rem" };
const menuItemSx = { fontSize: "0.8125rem" };
const radioLabelSx = { "& .MuiFormControlLabel-label": { fontSize: "0.8125rem" } };
const switchLabelSx = { "& .MuiFormControlLabel-label": { fontSize: "0.8125rem" } };

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
                  control={<Radio size="small" />}
                  label={m.settings.dashboards.config.groupByCategory}
                  sx={radioLabelSx}
                />
                <FormControlLabel
                  value="section"
                  control={<Radio size="small" />}
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
                  control={<Radio size="small" />}
                  label={m.settings.dashboards.config.showOnlyAll}
                  sx={radioLabelSx}
                />
                <FormControlLabel
                  value="near_limit"
                  control={<Radio size="small" />}
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
  onSave,
}: {
  widget: StoredWidget;
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
                  control={<Radio size="small" />}
                  label={m.settings.dashboards.config.viewDonut}
                  sx={radioLabelSx}
                />
                <FormControlLabel
                  value="bars"
                  control={<Radio size="small" />}
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
                  control={<Radio size="small" />}
                  label={m.settings.dashboards.config.chartTypePie}
                  sx={radioLabelSx}
                />
                <FormControlLabel
                  value="bar"
                  control={<Radio size="small" />}
                  label={m.settings.dashboards.config.chartTypeBar}
                  sx={radioLabelSx}
                />
                <FormControlLabel
                  value="hbar"
                  control={<Radio size="small" />}
                  label={m.settings.dashboards.config.chartTypeHBar}
                  sx={radioLabelSx}
                />
                <FormControlLabel
                  value="vbar"
                  control={<Radio size="small" />}
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
                  control={<Radio size="small" />}
                  label={m.settings.dashboards.config.heatmapMetricExpense}
                  sx={radioLabelSx}
                />
                <FormControlLabel
                  value="all_activity"
                  control={<Radio size="small" />}
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

// ─── Dispatcher ──────────────────────────────────────────────────────────────

export function WidgetConfigForm({ def, widget, options, onSave }: Props) {
  switch (def.id) {
    case "money-flow":
      return <MoneyFlowForm widget={widget} onSave={onSave} />;
    case "category-treemap":
      return <TreemapForm widget={widget} onSave={onSave} />;
    case "budgets":
      return <BudgetsForm widget={widget} onSave={onSave} />;
    case "top-transactions":
      return <TopTransactionsForm widget={widget} onSave={onSave} />;
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
    default:
      return null;
  }
}
