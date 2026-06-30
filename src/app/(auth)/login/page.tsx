import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

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
    <Paper sx={{ p: 4, borderRadius: 2 }}>
      <Typography variant="h6" mb={0.5}>
        {m.auth.login}
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Nao tem conta? <AppLink href="/signup">{m.auth.signup}</AppLink>
      </Typography>

      {isEmailNotAllowed && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {m.auth.emailNotAllowed}
        </Alert>
      )}

      <LoginForm />

      <Box sx={{ mt: 2, textAlign: "center" }}>
        <AppLink href="/forgot-password" variant="body2">
          {m.auth.forgotPassword}
        </AppLink>
      </Box>
    </Paper>
  );
}
