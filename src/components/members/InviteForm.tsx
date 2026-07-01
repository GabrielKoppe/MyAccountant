"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { useSnackbar } from "notistack";

import { inviteMemberAction } from "@/actions/members";
import { inviteMemberSchema, type InviteMemberInput } from "@/lib/schemas/account";
import { m } from "@/lib/messages";
import { layout } from "@/lib/design-tokens";
import { DialogShell } from "@/components/ui/DialogShell";

type Props = {
  accountId: string;
};

export function InviteForm({ accountId }: Props) {
  const [open, setOpen] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  const form = useForm<InviteMemberInput>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { email: "", role: "viewer" },
  });

  async function onSubmit(values: InviteMemberInput) {
    const result = await inviteMemberAction(accountId, values);

    if (!result.ok) {
      if (result.error.fieldErrors) {
        Object.entries(result.error.fieldErrors).forEach(([field, message]) => {
          form.setError(field as keyof InviteMemberInput, { message });
        });
      } else {
        enqueueSnackbar(result.error.message, { variant: "error" });
      }
      return;
    }

    enqueueSnackbar(m.account.invite.success, { variant: "success" });
    form.reset();
    setOpen(false);
  }

  return (
    <>
      <Button variant="contained" onClick={() => setOpen(true)}>
        {m.account.inviteMember}
      </Button>

      <DialogShell
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="xs"
        title={m.account.invite.title}
        loading={form.formState.isSubmitting}
        actions={
          <>
            <Button onClick={() => setOpen(false)}>{m.common.cancel}</Button>
            <Button
              type="submit"
              form="invite-form"
              variant="contained"
              endIcon={
                form.formState.isSubmitting ? (
                  <CircularProgress size={16} color="inherit" />
                ) : undefined
              }
            >
              {m.account.invite.sendButton}
            </Button>
          </>
        }
      >
        <form id="invite-form" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <Stack spacing={layout.stack}>
            <Controller
              name="email"
              control={form.control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label={m.account.invite.emailLabel}
                  type="email"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  fullWidth
                  autoFocus
                />
              )}
            />
            <Controller
              name="role"
              control={form.control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  select
                  label={m.account.invite.roleLabel}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  fullWidth
                >
                  <MenuItem value="owner">{m.account.roles.owner}</MenuItem>
                  <MenuItem value="editor">{m.account.roles.editor}</MenuItem>
                  <MenuItem value="viewer">{m.account.roles.viewer}</MenuItem>
                </TextField>
              )}
            />
          </Stack>
        </form>
      </DialogShell>
    </>
  );
}
