import { AuthCard } from "@/components/auth/AuthCard";
import { SignupForm } from "@/components/auth/SignupForm";
import { AppLink } from "@/components/ui/AppLink";
import { m } from "@/lib/messages";

export default function SignupPage() {
  return (
    <AuthCard
      title={m.auth.signup}
      description={
        <>
          {m.auth.haveAccountQuestion} <AppLink href="/login">{m.auth.login}</AppLink>
        </>
      }
    >
      <SignupForm />
    </AuthCard>
  );
}
