import { Suspense } from "react";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";

import { NewAccountForm } from "@/components/accounts/NewAccountForm";
import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";

export default function NewAccountPage() {
  return (
    <Container maxWidth="sm" sx={{ py: layout.page }}>
      <Typography variant="h2" sx={{ mb: layout.micro }}>
        {m.account.newAccountTitle}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: layout.cluster }}>
        {m.account.newAccountSubtitle}
      </Typography>

      <Suspense fallback={<CircularProgress size={24} />}>
        <NewAccountForm />
      </Suspense>
    </Container>
  );
}
