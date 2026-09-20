"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { useRouter } from "next/navigation";

import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import { CreateMonthModal } from "@/components/months/CreateMonthModal";
import type { OnboardingSection } from "./StepSections";

type Props = {
  accountId: string;
  sections: OnboardingSection[];
  lastMonth: { year: number; month: number } | null;
};

export function StepDone({ accountId, sections, lastMonth }: Props) {
  const router = useRouter();

  return (
    <Stack spacing={layout.page} alignItems="center" sx={{ textAlign: "center" }}>
      {/* Ícone de sucesso */}
      <Box
        sx={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          bgcolor: "success.light",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CheckCircleOutlineIcon sx={{ fontSize: 40, color: "success.main" }} />
      </Box>

      {/* Título */}
      <Stack spacing={layout.micro}>
        <Typography variant="h3">{m.setup.done.title}</Typography>
        <Typography variant="body1" color="text.secondary" sx={{ fontSize: "0.9rem" }}>
          {m.setup.done.subtitle}
        </Typography>
      </Stack>

      {/* Resumo */}
      {sections.length > 0 ? (
        <Box
          sx={{
            width: "100%",
            maxWidth: 400,
            bgcolor: "background.subtle",
            borderRadius: "12px",
            border: 1,
            borderColor: "border.subtle",
            overflow: "hidden",
          }}
        >
          <Stack
            direction="row"
            spacing={layout.inline}
            alignItems="center"
            sx={{ px: 2, py: 1.5, bgcolor: "background.surface" }}
          >
            <TableChartOutlinedIcon fontSize="small" sx={{ color: "text.secondary" }} />
            <Typography variant="body2" fontWeight="medium" color="text.secondary">
              {m.setup.done.sectionsCreated(sections.length)}
            </Typography>
          </Stack>
          <Divider />
          <Stack divider={<Divider />}>
            {sections.map((section) => (
              <Typography key={section.id} variant="body2" sx={{ px: 2, py: 1, textAlign: "left" }}>
                {section.name}
              </Typography>
            ))}
          </Stack>
        </Box>
      ) : (
        <Alert
          severity="warning"
          icon={<WarningAmberIcon fontSize="small" />}
          sx={{ maxWidth: 480, textAlign: "left" }}
        >
          {m.setup.done.noSections}
        </Alert>
      )}

      {/* Ações */}
      <Stack spacing={layout.inline} alignItems="center" direction="row">
        <CreateMonthModal accountId={accountId} lastMonth={lastMonth} variant="text" />
        <Button variant="text" color="inherit" onClick={() => router.push(`/${accountId}`)}>
          {m.setup.done.goToAccount}
        </Button>
      </Stack>
    </Stack>
  );
}
