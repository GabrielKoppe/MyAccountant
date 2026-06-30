"use client";

import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { m } from "@/lib/messages";
import { TagEditor } from "./TagEditor";

type Tag = { id: string; name: string; color: string | null };

type Props = {
  accountId: string;
  transactionId: string;
  currentTags: Tag[];
  canEdit: boolean;
  onTagsChange: (tags: Tag[]) => void;
};

export function TagDetailEditor({
  accountId,
  transactionId,
  currentTags,
  canEdit,
  onTagsChange,
}: Props) {
  return (
    <Stack spacing={0.75}>
      <Typography
        variant="caption"
        color="text.secondary"
        fontWeight={600}
        sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}
      >
        {m.transactions.tags.editTitle}
      </Typography>
      {currentTags.length === 0 && !canEdit && (
        <Typography variant="caption" color="text.disabled">
          {m.transactions.tags.noTags}
        </Typography>
      )}
      <TagEditor
        accountId={accountId}
        transactionId={transactionId}
        currentTags={currentTags}
        canEdit={canEdit}
        onTagsChange={onTagsChange}
      />
    </Stack>
  );
}
