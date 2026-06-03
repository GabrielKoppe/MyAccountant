"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import TextField from "@mui/material/TextField";
import { useSnackbar } from "notistack";

import { loginSchema, type LoginInput } from "@/lib/schemas/auth";
import { m } from "@/lib/messages";
import { GoogleButton } from "./GoogleButton";

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/home";
  const { enqueueSnackbar: _enqueueSnackbar } = useSnackbar();
  const [loginError, setLoginError] = useState<string | null>(null);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setLoginError(null);
    const result = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });

    if (result?.error) {
      setLoginError(m.auth.emailOrPasswordIncorrect);
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <Box
      component="form"
      onSubmit={form.handleSubmit(onSubmit)}
      sx={{ display: "flex", flexDirection: "column", gap: 2 }}
    >
      {loginError && <Alert severity="error">{loginError}</Alert>}

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

      <Controller
        name="password"
        control={form.control}
        render={({ field, fieldState }) => (
          <TextField
            {...field}
            label={m.auth.password}
            type="password"
            autoComplete="current-password"
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
        disabled={form.formState.isSubmitting}
        fullWidth
      >
        {form.formState.isSubmitting ? m.auth.signingIn : m.auth.login}
      </Button>

      <Divider>ou</Divider>

      <GoogleButton />
    </Box>
  );
}

// Envolver em Suspense porque useSearchParams() requer Suspense boundary no App Router
export function LoginForm() {
  return (
    <Suspense>
      <LoginFormInner />
    </Suspense>
  );
}
