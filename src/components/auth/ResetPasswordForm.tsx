"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { useSnackbar } from "notistack";

import { resetPasswordAction } from "@/actions/auth";
import { resetPasswordFormSchema, type ResetPasswordFormValues } from "@/lib/schemas/auth";
import { layout } from "@/lib/design-tokens";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const [invalid, setInvalid] = useState(false);

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  async function onSubmit(values: ResetPasswordFormValues) {
    const result = await resetPasswordAction({ token, password: values.password });
    if (result.ok) {
      enqueueSnackbar("Senha redefinida. Faça login.", { variant: "success" });
      router.push("/login");
      return;
    }
    if (result.error.code === "FORBIDDEN") {
      setInvalid(true);
      return;
    }
    if (result.error.fieldErrors) {
      Object.entries(result.error.fieldErrors).forEach(([field, message]) =>
        form.setError(field as keyof ResetPasswordFormValues, { message }),
      );
      return;
    }
    enqueueSnackbar(result.error.message, { variant: "error" });
  }

  if (invalid) {
    return (
      <Stack spacing={layout.stack}>
        <Alert severity="error">Link inválido ou expirado. Solicite um novo.</Alert>
        <Button variant="outlined" href="/forgot-password" fullWidth>
          Solicitar novo link
        </Button>
      </Stack>
    );
  }

  return (
    <Stack component="form" onSubmit={form.handleSubmit(onSubmit)} spacing={layout.stack}>
      <Controller
        name="password"
        control={form.control}
        render={({ field, fieldState }) => (
          <TextField
            {...field}
            label="Nova senha"
            type="password"
            autoComplete="new-password"
            error={!!fieldState.error}
            helperText={fieldState.error?.message}
            fullWidth
          />
        )}
      />
      <Controller
        name="confirmPassword"
        control={form.control}
        render={({ field, fieldState }) => (
          <TextField
            {...field}
            label="Confirmar nova senha"
            type="password"
            autoComplete="new-password"
            error={!!fieldState.error}
            helperText={fieldState.error?.message}
            fullWidth
          />
        )}
      />
      <Button
        type="submit"
        variant="contained"
        size="large"
        fullWidth
        disabled={form.formState.isSubmitting}
      >
        Redefinir senha
      </Button>
    </Stack>
  );
}
