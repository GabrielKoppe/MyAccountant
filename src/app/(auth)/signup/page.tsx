import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

import { SignupForm } from "@/components/auth/SignupForm";
import { AppLink } from "@/components/ui/AppLink";
import { m } from "@/lib/messages";

export default function SignupPage() {
  return (
    <Paper elevation={2} sx={{ p: 4, borderRadius: 2 }}>
      <Typography variant="h6" fontWeight="bold" mb={0.5}>
        {m.auth.signup}
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Ja tem conta?{" "}
        <AppLink href="/login">
          {m.auth.login}
        </AppLink>
      </Typography>

      <SignupForm />
    </Paper>
  );
}
