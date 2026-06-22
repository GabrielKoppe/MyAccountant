"use client";

import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";

import { layout } from "@/lib/design-tokens";

export default function SettingsLoading() {
  return (
    <Box sx={{ p: layout.page }}>
      <Skeleton variant="rounded" width={220} height={32} sx={{ mb: 3 }} />
      {[1, 2, 3, 4].map((i) => (
        <Stack key={i} direction="row" spacing={2} alignItems="center" mb={2}>
          <Skeleton variant="rounded" width="70%" height={44} />
          <Skeleton variant="rounded" width="20%" height={44} />
          <Skeleton variant="rounded" width={44} height={44} />
        </Stack>
      ))}
    </Box>
  );
}
