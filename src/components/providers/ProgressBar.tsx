"use client";

import { AppProgressBar } from "next-nprogress-bar";
import { useTheme } from "@mui/material/styles";

export function ProgressBar() {
  const theme = useTheme();
  return (
    <AppProgressBar
      color={theme.palette.primary.main}
      height="3px"
      options={{ showSpinner: false }}
      shallowRouting
    />
  );
}
