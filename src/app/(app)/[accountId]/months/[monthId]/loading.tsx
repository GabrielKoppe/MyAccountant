"use client";

import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";

import { layout } from "@/lib/design-tokens";

export default function MonthLoading() {
  return (
    <Box sx={{ p: layout.page }}>
      {/* Header skeleton */}
      <Stack direction="row" alignItems="center" spacing={2} mb={2}>
        <Skeleton variant="rounded" width={200} height={32} />
        <Skeleton variant="rounded" width={80} height={32} />
        <Box flex={1} />
        <Skeleton variant="rounded" width={120} height={36} />
      </Stack>

      {/* Tabs skeleton */}
      <Stack direction="row" spacing={1} mb={3}>
        <Skeleton variant="rounded" width={80} height={36} />
        <Skeleton variant="rounded" width={100} height={36} />
        <Skeleton variant="rounded" width={90} height={36} />
      </Stack>

      {/* Content skeleton — 3 tabelas genéricas */}
      {[1, 2, 3].map((i) => (
        <Box key={i} mb={3}>
          <Skeleton variant="rounded" width={180} height={24} sx={{ mb: 1 }} />
          <Skeleton variant="rounded" width="100%" height={44} sx={{ mb: 0.5 }} />
          <Skeleton variant="rounded" width="100%" height={44} sx={{ mb: 0.5 }} />
          <Skeleton variant="rounded" width="100%" height={44} sx={{ mb: 0.5 }} />
          <Skeleton variant="rounded" width="70%" height={44} />
        </Box>
      ))}
    </Box>
  );
}
