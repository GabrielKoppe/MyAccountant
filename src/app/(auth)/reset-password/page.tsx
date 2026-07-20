import Alert from "@mui/material/Alert";

import { AuthCard } from "@/components/auth/AuthCard";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { AppLink } from "@/components/ui/AppLink";
import { m } from "@/lib/messages";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;

  return (
    <AuthCard
      title="Redefinir senha"
      description={
        <>
          Escolha uma nova senha para sua conta. <AppLink href="/login">{m.auth.login}</AppLink>
        </>
      }
    >
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <Alert severity="error">Link inválido. Solicite um novo em “Esqueci minha senha”.</Alert>
      )}
    </AuthCard>
  );
}
