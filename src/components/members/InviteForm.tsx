"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import { useSnackbar } from "notistack";

import { inviteMemberAction } from "@/actions/members";
import { inviteMemberSchema, type InviteMemberInput } from "@/lib/schemas/account";
import { m } from "@/lib/messages";
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

      <Box component="form" onSubmit={form.handleSubmit(onSubmit)}>
        <DialogShell
          open={open}
          onClose={() => setOpen(false)}
          maxWidth="xs"
          title={m.account.invite.title}
          actions={
            <>
              <Button onClick={() => setOpen(false)}>{m.common.cancel}</Button>
              <Button type="submit" variant="contained" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? m.account.invite.sending : m.account.invite.sendButton}
              </Button>
            </>
          }
        >
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
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
          </Box>
        </DialogShell>
      </Box>
    </>
  );
}
