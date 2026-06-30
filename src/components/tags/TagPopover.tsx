"use client";

import Box from "@mui/material/Box";
import Popover from "@mui/material/Popover";

import { TagEditor } from "./TagEditor";

type Tag = { id: string; name: string; color: string | null };

type Props = {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  accountId: string;
  transactionId: string;
  currentTags: Tag[];
  onTagsChange: (tags: Tag[]) => void;
  /** @deprecated — ignorado, mantido por compatibilidade com TransactionRowEditor */
  inline?: boolean;
};

export function TagPopover({
  anchorEl,
  onClose,
  accountId,
  transactionId,
  currentTags,
  onTagsChange,
  inline = false,
}: Props) {
  // Modo inline: renderiza sem Popover (para TransactionRowEditor)
  if (inline) {
    return (
      <TagEditor
        accountId={accountId}
        transactionId={transactionId}
        currentTags={currentTags}
        onTagsChange={onTagsChange}
      />
    );
  }

  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      transformOrigin={{ vertical: "top", horizontal: "left" }}
      slotProps={{ paper: { sx: { mt: 0.5 } } }}
    >
      <Box sx={{ p: 1.5, minWidth: 200, maxWidth: 360 }}>
        <TagEditor
          accountId={accountId}
          transactionId={transactionId}
          currentTags={currentTags}
          onTagsChange={onTagsChange}
        />
      </Box>
    </Popover>
  );
}
