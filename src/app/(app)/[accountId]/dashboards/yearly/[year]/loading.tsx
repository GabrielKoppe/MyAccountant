"use client";

import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";

import { layout } from "@/lib/design-tokens";

export default function YearlyDashboardLoading() {
  return (
    <Box sx={{ p: layout.page }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <Skeleton variant="rounded" width={180} height={32} />
        <Box flex={1} />
        <Skeleton variant="rounded" width={100} height={36} />
      </Stack>

      {/* KPI row */}
      <Stack direction="row" spacing={2} mb={3}>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} variant="rounded" width="25%" height={100} />
        ))}
      </Stack>

      {/* Chart skeleton */}
      <Skeleton variant="rounded" width="100%" height={300} sx={{ mb: 3 }} />

      {/* Secondary charts */}
      <Stack direction="row" spacing={2}>
        <Skeleton variant="rounded" width="60%" height={250} />
        <Skeleton variant="rounded" width="40%" height={250} />
      </Stack>
    </Box>
  );
}
