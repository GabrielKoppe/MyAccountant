import type { ReactNode } from "react";

import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { layout, typography } from "@/lib/design-tokens";
import { m } from "@/lib/messages";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        p: layout.stack,
      }}
    >
      <Stack spacing={layout.micro} alignItems="center" sx={{ mb: layout.cluster }}>
        <Typography
          variant="h4"
          color="primary"
          sx={{ letterSpacing: typography.letterSpacing.tight }}
        >
          MyAccountant
        </Typography>
        <Typography variant="body2" color="text.tertiary">
          {m.auth.tagline}
        </Typography>
      </Stack>

      <Container maxWidth="xs">{children}</Container>
    </Box>
  );
}
