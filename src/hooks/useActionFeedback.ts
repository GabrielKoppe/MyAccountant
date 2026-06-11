"use client";

import { useSnackbar } from "notistack";
import type { ActionResult } from "@/lib/action-result";

type Options<T> = {
  onSuccess?: (data: T) => void;
  onFieldError?: (fieldErrors: Record<string, string>) => void;
  successMessage?: string;
};

export function useActionFeedback<T>(options: Options<T> = {}) {
  const { enqueueSnackbar } = useSnackbar();

  function handle(result: ActionResult<T>): boolean {
    if (!result.ok) {
      if (result.error.fieldErrors && options.onFieldError) {
        options.onFieldError(result.error.fieldErrors);
      }
      enqueueSnackbar(result.error.message, { variant: "error" });
      return false;
    }

    if (options.successMessage) {
      enqueueSnackbar(options.successMessage, { variant: "success" });
    }
    options.onSuccess?.(result.data);
    return true;
  }

  return { handle };
}
