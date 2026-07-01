import Alert from "@mui/material/Alert";

import { AuthCard } from "@/components/auth/AuthCard";
import { LoginForm } from "@/components/auth/LoginForm";
import { AppLink } from "@/components/ui/AppLink";
import { m } from "@/lib/messages";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const isEmailNotAllowed = error === "EmailNotAllowed" || error === "AccessDenied";

  return (
    <AuthCard
      title={m.auth.login}
      description={
        <>
          {m.auth.noAccountQuestion} <AppLink href="/signup">{m.auth.signup}</AppLink>
        </>
      }
      footer={
        <AppLink href="/forgot-password" variant="body2">
          {m.auth.forgotPassword}
        </AppLink>
      }
    >
      {isEmailNotAllowed && <Alert severity="error">{m.auth.emailNotAllowed}</Alert>}
      <LoginForm />
    </AuthCard>
  );
}
