"use client";

import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Drawer from "@mui/material/Drawer";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Switch from "@mui/material/Switch";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";
import { useSnackbar } from "notistack";
import { useEffect, useState, useTransition } from "react";

import {
  getInstallmentGroupPanelDataAction,
  convertPendingInstallmentForExistingMonthAction,
  setInstallmentGroupAutoCreateAction,
  setPendingInstallmentSettledAction,
  undoInstallmentGroupAction,
} from "@/actions/installments";
import { DialogShell } from "@/components/ui/DialogShell";
import { typography } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import { formatCentsToBrl } from "@/lib/money";
import type { InstallmentGroupPanelData } from "@/server/services/installment-service";

import { InstallmentSchedule } from "./InstallmentSchedule";
import { SettleInstallmentDialog } from "./SettleInstallmentDialog";

type Props = {
  open: boolean;
  onClose: () => void;
  accountId: string;
  monthId: string;
  installmentGroupId: string;
  canEdit?: boolean;
};

// Estilo base dos 3 botões do rodapé (frame Spec 66 §10): nenhum é
// primário/preenchido — todos com contorno cinza e texto colorido conforme a
// ação. `border.default`/`border.subtle` resolvem corretamente como tokens de
// palette (ao contrário de "background.*", ver nota em InstallmentSchedule).
const FOOTER_BUTTON_SX = {
  height: "32px",
  borderRadius: "8px",
  borderColor: "border.default",
  fontWeight: 500,
  fontSize: "0.78rem",
  px: "12px",
} as const;

export function InstallmentGroupPanel({
  open,
  onClose,
  accountId,
  monthId,
  installmentGroupId,
  canEdit = false,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { enqueueSnackbar } = useSnackbar();
  const [data, setData] = useState<InstallmentGroupPanelData | null>(null);
  const [loading, setLoading] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [autoCreateSaving, setAutoCreateSaving] = useState(false);
  const [undoOpen, setUndoOpen] = useState(false);
  const [undoSubmitting, setUndoSubmitting] = useState(false);

  function reload() {
    setLoading(true);
    startTransition(async () => {
      const result = await getInstallmentGroupPanelDataAction(accountId, { installmentGroupId });
      setData(result.ok ? (result.data ?? null) : null);
      setLoading(false);
    });
  }

  function handleConvertNow(pendingInstallmentId: string) {
    setConvertingId(pendingInstallmentId);
    startTransition(async () => {
      const result = await convertPendingInstallmentForExistingMonthAction(accountId, {
        pendingInstallmentId,
      });
      setConvertingId(null);
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      enqueueSnackbar(m.transactions.installments.launchNextSuccess, { variant: "success" });
      reload();
    });
  }

  function handleToggleSettled(pendingInstallmentId: string, settled: boolean) {
    setSettlingId(pendingInstallmentId);
    startTransition(async () => {
      const result = await setPendingInstallmentSettledAction(accountId, {
        pendingInstallmentId,
        settled,
      });
      setSettlingId(null);
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      enqueueSnackbar(
        settled
          ? m.transactions.installments.markSettledSuccess
          : m.transactions.installments.unmarkSettledSuccess,
        { variant: "success" },
      );
      reload();
      // A parcela sai/entra na projeção de fluxo de caixa e nos widgets.
      router.refresh();
    });
  }

  function handleToggleAutoCreate(autoCreateOnNewMonth: boolean) {
    // Otimista: o Switch responde na hora; erro reverte via reload().
    setData((prev) => (prev ? { ...prev, autoCreateOnNewMonth } : prev));
    setAutoCreateSaving(true);
    startTransition(async () => {
      const result = await setInstallmentGroupAutoCreateAction(accountId, {
        installmentGroupId,
        autoCreateOnNewMonth,
      });
      setAutoCreateSaving(false);
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        reload();
        return;
      }
      enqueueSnackbar(m.transactions.installments.autoCreateUpdated, { variant: "success" });
    });
  }

  function handleUndoGroup() {
    setUndoSubmitting(true);
    startTransition(async () => {
      const result = await undoInstallmentGroupAction(accountId, { installmentGroupId });
      setUndoSubmitting(false);
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      enqueueSnackbar(m.transactions.installments.undoSuccess, { variant: "success" });
      setUndoOpen(false);
      onClose();
      router.refresh();
    });
  }

  useEffect(() => {
    if (!open || !installmentGroupId) return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, accountId, installmentGroupId]);

  // Parcelas já resolvidas (lançadas ou marcadas como pagas fora do app) —
  // define o preenchimento da barra e a legenda "X de Y lançadas".
  const launchedCount = data?.items.filter((i) => i.status !== "waiting").length ?? 0;
  // Soma do que já foi efetivamente pago: "paid" (transação quitada) e
  // "settled_external" (paga fora do app). "pending" é lançada mas não quitada.
  const paidSumCents =
    data?.items
      .filter((i) => i.status === "paid" || i.status === "settled_external")
      .reduce((sum, i) => sum + BigInt(i.amountCents), 0n) ?? 0n;
  const hasWaiting = data?.items.some((i) => i.status === "waiting") ?? false;
  // Próxima parcela `waiting` cujo mês já existe (menor installmentNumber — items vem ordenado)
  const nextItem = data?.items.find((i) => i.status === "waiting" && i.existingMonthId);
  // Valor "por parcela" exibido no grid do cabeçalho: usa a última parcela
  // (a mais representativa do valor recorrente — a 1ª pode incluir entrada,
  // dado ainda não modelado em InstallmentGroupPanelData). Fallback simples
  // (total / quantidade) só é usado se, por algum motivo, não houver itens.
  const perInstallmentCents = data
    ? data.items.length > 0
      ? BigInt(data.items[data.items.length - 1].amountCents)
      : BigInt(data.totalCents) / BigInt(data.installmentCount || 1)
    : 0n;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { width: { xs: "100%", sm: 380 }, display: "flex", flexDirection: "column" },
      }}
    >
      {/* Header — frame Spec 66 §10 */}
      <Box sx={{ p: "16px", borderBottom: "1px solid", borderColor: "border.subtle" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography
            component="span"
            sx={{
              fontWeight: 600,
              fontSize: "0.62rem",
              fontFamily: typography.fontFamily.mono,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "neutral.main",
            }}
          >
            {m.transactions.installments.panelOverline}
          </Typography>
          <IconButton size="small" onClick={onClose} sx={{ p: 0.25, flexShrink: 0 }}>
            <CloseIcon sx={{ fontSize: 18, color: "text.secondary" }} />
          </IconButton>
        </Box>

        {data && (
          <>
            <Typography
              sx={{
                fontWeight: 600,
                fontSize: "1.05rem",
                mt: "6px",
                lineHeight: 1.3,
                wordBreak: "break-word",
              }}
            >
              {data.description}
            </Typography>

            {/* Grid: Total · Parcelas · Entrada */}
            <Box sx={{ display: "flex", gap: "16px", mt: "8px" }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.66rem", color: "neutral.main" }}>
                  {m.transactions.installments.totalShort}
                </Typography>
                <Typography
                  sx={{
                    fontWeight: 500,
                    fontSize: "0.9rem",
                    fontFamily: typography.fontFamily.mono,
                    color: "text.primary",
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatCentsToBrl(BigInt(data.totalCents))}
                </Typography>
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.66rem", color: "neutral.main" }}>
                  {m.transactions.installments.installmentsShort}
                </Typography>
                <Typography
                  sx={{
                    fontWeight: 500,
                    fontSize: "0.9rem",
                    fontFamily: typography.fontFamily.mono,
                    color: "text.primary",
                    whiteSpace: "nowrap",
                  }}
                >
                  {m.transactions.installments.perInstallmentValue(
                    data.installmentCount,
                    formatCentsToBrl(perInstallmentCents),
                  )}
                </Typography>
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.66rem", color: "neutral.main" }}>
                  {m.transactions.installments.downPaymentShort}
                </Typography>
                <Typography
                  sx={{
                    fontWeight: 500,
                    fontSize: "0.9rem",
                    fontFamily: typography.fontFamily.mono,
                    color: "text.primary",
                    whiteSpace: "nowrap",
                  }}
                >
                  —
                </Typography>
              </Box>
            </Box>

            {/* Barra de progresso — preenchimento na % de parcelas lançadas */}
            <Box
              sx={{
                height: "6px",
                borderRadius: "3px",
                bgcolor: "surface.muted",
                mt: "12px",
                overflow: "hidden",
              }}
            >
              <Box
                sx={{
                  height: "100%",
                  borderRadius: "3px",
                  bgcolor: "accent.primary",
                  width:
                    data.installmentCount > 0
                      ? `${(launchedCount / data.installmentCount) * 100}%`
                      : "0%",
                }}
              />
            </Box>
            <Typography sx={{ fontSize: "0.7rem", color: "neutral.main", mt: "5px" }}>
              {m.transactions.installments.launchedProgress(
                launchedCount,
                data.installmentCount,
                formatCentsToBrl(paidSumCents),
              )}
            </Typography>
          </>
        )}
      </Box>

      {/* Content — cronograma via InstallmentSchedule (fonte única de verdade visual) */}
      <Box sx={{ flex: 1, overflowY: "auto" }}>
        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6, px: 2.5 }}>
            <CircularProgress size={32} />
          </Box>
        )}

        {!loading && !data && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ textAlign: "center", py: 4, px: 2.5 }}
          >
            {m.transactions.installments.loadError}
          </Typography>
        )}

        {!loading && data && (
          <>
            <InstallmentSchedule
              items={data.items}
              installmentCount={data.installmentCount}
              canEdit={canEdit}
              convertingId={convertingId}
              onConvert={handleConvertNow}
              settlingId={settlingId}
              onToggleSettled={handleToggleSettled}
              variant="panel"
            />

            {/* Criação automática ao abrir mês novo (spec 73 §2.4) */}
            {canEdit && (
              <Box sx={{ px: "16px", pt: "12px", pb: "4px" }}>
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={data.autoCreateOnNewMonth}
                      disabled={autoCreateSaving}
                      onChange={(e) => handleToggleAutoCreate(e.target.checked)}
                    />
                  }
                  label={
                    <Typography sx={{ fontSize: "0.78rem", color: "text.primary" }}>
                      {m.transactions.installments.autoCreateLabel}
                    </Typography>
                  }
                  sx={{ ml: 0, mr: 0 }}
                />
                <Typography sx={{ fontSize: "0.68rem", color: "neutral.main", mt: "2px" }}>
                  {data.autoCreateOnNewMonth
                    ? m.transactions.installments.autoCreateHintOn
                    : m.transactions.installments.autoCreateHintOff}
                </Typography>
              </Box>
            )}
          </>
        )}
      </Box>

      {/* Rodapé — 3 ações em linha, nenhuma primária (frame Spec 66 §10) */}
      {!loading && data && canEdit && (
        <Box
          sx={{
            py: "10px",
            px: "16px",
            borderTop: "1px solid",
            borderColor: "border.subtle",
            display: "flex",
            gap: "8px",
          }}
        >
          <Button
            variant="outlined"
            disabled={!hasWaiting}
            onClick={() => setSettleOpen(true)}
            sx={{ ...FOOTER_BUTTON_SX, color: "text.secondary", flexShrink: 0 }}
          >
            {m.transactions.installments.settleShort}
          </Button>

          {/* Sem `flex: 1`: esticar o botão dentro dos ~348px do Drawer fazia o
              rótulo quebrar em duas linhas e o ícone `+` descolar do texto
              (spec 73 §2.6). O `flex: 1` do wrapper apenas empurra a ação
              destrutiva para a direita. */}
          <Tooltip
            title={!nextItem ? m.transactions.installments.launchNextNoMonth : ""}
            disableHoverListener={!!nextItem}
          >
            <Box component="span" sx={{ flex: 1, display: "flex", minWidth: 0 }}>
              <Button
                variant="outlined"
                disabled={!nextItem || convertingId !== null}
                startIcon={<AddIcon sx={{ fontSize: 15 }} />}
                onClick={() =>
                  nextItem?.pendingInstallmentId && handleConvertNow(nextItem.pendingInstallmentId)
                }
                sx={{
                  ...FOOTER_BUTTON_SX,
                  color: "text.secondary",
                  whiteSpace: "nowrap",
                  minWidth: 0,
                  "& .MuiButton-startIcon": { mr: 0.5, ml: 0 },
                }}
              >
                {nextItem && convertingId === nextItem.pendingInstallmentId ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  m.transactions.installments.launchNextButton
                )}
              </Button>
            </Box>
          </Tooltip>

          <Tooltip title={m.transactions.installments.undoButton}>
            <IconButton
              aria-label={m.transactions.installments.undoButton}
              onClick={() => setUndoOpen(true)}
              sx={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                border: "1px solid",
                borderColor: "border.default",
                color: "danger.main",
                flexShrink: 0,
              }}
            >
              <DeleteOutlineIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
        </Box>
      )}

      {/* Dialog de quitação antecipada — preservado */}
      {data && (
        <SettleInstallmentDialog
          open={settleOpen}
          onClose={() => setSettleOpen(false)}
          onSettled={() => {
            setSettleOpen(false);
            reload();
          }}
          accountId={accountId}
          monthId={monthId}
          installmentGroupId={installmentGroupId}
          pendingCount={data.items.filter((i) => i.status === "waiting").length}
          pendingAmounts={data.items
            .filter((i) => i.status === "waiting")
            .map((i) => i.amountCents)}
        />
      )}

      {/* Dialog de confirmação — Desfazer grupo (preservado) */}
      <DialogShell
        open={undoOpen}
        onClose={() => !undoSubmitting && setUndoOpen(false)}
        title={m.transactions.installments.undoConfirmTitle}
        description={m.transactions.installments.undoConfirmBody}
        maxWidth="xs"
        loading={undoSubmitting}
        actions={
          <>
            <Button onClick={() => setUndoOpen(false)} disabled={undoSubmitting}>
              {m.common.cancel}
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleUndoGroup}
              disabled={undoSubmitting}
            >
              {undoSubmitting ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                m.transactions.installments.undoConfirmCta
              )}
            </Button>
          </>
        }
      />
    </Drawer>
  );
}
