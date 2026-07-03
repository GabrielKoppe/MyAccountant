"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormHelperText from "@mui/material/FormHelperText";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";

import { updateAccountSettingsAction } from "@/actions/account-settings";
import {
  updateAccountSettingsSchema,
  type UpdateAccountSettingsInput,
} from "@/lib/schemas/settings";
import { m } from "@/lib/messages";

type Props = {
  accountId: string;
  defaultValues: UpdateAccountSettingsInput;
  members: { id: string; label: string }[];
};

export function GeneralSettingsForm({ accountId, defaultValues, members }: Props) {
  const { enqueueSnackbar } = useSnackbar();

  const form = useForm<UpdateAccountSettingsInput>({
    resolver: zodResolver(updateAccountSettingsSchema),
    defaultValues,
  });

  async function onSubmit(values: UpdateAccountSettingsInput) {
    const result = await updateAccountSettingsAction(accountId, values);
    if (!result.ok) {
      if (result.error.fieldErrors) {
        Object.entries(result.error.fieldErrors).forEach(([field, message]) => {
          form.setError(field as keyof UpdateAccountSettingsInput, { message });
        });
      } else {
        enqueueSnackbar(result.error.message, { variant: "error" });
      }
      return;
    }
    enqueueSnackbar(m.settings.general.saved, { variant: "success" });
  }

  return (
    <Box component="form" onSubmit={form.handleSubmit(onSubmit)} sx={{ mt: 2 }}>
      <Stack spacing={3} sx={{ justifyContent: "flex-start" }}>
        <Controller
          name="accountName"
          control={form.control}
          render={({ field, fieldState }) => (
            <TextField
              {...field}
              label={m.settings.general.accountNameLabel}
              error={!!fieldState.error}
              helperText={fieldState.error?.message}
              size="small"
              fullWidth
            />
          )}
        />

        <Controller
          name="currency"
          control={form.control}
          render={({ field, fieldState }) => (
            <FormControl error={!!fieldState.error} fullWidth>
              <InputLabel>{m.settings.general.currencyLabel}</InputLabel>
              <Select {...field} size="small" label={m.settings.general.currencyLabel} disabled>
                <MenuItem value="BRL">BRL — Real Brasileiro</MenuItem>
              </Select>
              {fieldState.error && <FormHelperText>{fieldState.error.message}</FormHelperText>}
            </FormControl>
          )}
        />

        <Controller
          name="monthStartDay"
          control={form.control}
          render={({ field, fieldState }) => (
            <TextField
              {...field}
              onChange={(e) => field.onChange(Number(e.target.value))}
              label={m.settings.general.monthStartDayLabel}
              type="number"
              inputProps={{ min: 1, max: 28 }}
              size="small"
              error={!!fieldState.error}
              helperText={fieldState.error?.message ?? m.settings.general.monthStartDayHelper}
              fullWidth
              disabled
            />
          )}
        />

        <Controller
          name="defaultResponsibleUserId"
          control={form.control}
          render={({ field, fieldState }) => (
            <FormControl error={!!fieldState.error} fullWidth>
              <InputLabel>{m.settings.general.defaultResponsibleLabel}</InputLabel>
              <Select
                {...field}
                value={field.value ?? ""}
                onChange={(e) => field.onChange(e.target.value || null)}
                label={m.settings.general.defaultResponsibleLabel}
                size="small"
              >
                <MenuItem value="">{m.settings.general.defaultResponsibleNone}</MenuItem>
                {members.map((member) => (
                  <MenuItem key={member.id} value={member.id}>
                    {member.label}
                  </MenuItem>
                ))}
              </Select>
              {fieldState.error && <FormHelperText>{fieldState.error.message}</FormHelperText>}
            </FormControl>
          )}
        />

        <Controller
          name="invertSignOnMoveByDefault"
          control={form.control}
          render={({ field }) => (
            <FormControl fullWidth>
              <FormControlLabel
                sx={{ ml: 0, mr: 0, justifyContent: "space-between" }}
                labelPlacement="start"
                control={
                  <Switch
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    size="small"
                  />
                }
                label={
                  <Typography variant="body2">
                    {m.settings.general.invertSignOnMoveLabel}
                  </Typography>
                }
              />
              <FormHelperText sx={{ ml: 0 }}>
                {m.settings.general.invertSignOnMoveHelper}
              </FormHelperText>
            </FormControl>
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
