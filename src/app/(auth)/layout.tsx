import type { ReactNode } from "react";

import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";

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
        p: 2,
      }}
    >
      <Box sx={{ mb: 4, textAlign: "center" }}>
        <Typography variant="h5" fontWeight="bold" color="primary">
          MyAccountant
        </Typography>
      </Box>
      <Container maxWidth="xs">{children}</Container>
    </Box>
  );
}
