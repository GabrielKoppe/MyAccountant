"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import { useSnackbar } from "notistack";

import { resetOnboardingAction } from "@/actions/onboarding";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";

type Props = {
  accountId: string;
};

export function TourResetSection({ accountId }: Props) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleReset() {
    startTransition(async () => {
      const result = await resetOnboardingAction(accountId, {});
      setConfirmOpen(false);
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      enqueueSnackbar(m.setup.tour.resetSuccess, { variant: "success" });
      router.push(`/${accountId}/setup`);
    });
  }

  return (
    <>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: layout.stack,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: layout.inline }}>
          <TravelExploreIcon
            sx={{ color: "text.secondary", mt: 2, ml: layout.inline, flexShrink: 0 }}
          />
          <Box>
            <Typography variant="body2" fontWeight="medium">
              {m.setup.tour.resetTitle}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {m.setup.tour.resetDescription}
            </Typography>
          </Box>
        </Box>
        <Button
          variant="outlined"
          size="small"
          disabled={isPending}
          onClick={() => setConfirmOpen(true)}
          sx={{ flexShrink: 0 }}
        >
          {m.setup.tour.resetButton}
        </Button>
      </Box>

      <SettingsDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        size="confirm"
        title={m.setup.tour.resetConfirmTitle}
        description={m.setup.tour.resetConfirmDescription}
        loading={isPending}
        actions={
          <>
            <Button onClick={() => setConfirmOpen(false)}>{m.common.cancel}</Button>
            <Button variant="contained" onClick={handleReset} disabled={isPending}>
              {m.setup.tour.resetConfirm}
            </Button>
          </>
        }
      />
    </>
  );
}
