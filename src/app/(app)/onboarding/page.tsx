import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { OnboardingForm } from "./OnboardingForm";

export default function OnboardingPage() {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        p: 4,
      }}
    >
      <Box sx={{ width: "100%", maxWidth: 480 }}>
        <Typography variant="h5" mb={1}>
          Criar sua conta financeira
        </Typography>
        <Typography color="text.secondary" mb={4}>
          Escolha um nome para identificar seu espaco financeiro.
        </Typography>
        <OnboardingForm />
      </Box>
    </Box>
  );
}
