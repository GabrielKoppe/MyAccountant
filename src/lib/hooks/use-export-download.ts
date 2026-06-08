"use client";

import { useState } from "react";
import { useSnackbar } from "notistack";

import { m } from "@/lib/messages";

export function useExportDownload() {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(false);

  async function download(url: string) {
    setLoading(true);
    try {
      const res = await fetch(url);

      if (res.status === 422) {
        const data = await res.json();
        enqueueSnackbar(data.message ?? m.export.noData, { variant: "info" });
        return;
      }

      if (!res.ok) {
        enqueueSnackbar(m.export.error, { variant: "error" });
        return;
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get("content-disposition");
      const filename = contentDisposition?.match(/filename="([^"]+)"/)?.[1] ?? "export";

      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(href);
    } catch {
      enqueueSnackbar(m.export.error, { variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  return { download, loading };
}
