"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import InputAdornment from "@mui/material/InputAdornment";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { updateForecastSettingsAction } from "@/actions/account-settings";
import { m } from "@/lib/messages";
import { centsToBrlInput, parseBrlMaskToCents } from "@/lib/money";
import { forecastSettingsSchema, SCENARIOS, type ForecastSettings } from "@/lib/schemas/forecast";

const HORIZON_OPTIONS = [3, 6, 12, 24] as const;
const VARIABLE_WINDOW_OPTIONS = [3, 6, 12] as const;

/**
 * Defaults vindos do RSC (page.tsx) — já passaram por `forecastSettingsSchema.parse()`
 * lá (todo default resolvido, por isso o tipo de SAÍDA `ForecastSettings`, não
 * `ForecastSettingsInput`: `zodResolver` também infere o Resolver pelo lado de
 * saída quando o schema tem `.default()` em todo campo). `forecastStartBalanceCents`
 * serializado como string|null na fronteira RSC→Client (BigInt não serializa nativo).
 */
export type ForecastSettingsFormDefaults = Omit<ForecastSettings, "forecastStartBalanceCents"> & {
  forecastStartBalanceCents: string | null;
};

type Props = {
  accountId: string;
  defaultValues: ForecastSettingsFormDefaults;
};

export function ForecastSettingsForm({ accountId, defaultValues }: Props) {
  const { enqueueSnackbar } = useSnackbar();

  // Texto exibido no campo de saldo de partida — mantido separado do valor
  // BigInt|null do form para não reformatar a máscara a cada tecla digitada
  // (mesma técnica de `BudgetFormDialog`).
  const [balanceText, setBalanceText] = useState<string>(() =>
    defaultValues.forecastStartBalanceCents !== null
      ? centsToBrlInput(BigInt(defaultValues.forecastStartBalanceCents))
      : "",
  );

  const form = useForm<ForecastSettings>({
    resolver: zodResolver(forecastSettingsSchema),
    defaultValues: {
      ...defaultValues,
      forecastStartBalanceCents:
        defaultValues.forecastStartBalanceCents !== null
          ? BigInt(defaultValues.forecastStartBalanceCents)
          : null,
    },
  });

  async function onSubmit(values: ForecastSettings) {
    const result = await updateForecastSettingsAction(accountId, values);
    if (!result.ok) {
      if (result.error.fieldErrors) {
        Object.entries(result.error.fieldErrors).forEach(([field, message]) => {
          form.setError(field as keyof ForecastSettings, { message });
        });
      } else {
        enqueueSnackbar(result.error.message, { variant: "error" });
      }
      return;
    }
    enqueueSnackbar(m.settings.forecast.saved, { variant: "success" });
  }

  return (
    <Box component="form" onSubmit={form.handleSubmit(onSubmit)} sx={{ mt: 2 }}>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
        {m.settings.forecast.description}
      </Typography>

      <Stack spacing={3} sx={{ justifyContent: "flex-start" }}>
        <Controller
          name="forecastHorizonMonths"
          control={form.control}
          render={({ field, fieldState }) => (
            <FormControl error={!!fieldState.error} fullWidth>
              <InputLabel id="forecast-horizon-label">{m.settings.forecast.horizonLabel}</InputLabel>
              <Select
                size="small"
                labelId="forecast-horizon-label"
                label={m.settings.forecast.horizonLabel}
                value={String(field.value ?? 6)}
                onChange={(e) => field.onChange(Number(e.target.value))}
              >
                {HORIZON_OPTIONS.map((months) => (
                  <MenuItem key={months} value={String(months)}>
                    {m.settings.forecast.horizonOptionLabel(months)}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>
                {fieldState.error?.message ?? m.settings.forecast.horizonHelper}
              </FormHelperText>
            </FormControl>
          )}
        />

        <Controller
          name="forecastScenario"
          control={form.control}
          render={({ field, fieldState }) => (
            <FormControl error={!!fieldState.error} fullWidth>
              <InputLabel id="forecast-scenario-label">{m.settings.forecast.scenarioLabel}</InputLabel>
              <Select
                {...field}
                size="small"
                labelId="forecast-scenario-label"
                label={m.settings.forecast.scenarioLabel}
              >
                {SCENARIOS.map((scenario) => (
                  <MenuItem key={scenario} value={scenario}>
                    {m.settings.forecast.scenarios[scenario]}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>
                {fieldState.error?.message ?? m.settings.forecast.scenarioHelper}
              </FormHelperText>
            </FormControl>
          )}
        />

        <Controller
          name="forecastOptimisticPct"
          control={form.control}
          render={({ field, fieldState }) => (
            <TextField
              {...field}
              onChange={(e) => field.onChange(Number(e.target.value))}
              label={m.settings.forecast.optimisticPctLabel}
              type="number"
              inputProps={{ min: 0, max: 50 }}
              InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
              size="small"
              fullWidth
              error={!!fieldState.error}
              helperText={fieldState.error?.message ?? m.settings.forecast.optimisticPctHelper}
            />
          )}
        />

        <Controller
          name="forecastConservativePct"
          control={form.control}
          render={({ field, fieldState }) => (
            <TextField
              {...field}
              onChange={(e) => field.onChange(Number(e.target.value))}
              label={m.settings.forecast.conservativePctLabel}
              type="number"
              inputProps={{ min: 0, max: 50 }}
              InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
              size="small"
              fullWidth
              error={!!fieldState.error}
              helperText={fieldState.error?.message ?? m.settings.forecast.conservativePctHelper}
            />
          )}
        />

        <Controller
          name="forecastVariableWindow"
          control={form.control}
          render={({ field, fieldState }) => (
            <FormControl error={!!fieldState.error} fullWidth>
              <InputLabel id="forecast-window-label">{m.settings.forecast.variableWindowLabel}</InputLabel>
              <Select
                size="small"
                labelId="forecast-window-label"
                label={m.settings.forecast.variableWindowLabel}
                value={String(field.value ?? 6)}
                onChange={(e) => field.onChange(Number(e.target.value))}
              >
                {VARIABLE_WINDOW_OPTIONS.map((months) => (
                  <MenuItem key={months} value={String(months)}>
                    {m.settings.forecast.variableWindowOptionLabel(months)}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>
                {fieldState.error?.message ?? m.settings.forecast.variableWindowHelper}
              </FormHelperText>
            </FormControl>
          )}
        />

        <Controller
          name="forecastStartBalanceCents"
          control={form.control}
          render={({ field, fieldState }) => (
            <TextField
              label={m.settings.forecast.startBalanceLabel}
              value={balanceText}
              onChange={(e) => {
                const raw = e.target.value;
                setBalanceText(raw);
                const trimmed = raw.trim();
                field.onChange(trimmed === "" ? null : parseBrlMaskToCents(trimmed));
              }}
              onBlur={field.onBlur}
              inputRef={field.ref}
              placeholder="0,00"
              size="small"
              fullWidth
              error={!!fieldState.error}
              helperText={fieldState.error?.message ?? m.settings.forecast.startBalanceHint}
              InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }}
              sx={{ "& input": { fontFamily: "var(--font-jetbrains-mono), monospace" } }}
            />
          )}
        />

        <Button
          type="submit"
          variant="contained"
          size="small"
          disabled={form.formState.isSubmitting}
          sx={{ alignSelf: "flex-end" }}
        >
          {form.formState.isSubmitting ? m.common.loading : m.common.save}
        </Button>
      </Stack>
    </Box>
  );
}
