import { AuthCard } from "@/components/auth/AuthCard";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { AppLink } from "@/components/ui/AppLink";
import { m } from "@/lib/messages";

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title={m.auth.forgotPasswordTitle}
      description={
        <>
          {m.auth.forgotPasswordDescription} <AppLink href="/login">{m.auth.login}</AppLink>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
