"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";

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
    return (
      <Alert severity="success">
        Se este email estiver cadastrado, voce recebera um link de recuperacao em breve.
      </Alert>
    );
  }

  return (
    <Box
      component="form"
      onSubmit={form.handleSubmit(onSubmit)}
      sx={{ display: "flex", flexDirection: "column", gap: 2 }}
    >
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
        fullWidth
        disabled={form.formState.isSubmitting}
      >
        Enviar link de recuperacao
      </Button>
    </Box>
  );
}
