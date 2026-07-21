"use client";

import SettingsBackupRestoreIcon from "@mui/icons-material/SettingsBackupRestore";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import type { AccountMemberRole } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useSnackbar } from "notistack";
import { useRef, useState, useTransition } from "react";

import { DialogShell } from "@/components/ui/DialogShell";
import { layout } from "@/lib/design-tokens";
import { useExportDownload } from "@/lib/hooks/use-export-download";
import { m } from "@/lib/messages";
import type { AccountSnapshot } from "@/lib/schemas/account-backup";

type Props = {
  accountId: string;
  accountName: string;
  role: AccountMemberRole;
};

type ImportMode = "new" | "overwrite";

type ImportData = { accountId: string; counts: Record<string, number> };

type ImportSuccessBody = { ok: true; data: ImportData };

/**
 * A rota de import responde `{ ok: true, data }` no sucesso, mas os erros
 * antecipados (cap de tamanho, JSON inválido, confirmName incorreto) usam
 * `{ error: "CODE", message }` "achatado" — só o catch de `AppError` usa o
 * envelope padrão `{ ok: false, error: { code, message } }`. Extração
 * defensiva cobre os dois formatos sem depender de qual caminho respondeu.
 */
function extractErrorMessage(body: unknown): string {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (
      record.error &&
      typeof record.error === "object" &&
      "message" in (record.error as Record<string, unknown>)
    ) {
      const message = (record.error as Record<string, unknown>).message;
      if (typeof message === "string") return message;
    }
    if (typeof record.message === "string") return record.message;
  }
  return m.settings.backup.importError;
}

/**
 * Backup da conta (spec 64, Fase 4): export/import de uma "foto" JSON completa
 * da account (configuração + dados reais). Owner-only (DD-09) — mesma trava de
 * `AccountDangerZone`.
 */
export function AccountDataSection({ accountId, accountName, role }: Props) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const { download, loading: exportLoading } = useExportDownload();
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<AccountSnapshot | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [mode, setMode] = useState<ImportMode>("new");
  const [confirmName, setConfirmName] = useState("");

  if (role !== "owner") return null;

  function resetImportState() {
    setFileName(null);
    setSnapshot(null);
    setParseError(null);
    setMode("new");
    setConfirmName("");
  }

  function handleCloseImport() {
    if (isPending) return;
    setImportOpen(false);
    resetImportState();
  }

  async function processFile(file: File) {
    setFileName(file.name);
    setSnapshot(null);
    setParseError(null);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as AccountSnapshot;
      if (
        !parsed ||
        typeof parsed !== "object" ||
        !parsed.account?.name ||
        !parsed.data ||
        !Array.isArray(parsed.data.transactions)
      ) {
        throw new Error("invalid snapshot shape");
      }
      setSnapshot(parsed);
    } catch {
      setParseError(m.settings.backup.parseError);
    }
  }

  function handleSubmitImport() {
    if (!snapshot) return;

    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/accounts/${accountId}/import/json`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode,
            confirmName: mode === "overwrite" ? confirmName : undefined,
            snapshot,
          }),
        });
        const body: unknown = await res.json().catch(() => null);

        if (!res.ok || !(body as { ok?: boolean } | null)?.ok) {
          enqueueSnackbar(extractErrorMessage(body), { variant: "error" });
          return;
        }

        const importedAccountId = (body as ImportSuccessBody).data.accountId;
        setImportOpen(false);
        resetImportState();

        if (mode === "new") {
          enqueueSnackbar(m.settings.backup.importSuccessNew, { variant: "success" });
          router.push(`/${importedAccountId}`);
        } else {
          enqueueSnackbar(m.settings.backup.importSuccessOverwrite, { variant: "success" });
          router.refresh();
        }
      } catch {
        enqueueSnackbar(m.settings.backup.importError, { variant: "error" });
      }
    });
  }

  const overwriteBlocked = mode === "overwrite" && confirmName !== accountName;

  return (
    <>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: layout.stack,
          flexWrap: "wrap",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: layout.inline }}>
          <SettingsBackupRestoreIcon
            sx={{ color: "text.secondary", mt: 2, ml: layout.inline, flexShrink: 0 }}
          />
          <Box>
            <Typography variant="body2" fontWeight="medium">
              {m.settings.backup.title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {m.settings.backup.description}
            </Typography>
          </Box>
        </Box>
        <Stack direction="row" spacing={layout.inline} sx={{ flexShrink: 0 }}>
          <Button
            variant="outlined"
            size="small"
            disabled={exportLoading}
            onClick={() => download(`/api/v1/accounts/${accountId}/export/json`)}
          >
            {exportLoading ? m.settings.backup.exportButtonLoading : m.settings.backup.exportButton}
          </Button>
          <Button variant="outlined" size="small" onClick={() => setImportOpen(true)}>
            {m.settings.backup.importButton}
          </Button>
        </Stack>
      </Box>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void processFile(file);
        }}
      />

      <DialogShell
        open={importOpen}
        onClose={handleCloseImport}
        maxWidth="sm"
        title={m.settings.backup.dialogTitle}
        description={m.settings.backup.dialogDescription}
        loading={isPending}
        actions={
          <>
            <Button onClick={handleCloseImport}>{m.common.cancel}</Button>
            <Button
              variant="contained"
              onClick={handleSubmitImport}
              disabled={isPending || !snapshot || overwriteBlocked}
            >
              {isPending ? m.settings.backup.submitButtonLoading : m.settings.backup.submitButton}
            </Button>
          </>
        }
      >
        <Stack spacing={layout.stack}>
          <Box>
            <Button
              variant="outlined"
              size="small"
              disabled={isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              {m.settings.backup.chooseFileButton}
            </Button>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mt: layout.micro }}
            >
              {fileName ?? m.settings.backup.noFileSelected}
            </Typography>
          </Box>

          {parseError && <Alert severity="error">{parseError}</Alert>}

          {snapshot && (
            <Box>
              <Typography variant="body2" fontWeight="medium">
                {m.settings.backup.previewTitle}
              </Typography>
              <Typography variant="body2" sx={{ mt: layout.micro }}>
                {m.settings.backup.previewAccountName(snapshot.account.name)}
              </Typography>
              <Stack
                direction="row"
                spacing={layout.stack}
                sx={{ mt: layout.micro, flexWrap: "wrap" }}
              >
                <Typography variant="caption" color="text.secondary">
                  {m.settings.backup.previewTransactions(snapshot.data.transactions.length)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {m.settings.backup.previewMonths(snapshot.data.months.length)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {m.settings.backup.previewCategories(snapshot.data.categories.length)}
                </Typography>
              </Stack>
            </Box>
          )}

          {snapshot && (
            <Box>
              <Typography variant="body2" fontWeight="medium" sx={{ mb: layout.micro }}>
                {m.settings.backup.modeLabel}
              </Typography>
              <ToggleButtonGroup
                exclusive
                value={mode}
                disabled={isPending}
                onChange={(_e, v: ImportMode | null) => v && setMode(v)}
                sx={{ width: "100%" }}
              >
                <ToggleButton value="new" sx={{ flex: 1 }}>
                  {m.settings.backup.modeNew}
                </ToggleButton>
                <ToggleButton value="overwrite" sx={{ flex: 1 }}>
                  {m.settings.backup.modeOverwrite}
                </ToggleButton>
              </ToggleButtonGroup>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mt: layout.micro }}
              >
                {mode === "new"
                  ? m.settings.backup.modeNewHint
                  : m.settings.backup.modeOverwriteHint}
              </Typography>
            </Box>
          )}

          {snapshot && mode === "overwrite" && (
            <Stack spacing={layout.inline}>
              <Alert severity="warning">{m.settings.backup.overwriteAlert}</Alert>
              <TextField
                label={m.settings.backup.overwriteConfirmLabel(accountName)}
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                disabled={isPending}
                fullWidth
                size="small"
              />
            </Stack>
          )}
        </Stack>
      </DialogShell>
    </>
  );
}
