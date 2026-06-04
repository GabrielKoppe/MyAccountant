import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

import { LoginForm } from "@/components/auth/LoginForm";
import { AppLink } from "@/components/ui/AppLink";
import { m } from "@/lib/messages";

export default function LoginPage() {
  return (
    <Paper sx={{ p: 4, borderRadius: 2 }}>
      <Typography variant="h6" mb={0.5}>
        {m.auth.login}
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Nao tem conta?{" "}
        <AppLink href="/signup">
          {m.auth.signup}
        </AppLink>
      </Typography>

      <LoginForm />

      <Box sx={{ mt: 2, textAlign: "center" }}>
        <AppLink href="/forgot-password" variant="body2">
          {m.auth.forgotPassword}
        </AppLink>
      </Box>
    </Paper>
  );
}
