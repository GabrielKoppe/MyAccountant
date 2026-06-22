"use client";

import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";

export function TabContentSkeleton() {
  return (
    <Box sx={{ p: 3 }}>
      {[1, 2, 3].map((i) => (
        <Box key={i} mb={3}>
          <Skeleton variant="rounded" width={160} height={22} sx={{ mb: 1 }} />
          <Skeleton variant="rounded" width="100%" height={44} sx={{ mb: 0.5 }} />
          <Skeleton variant="rounded" width="100%" height={44} sx={{ mb: 0.5 }} />
          <Skeleton variant="rounded" width="100%" height={44} sx={{ mb: 0.5 }} />
          <Skeleton variant="rounded" width="65%" height={44} />
        </Box>
      ))}
    </Box>
  );
}
