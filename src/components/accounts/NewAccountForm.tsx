"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import { useSnackbar } from "notistack";

import { createAccountAction } from "@/actions/accounts";
import { createAccountSchema, type CreateAccountInput } from "@/lib/schemas/account";
import { m } from "@/lib/messages";

export function NewAccountForm() {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();

  const form = useForm<CreateAccountInput>({
    resolver: zodResolver(createAccountSchema),
    defaultValues: { name: "" },
  });

  async function onSubmit(values: CreateAccountInput) {
    const result = await createAccountAction(values);

    if (!result.ok) {
      if (result.error.fieldErrors) {
        Object.entries(result.error.fieldErrors).forEach(([field, message]) => {
          form.setError(field as keyof CreateAccountInput, { message });
        });
      } else {
        enqueueSnackbar(result.error.message, { variant: "error" });
      }
      return;
    }

    router.push(`/${result.data.accountId}/setup`);
  }

  return (
    <Box
      component="form"
      onSubmit={form.handleSubmit(onSubmit)}
      sx={{ display: "flex", flexDirection: "column", gap: 2 }}
    >
      <Controller
        name="name"
        control={form.control}
        render={({ field, fieldState }) => (
          <TextField
            {...field}
            label={m.account.accountName}
            placeholder={m.onboarding.accountNamePlaceholder}
            error={!!fieldState.error}
            helperText={fieldState.error?.message}
            fullWidth
            autoFocus
          />
        )}
      />
      <Button
        type="submit"
        variant="contained"
        size="large"
        disabled={form.formState.isSubmitting}
        fullWidth
      >
        {form.formState.isSubmitting ? m.onboarding.creating : m.onboarding.createButton}
      </Button>
    </Box>
  );
}
