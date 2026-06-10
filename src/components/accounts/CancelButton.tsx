"use client";

import { useRouter, useSearchParams } from "next/navigation";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import { m } from "@/lib/messages";

function isSafeRedirect(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//");
}

export function CancelButton() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");

  function handleCancel() {
    router.push(from && isSafeRedirect(from) ? from : "/select-account");
  }

  return (
    <Tooltip title={m.common.cancel}>
      <IconButton color="inherit" onClick={handleCancel} aria-label={m.common.cancel} sx={{ mr: 1 }}>
        <ArrowBackIcon />
      </IconButton>
    </Tooltip>
  );
}
