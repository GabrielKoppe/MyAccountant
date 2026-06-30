"use client";

import { useEffect, useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import { useSnackbar } from "notistack";

import {
  getInstallmentGroupPanelDataAction,
  convertPendingInstallmentForExistingMonthAction,
} from "@/actions/installments";
import { formatCentsToBrl } from "@/lib/money";
import { formatMonthLabel } from "@/lib/dates";
import { m } from "@/lib/messages";
import { SettleInstallmentDialog } from "./SettleInstallmentDialog";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type {
  InstallmentGroupPanelData,
  InstallmentPanelItem,
} from "@/server/services/installment-service";

// Estilo base comum aos três estados de status
const chipBaseSx = {
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  px: "8px",
  py: "2px",
  borderRadius: "4px",
  fontSize: "0.75rem",
  fontWeight: 500,
  lineHeight: 1.4,
  whiteSpace: "nowrap" as const,
};

type ItemStatusChipProps = {
  item: InstallmentPanelItem;
  canEdit: boolean;
  convertingId: string | null;
  onConvert: (id: string) => void;
};

/**
 * Chip unificado para os três estados:
 * - Pago → verde
 * - Aguardando mês → cinza
 * - Criar neste mês (mês existe mas parcela foi deletada) → accent/primary, clicável
 */
function ItemStatusChip({ item, canEdit, convertingId, onConvert }: ItemStatusChipProps) {
  if (item.status === "waiting" && item.existingMonthId && canEdit) {
    const isConverting = convertingId === item.pendingInstallmentId;
    return (
      <Box
        component="span"
        onClick={() =>
          !isConverting && item.pendingInstallmentId && onConvert(item.pendingInstallmentId)
        }
        sx={{
          ...chipBaseSx,
          bgcolor: "accent.primarySubtle",
          color: "accent.primary",
          cursor: isConverting ? "default" : "pointer",
          transition: "filter 0.12s",
          "&:hover": isConverting ? {} : { filter: "brightness(0.92)" },
        }}
      >
        {isConverting && <CircularProgress size={10} color="inherit" />}
        Criar neste mês
      </Box>
    );
  }

  const config = {
    paid: { variant: "success" as const, label: m.transactions.installments.statusPaid },
    pending: { variant: "warning" as const, label: m.transactions.installments.statusPending },
    waiting: { variant: "neutral" as const, label: m.transactions.installments.statusWaiting },
  }[item.status];

  return <StatusBadge variant={config.variant}>{config.label}</StatusBadge>;
}

type Props = {
  open: boolean;
  onClose: () => void;
  accountId: string;
  monthId: string;
  installmentGroupId: string;
  canEdit?: boolean;
};

export function InstallmentGroupPanel({
  open,
  onClose,
  accountId,
  monthId,
  installmentGroupId,
  canEdit = false,
}: Props) {
  const [, startTransition] = useTransition();
  const { enqueueSnackbar } = useSnackbar();
  const [data, setData] = useState<InstallmentGroupPanelData | null>(null);
  const [loading, setLoading] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [convertingId, setConvertingId] = useState<string | null>(null);

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
      enqueueSnackbar("Parcela criada no mês com sucesso.", { variant: "success" });
      reload();
    });
  }

  useEffect(() => {
    if (!open || !installmentGroupId) return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, accountId, installmentGroupId]);

  const paidCount = data?.items.filter((i) => i.status === "paid").length ?? 0;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { width: { xs: "100%", sm: 420 }, display: "flex", flexDirection: "column" },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          gap: 1,
          px: 2.5,
          pt: 2,
          pb: 1.5,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            fontWeight={600}
            sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}
          >
            {m.transactions.installments.panelTitle}
          </Typography>
          {data && (
            <>
              <Typography variant="h5" sx={{ mt: 2, lineHeight: 1.3, wordBreak: "break-word" }}>
                {data.description}
              </Typography>
              <Box
                sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.75, flexWrap: "wrap" }}
              >
                <Typography variant="body2" color="text.secondary" fontSize={13}>
                  {m.transactions.installments.totalLabel}:{" "}
                  <Typography
                    component="span"
                    variant="body2"
                    fontWeight={600}
                    color="text.primary"
                    fontSize={13}
                  >
                    {formatCentsToBrl(BigInt(data.totalCents))}
                  </Typography>
                </Typography>
                <Chip
                  label={m.transactions.installments.paidCount(paidCount, data.installmentCount)}
                  size="small"
                  sx={{ height: 20, fontSize: 11, "& .MuiChip-label": { px: 1 } }}
                />
              </Box>
            </>
          )}
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ flexShrink: 0, mt: 0.5 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflowY: "auto", p: 2.5 }}>
        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress size={32} />
          </Box>
        )}

        {!loading && !data && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
            Não foi possível carregar os dados do grupo.
          </Typography>
        )}

        {!loading && data && (
          <Stack divider={<Divider />} spacing={0}>
            {data.items.map((item) => (
              <Box
                key={item.installmentNumber}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  py: 1.25,
                  px: 0.5,
                }}
              >
                {/* Número da parcela */}
                <Typography
                  variant="caption"
                  color="text.disabled"
                  sx={{
                    width: 32,
                    flexShrink: 0,
                    textAlign: "center",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {item.installmentNumber}/{data.installmentCount}
                </Typography>

                {/* Valor + data + mês */}
                <Box
                  sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 0.25 }}
                >
                  <Typography variant="body2" fontWeight={500}>
                    {formatCentsToBrl(BigInt(item.amountCents))}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" fontSize={11}>
                    {item.date.split("-").reverse().join("/")}
                    {item.monthYear && item.monthMonth && (
                      <> · {formatMonthLabel(item.monthYear, item.monthMonth)}</>
                    )}
                  </Typography>
                </Box>

                {/* Status chip unificado */}
                <ItemStatusChip
                  item={item}
                  canEdit={canEdit}
                  convertingId={convertingId}
                  onConvert={handleConvertNow}
                />
              </Box>
            ))}
          </Stack>
        )}
      </Box>

      {/* Footer: Quitar antecipado */}
      {!loading && data && canEdit && data.items.some((i) => i.status === "waiting") && (
        <>
          <Divider />
          <Box sx={{ p: 2, display: "flex", justifyContent: "flex-end" }}>
            <Button
              size="small"
              variant="outlined"
              color="warning"
              onClick={() => setSettleOpen(true)}
            >
              {m.transactions.installments.settleButton}
            </Button>
          </Box>
        </>
      )}

      {/* Dialog de quitação antecipada */}
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
    </Drawer>
  );
}
