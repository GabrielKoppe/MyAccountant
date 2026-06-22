"use client";

import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";

import { layout } from "@/lib/design-tokens";

export default function MonthlyDashboardLoading() {
  return (
    <Box sx={{ p: layout.page }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <Skeleton variant="rounded" width={200} height={32} />
        <Box flex={1} />
        <Skeleton variant="rounded" width={120} height={36} />
      </Stack>

      {/* KPI row */}
      <Stack direction="row" spacing={2} mb={3}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rounded" width="33%" height={100} />
        ))}
      </Stack>

      {/* Charts */}
      <Stack direction="row" spacing={2} mb={3}>
        <Skeleton variant="rounded" width="50%" height={260} />
        <Skeleton variant="rounded" width="50%" height={260} />
      </Stack>

      {/* Bottom row */}
      <Skeleton variant="rounded" width="100%" height={200} />
    </Box>
  );
}
