"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";

import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";

const forgotPasswordSchema = z.object({
  email: z.string().email("Email invalido"),
});

type FormValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordForm() {
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(_values: FormValues) {
    // TODO Fase 1: implementar com Resend (email de reset)
    setSubmitted(true);
  }

  if (submitted) {
    return <Alert severity="success">{m.auth.resetLinkSent}</Alert>;
  }

  return (
    <Stack component="form" onSubmit={form.handleSubmit(onSubmit)} spacing={layout.stack}>
      <Controller
        name="email"
        control={form.control}
        render={({ field, fieldState }) => (
          <TextField
            {...field}
            label={m.auth.email}
            type="email"
            autoComplete="email"
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
        {m.auth.sendResetLink}
      </Button>
    </Stack>
  );
}
