import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { AppLink } from "@/components/ui/AppLink";
import { m } from "@/lib/messages";

export default function ForgotPasswordPage() {
  return (
    <Paper sx={{ p: 4, borderRadius: 2 }}>
      <Typography variant="h6" mb={0.5}>
        Recuperar senha
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Informe seu email e enviaremos um link de recuperacao.{" "}
        <AppLink href="/login">
          {m.auth.login}
        </AppLink>
      </Typography>

      <ForgotPasswordForm />
    </Paper>
  );
}
