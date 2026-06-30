"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { addMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { NumericFormat } from "react-number-format";
import { useSnackbar } from "notistack";

import { createInstallmentGroupAction, getInstallmentCreateContext } from "@/actions/installments";
import { createInstallmentGroupSchema } from "@/lib/schemas/installment";
import { calcInstallmentAmounts } from "@/lib/installment-utils";
import { formatCentsToBrl } from "@/lib/money";
import { m } from "@/lib/messages";
import { DialogShell } from "@/components/ui/DialogShell";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  accountId: string;
  tableId: string;
};

type TableContext = {
  year: number;
  month: number;
  sectionName: string;
  tableTypeName: string | null;
};

type FormValues = {
  description: string;
  totalCents: string;
  installmentCount: number;
  hasDownPayment: boolean;
  downPaymentCents: string;
  startDate: string; // "YYYY-MM-DD"
};

/** Formata uma data como "01/07/2026" evitando problemas de timezone */
function fmtDate(d: Date) {
  return format(d, "dd/MM/yyyy");
}

/** Formata mês/ano como "julho de 2026" */
function fmtMonthYear(year: number, month: number) {
  return format(new Date(year, month - 1, 1), "MMMM 'de' yyyy", { locale: ptBR });
}

/** Parseia "YYYY-MM-DD" sem offsets de timezone */
function parseLocalDate(s: string): Date {
  const [y, mo, d] = s.split("-").map(Number);
  return new Date(y, mo - 1, d);
}

export function CreateInstallmentDialog({ open, onClose, onCreated, accountId, tableId }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [, startTransition] = useTransition();
  const [tableCtx, setTableCtx] = useState<TableContext | null>(null);
  const [loadingCtx, setLoadingCtx] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    defaultValues: {
      description: "",
      totalCents: "",
      installmentCount: 12,
      hasDownPayment: false,
      downPaymentCents: "",
      startDate: new Date().toISOString().slice(0, 10),
    },
  });

  const watchedTotal = watch("totalCents");
  const watchedCount = watch("installmentCount");
  const watchedHasDown = watch("hasDownPayment");
  const watchedDown = watch("downPaymentCents");
  const watchedDate = watch("startDate");

  // Carregar contexto da tabela ao abrir
  useEffect(() => {
    if (!open) return;
    setLoadingCtx(true);
    getInstallmentCreateContext(accountId, tableId).then((ctx) => {
      setTableCtx(ctx);
      setLoadingCtx(false);
    });
  }, [open, accountId, tableId]);

  // ─── Cálculos reativos ────────────────────────────────────────────────────
  const parseMoney = (s: string) =>
    BigInt(Math.round((parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0) * 100));

  const totalCents = parseMoney(watchedTotal);
  const count = Math.max(2, Math.min(360, watchedCount || 2));
  const downCents = (() => {
    if (!watchedHasDown || !watchedDown) return undefined;
    const d = parseMoney(watchedDown);
    return d > 0n && d < totalCents ? d : undefined;
  })();

  const amounts =
    totalCents > 0n && count >= 2
      ? (() => {
          try {
            return calcInstallmentAmounts(totalCents, count, downCents);
          } catch {
            return null;
          }
        })()
      : null;

  // Datas do cronograma
  const startDateObj = watchedDate ? parseLocalDate(watchedDate) : null;
  const endDateObj = startDateObj ? addMonths(startDateObj, count - 1) : null;

  // Aviso: data da 1ª parcela está em mês diferente da tabela
  const isDifferentMonth =
    tableCtx &&
    startDateObj &&
    (startDateObj.getFullYear() !== tableCtx.year ||
      startDateObj.getMonth() + 1 !== tableCtx.month);

  // Preview compacto: "12x R$1.000,00/mês"
  const previewText = amounts
    ? downCents
      ? `Entrada ${formatCentsToBrl(amounts[0])} + ${count - 1}x ${formatCentsToBrl(amounts[1])}/mês`
      : m.transactions.installments.preview(count, formatCentsToBrl(amounts[0]))
    : null;

  function handleClose() {
    if (submitting) return;
    reset();
    setError("");
    onClose();
  }

  async function onSubmit(values: FormValues) {
    setError("");
    setSubmitting(true);

    const parsed = createInstallmentGroupSchema.safeParse({
      description: values.description,
      totalCents: parseMoney(values.totalCents),
      installmentCount: values.installmentCount,
      downPaymentCents: downCents,
      startDate: parseLocalDate(values.startDate),
      tableId,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dados inválidos");
      setSubmitting(false);
      return;
    }

    startTransition(async () => {
      const result = await createInstallmentGroupAction(accountId, parsed.data);
      setSubmitting(false);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      const { installmentCount } = values;
      const { convertedImmediately } = result.data;
      enqueueSnackbar(m.transactions.installments.createSuccess(installmentCount), {
        variant: "success",
        autoHideDuration: 5000,
      });
      if (convertedImmediately > 0) {
        enqueueSnackbar(m.transactions.installments.convertedOnMonthCreate(convertedImmediately), {
          variant: "success",
          autoHideDuration: 5000,
        });
      }

      reset();
      setError("");
      onCreated();
    });
  }

  return (
    <DialogShell
      open={open}
      onClose={handleClose}
      title={m.transactions.installments.createTitle}
      maxWidth="sm"
      loading={submitting}
      actions={
        <>
          <Button onClick={handleClose} disabled={submitting}>
            {m.common.cancel}
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit(onSubmit)}
            disabled={submitting || loadingCtx}
          >
            {submitting ? <CircularProgress size={20} /> : m.transactions.installments.createButton}
          </Button>
        </>
      }
    >
      {loadingCtx ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress size={32} />
        </Box>
      ) : (
        <Stack spacing={2.5}>
          {error && <Alert severity="error">{error}</Alert>}

          {/* Descrição */}
          <TextField
            label={m.transactions.installments.createDescription}
            size="small"
            autoFocus
            fullWidth
            {...register("description")}
            error={Boolean(errors.description)}
            helperText={errors.description?.message}
          />

          {/* Valor total */}
          <Controller
            name="totalCents"
            control={control}
            render={({ field }) => (
              <NumericFormat
                customInput={TextField}
                label={m.transactions.installments.totalAmount}
                size="small"
                fullWidth
                prefix="R$ "
                thousandSeparator="."
                decimalSeparator=","
                decimalScale={2}
                fixedDecimalScale
                allowNegative={false}
                value={field.value}
                onValueChange={(v) => field.onChange(v.formattedValue.replace("R$ ", ""))}
                error={Boolean(errors.totalCents)}
              />
            )}
          />

          {/* Parcelas + preview */}
          <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
            <TextField
              label={m.transactions.installments.installmentCount}
              size="small"
              type="number"
              inputProps={{ min: 2, max: 360 }}
              sx={{ width: 130 }}
              {...register("installmentCount", { valueAsNumber: true })}
              error={Boolean(errors.installmentCount)}
              helperText={errors.installmentCount?.message}
            />
            {previewText && (
              <Box sx={{ pt: 1 }}>
                <Typography variant="body2" color="accent.primary" fontWeight={600}>
                  {previewText}
                </Typography>
              </Box>
            )}
          </Box>

          {/* Entrada diferente */}
          <Box>
            <Controller
              name="hasDownPayment"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                    />
                  }
                  label={
                    <Typography variant="body2">
                      {m.transactions.installments.downPayment}
                    </Typography>
                  }
                />
              )}
            />
            {watchedHasDown && (
              <Controller
                name="downPaymentCents"
                control={control}
                render={({ field }) => (
                  <NumericFormat
                    customInput={TextField}
                    label={m.transactions.installments.downPaymentAmount}
                    size="small"
                    fullWidth
                    prefix="R$ "
                    thousandSeparator="."
                    decimalSeparator=","
                    decimalScale={2}
                    fixedDecimalScale
                    allowNegative={false}
                    value={field.value}
                    onValueChange={(v) => field.onChange(v.formattedValue.replace("R$ ", ""))}
                    sx={{ mt: 1 }}
                  />
                )}
              />
            )}
          </Box>

          {/* Data da 1ª parcela */}
          <TextField
            label={m.transactions.installments.firstInstallmentDate}
            size="small"
            type="date"
            fullWidth
            InputLabelProps={{ shrink: true }}
            {...register("startDate")}
            error={Boolean(errors.startDate)}
            helperText={errors.startDate?.message}
          />

          {/* Aviso: data em mês diferente da tabela */}
          {isDifferentMonth && startDateObj && tableCtx && (
            <Alert
              severity="warning"
              icon={<WarningAmberIcon fontSize="small" />}
              sx={{ fontSize: 13 }}
            >
              A data selecionada ({fmtDate(startDateObj)}) é diferente do mês desta tabela (
              {fmtMonthYear(tableCtx.year, tableCtx.month)}). A parcela 1 será criada{" "}
              <strong>nesta tabela</strong> ({fmtMonthYear(tableCtx.year, tableCtx.month)}), com a
              data que você informou.
            </Alert>
          )}

          <Divider />

          {/* Cronograma visual */}
          {startDateObj && endDateObj && count >= 2 && (
            <Box sx={{ bgcolor: "background.subtle", borderRadius: 1, p: 1.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 1 }}>
                <CalendarMonthOutlinedIcon sx={{ fontSize: 15, color: "text.secondary" }} />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  fontWeight={600}
                  sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}
                >
                  Cronograma
                </Typography>
              </Box>
              <Stack spacing={0.5}>
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Parcela 1
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    <Typography
                      component="span"
                      variant="caption"
                      color="text.disabled"
                      sx={{ ml: 0.5 }}
                    >
                      (nesta tabela)
                    </Typography>
                    {fmtDate(startDateObj)}
                  </Typography>
                </Box>
                {count > 2 && (
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Typography variant="body2" color="text.secondary">
                      Parcela 2
                    </Typography>
                    <Typography variant="body2" fontWeight={500}>
                      {fmtDate(addMonths(startDateObj, 1))}
                    </Typography>
                  </Box>
                )}
                {count > 3 && (
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <MoreHorizIcon sx={{ fontSize: 16, color: "text.secondary" }} />
                  </Box>
                )}
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Parcela {count}
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    <Typography
                      component="span"
                      variant="caption"
                      color="text.disabled"
                      sx={{ ml: 0.5 }}
                    >
                      (última)
                    </Typography>
                    {fmtDate(endDateObj)}
                  </Typography>
                </Box>
              </Stack>
            </Box>
          )}

          {/* Info: onde as parcelas futuras serão criadas */}
          {tableCtx && count > 1 && (
            <Alert severity="info" sx={{ fontSize: 12 }}>
              Parcelas 2–{count} serão criadas automaticamente nos meses futuros
              {tableCtx.tableTypeName
                ? ` na seção "${tableCtx.sectionName}" (tipo "${tableCtx.tableTypeName}")`
                : ` na seção "${tableCtx.sectionName}"`}
              , usando a mesma estrutura desta tabela. Se o mês já existir, a parcela é vinculada na
              hora.
            </Alert>
          )}
        </Stack>
      )}
    </DialogShell>
  );
}
