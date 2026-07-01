"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import TextField from "@mui/material/TextField";
import { useSnackbar } from "notistack";

import { signupAction } from "@/actions/auth";
import { signupFormSchema, type SignupFormValues } from "@/lib/schemas/auth";
import { m } from "@/lib/messages";
import { GoogleButton } from "./GoogleButton";

function SignupFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/home";
  const { enqueueSnackbar } = useSnackbar();
  const [isSigningIn, setIsSigningIn] = useState(false);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  async function onSubmit(values: SignupFormValues) {
    const result = await signupAction({
      name: values.name,
      email: values.email,
      password: values.password,
    });

    if (!result.ok) {
      if (result.error.fieldErrors) {
        Object.entries(result.error.fieldErrors).forEach(([field, message]) => {
          form.setError(field as keyof SignupFormValues, { message });
        });
      } else {
        enqueueSnackbar(result.error.message, { variant: "error" });
      }
      return;
    }

    // Auto sign-in apos criar conta
    setIsSigningIn(true);
    const signInResult = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });

    if (signInResult?.error) {
      enqueueSnackbar("Conta criada! Faca login para continuar.", { variant: "info" });
      router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      return;
    }

    enqueueSnackbar(m.auth.accountCreated, { variant: "success" });
    router.push(callbackUrl);
    router.refresh();
  }

  const isLoading = form.formState.isSubmitting || isSigningIn;

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
            label={m.auth.name}
            autoComplete="name"
            error={!!fieldState.error}
            helperText={fieldState.error?.message}
            fullWidth
          />
        )}
      />

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
            label={m.auth.confirmPassword}
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
        disabled={isLoading}
        fullWidth
      >
        {isLoading ? m.auth.creatingAccount : m.auth.signup}
      </Button>

      <Divider>ou</Divider>

      <GoogleButton callbackUrl={callbackUrl} />
    </Box>
  );
}

// Envolver em Suspense porque useSearchParams() requer Suspense boundary no App Router
export function SignupForm() {
  return (
    <Suspense>
      <SignupFormInner />
    </Suspense>
  );
}
