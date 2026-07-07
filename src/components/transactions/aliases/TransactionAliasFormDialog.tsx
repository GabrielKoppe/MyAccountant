"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import AutoFixHighOutlinedIcon from "@mui/icons-material/AutoFixHighOutlined";
import FlashOnOutlinedIcon from "@mui/icons-material/FlashOnOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import WavesOutlinedIcon from "@mui/icons-material/WavesOutlined";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { NumericFormat } from "react-number-format";

import {
  createTransactionAliasAction,
  updateTransactionAliasAction,
} from "@/actions/transaction-aliases";
import { tagChipSx } from "@/components/tags/tagChipSx";
import { CreatableEntitySelect } from "@/components/transactions/CreatableEntitySelect";
import { ResponsiblePartySelect } from "@/components/transactions/ResponsiblePartySelect";
import type {
  CategoryOption,
  InstitutionOption,
  ResponsiblePartyOption,
} from "@/components/transactions/types";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { DialogShell } from "@/components/ui/DialogShell";
import { FieldGroup } from "@/components/ui/FieldGroup";
import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import { centsToReais, reaisToCents } from "@/lib/money";
import { INVESTMENT_TYPES, TransactionPaymentMethod } from "@/lib/schemas/transaction";
import type { TransactionExpenseType } from "@/lib/schemas/transaction";
import {
  createTransactionAliasSchema,
  type CreateTransactionAliasInput,
} from "@/lib/schemas/transaction-alias";
import type { SerializedTransactionAlias } from "@/lib/serializers/transaction-alias";

type TagOption = { id: string; name: string; color: string | null };

type Props = {
  open: boolean;
  onClose: () => void;
  accountId: string;
  categories: CategoryOption[];
  institutions: InstitutionOption[];
  parties: ResponsiblePartyOption[];
  tags: TagOption[];
  alias?: SerializedTransactionAlias;
  /** Valores iniciais para criação a partir de uma transação (Fase 3). Ignorado em modo edição. */
  prefill?: Omit<Partial<CreateTransactionAliasInput>, "trigger">;
  onSuccess: (values: CreateTransactionAliasInput, aliasId: string) => void;
};

const ta = m.settings.transactionAliases;

// Configurações → Apelidos não oferece criação inline de categoria/subcategoria/
// instituição (o usuário já está em Configurações; criar via Categorias/Instituições).
// CreatableEntitySelect exige onCreate mesmo com canCreate=false.
async function noopCreate(): Promise<string | null> {
  return null;
}

function initDefaults(
  alias?: SerializedTransactionAlias,
  prefill?: Omit<Partial<CreateTransactionAliasInput>, "trigger">,
): CreateTransactionAliasInput {
  if (!alias) {
    return {
      trigger: "",
      description: null,
      notes: null,
      amountCents: null,
      categoryId: null,
      subcategoryId: null,
      institutionId: null,
      institutionText: null,
      responsiblePartyId: null,
      expenseType: null,
      paymentMethod: null,
      investmentType: null,
      cardInstallment: null,
      isPending: null,
      isFavorite: null,
      originalCurrency: null,
      originalAmountCents: null,
      exchangeRate: null,
      tagIds: [],
      ...prefill,
    };
  }
  return {
    trigger: alias.trigger,
    description: alias.description,
    notes: alias.notes,
    amountCents: alias.amountCents !== null ? BigInt(alias.amountCents) : null,
    categoryId: alias.categoryId,
    subcategoryId: alias.subcategoryId,
    institutionId: alias.institutionId,
    institutionText: alias.institutionText,
    responsiblePartyId: alias.responsiblePartyId,
    expenseType: alias.expenseType,
    paymentMethod: alias.paymentMethod,
    investmentType: alias.investmentType,
    cardInstallment: alias.cardInstallment,
    isPending: alias.isPending,
    isFavorite: alias.isFavorite,
    originalCurrency: alias.originalCurrency,
    originalAmountCents:
      alias.originalAmountCents !== null ? BigInt(alias.originalAmountCents) : null,
    exchangeRate: alias.exchangeRate,
    tagIds: alias.tags.map((t) => t.id),
  };
}

/** Tri-state (Não definir / Sim / Não) → valor do <Select>. */
function triToOption(value: boolean | null | undefined): "" | "true" | "false" {
  if (value === null || value === undefined) return "";
  return value ? "true" : "false";
}

const twoCol = {
  display: "grid",
  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
  gap: layout.stack,
} as const;

function LabeledField({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
        {label}
      </Typography>
      {children}
      {(error ?? hint) && (
        <Typography
          variant="caption"
          color={error ? "error" : "text.tertiary"}
          sx={{ mt: 0.5, display: "block" }}
        >
          {error ?? hint}
        </Typography>
      )}
    </Box>
  );
}

export function TransactionAliasFormDialog({
  open,
  onClose,
  accountId,
  categories,
  institutions,
  parties,
  tags,
  alias,
  prefill,
  onSuccess,
}: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const isEditing = !!alias;

  const form = useForm<CreateTransactionAliasInput>({
    resolver: zodResolver(createTransactionAliasSchema),
    defaultValues: initDefaults(alias, prefill),
  });

  // Seções colapsáveis: Classificação sempre aberta; as demais abrem sozinhas
  // quando o apelido em edição já tem dados nelas (menos cliques para revisar).
  const [openSections, setOpenSections] = useState({
    value: false,
    fx: false,
    tagsNotes: false,
  });

  useEffect(() => {
    if (!open) return;
    const d = initDefaults(alias, prefill);
    form.reset(d);
    setOpenSections({
      value:
        d.amountCents != null ||
        d.isPending != null ||
        d.isFavorite != null ||
        !!d.investmentType ||
        !!d.cardInstallment,
      fx: !!d.originalCurrency || d.originalAmountCents != null || d.exchangeRate != null,
      tagsNotes: (d.tagIds?.length ?? 0) > 0 || !!d.notes,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, alias]);

  const trigger = form.watch("trigger");
  const categoryId = form.watch("categoryId");
  const subcatsForCategory = categories.find((c) => c.id === categoryId)?.subcategories ?? [];

  function applyErrors(error: { message: string; fieldErrors?: Record<string, string> }) {
    if (error.fieldErrors) {
      Object.entries(error.fieldErrors).forEach(([field, message]) => {
        form.setError(field as keyof CreateTransactionAliasInput, { message });
      });
    } else {
      enqueueSnackbar(error.message, { variant: "error" });
    }
  }

  async function onSubmit(values: CreateTransactionAliasInput) {
    if (isEditing) {
      const result = await updateTransactionAliasAction(accountId, {
        aliasId: alias!.id,
        ...values,
      });
      if (!result.ok) {
        applyErrors(result.error);
        return;
      }
      enqueueSnackbar(ta.updated, { variant: "success" });
      onSuccess(values, alias!.id);
      onClose();
      return;
    }

    const result = await createTransactionAliasAction(accountId, values);
    if (!result.ok) {
      applyErrors(result.error);
      return;
    }
    enqueueSnackbar(ta.created, { variant: "success" });
    onSuccess(values, result.data.id);
    onClose();
  }

  return (
    <DialogShell
      open={open}
      onClose={onClose}
      title={isEditing ? ta.editTitle : ta.createTitle}
      maxWidth="md"
      loading={form.formState.isSubmitting}
      actions={
        <>
          <Button size="small" onClick={onClose}>
            {m.common.cancel}
          </Button>
          <Button
            size="small"
            type="submit"
            form="transaction-alias-form"
            variant="contained"
            endIcon={
              form.formState.isSubmitting ? (
                <CircularProgress size={16} color="inherit" />
              ) : undefined
            }
          >
            {m.common.save}
          </Button>
        </>
      }
    >
      <form id="transaction-alias-form" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <Stack spacing={layout.stack}>
          {/* Intro — o que um apelido faz, com o mesmo ícone-motivo (varinha) */}
          <Stack
            direction="row"
            spacing={layout.inline}
            sx={{
              p: layout.stack,
              borderRadius: 2,
              bgcolor: "accent.primarySubtle",
              alignItems: "flex-start",
            }}
          >
            <AutoFixHighOutlinedIcon
              sx={{ fontSize: 18, color: "accent.primary", flexShrink: 0, mt: "1px" }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>
              {ta.formIntro}
            </Typography>
          </Stack>

          {/* Gatilho — o essencial, sempre visível */}
          <Controller
            name="trigger"
            control={form.control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label={ta.triggerLabel}
                error={!!fieldState.error}
                helperText={
                  fieldState.error?.message ??
                  (trigger.trim().length > 0 && trigger.trim().length < 3
                    ? ta.triggerShortWarning
                    : ta.triggerHint)
                }
                fullWidth
                autoFocus
                inputProps={{ maxLength: 80 }}
              />
            )}
          />

          {/* Descrição a aplicar — payload primário, sempre visível */}
          <Controller
            name="description"
            control={form.control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                value={field.value ?? ""}
                onChange={(e) => field.onChange(e.target.value || null)}
                label={ta.descriptionLabel}
                helperText={fieldState.error?.message ?? ta.descriptionHint}
                error={!!fieldState.error}
                fullWidth
                inputProps={{ maxLength: 200 }}
              />
            )}
          />

          {/* Classificação — bloco fixo (o uso mais comum) */}
          <FieldGroup title={ta.classificationSectionLabel} hint={ta.classificationHint}>
            <Box sx={twoCol}>
              <Controller
                name="categoryId"
                control={form.control}
                render={({ field }) => (
                  <LabeledField label={m.transactions.fields.category}>
                    <CreatableEntitySelect
                      value={field.value ?? null}
                      onChange={(id) => {
                        field.onChange(id);
                        form.setValue("subcategoryId", null);
                      }}
                      options={categories}
                      onCreate={noopCreate}
                      canCreate={false}
                      variant="outlined"
                      ariaLabel={m.transactions.fields.category}
                      placeholderNone={m.common.none}
                      sx={{ width: "100%" }}
                    />
                  </LabeledField>
                )}
              />

              <Controller
                name="subcategoryId"
                control={form.control}
                render={({ field, fieldState }) => (
                  <LabeledField
                    label={m.transactions.fields.subcategory}
                    error={fieldState.error?.message}
                  >
                    <CreatableEntitySelect
                      value={field.value ?? null}
                      onChange={field.onChange}
                      options={subcatsForCategory}
                      onCreate={noopCreate}
                      canCreate={false}
                      disabled={!categoryId}
                      variant="outlined"
                      ariaLabel={m.transactions.fields.subcategory}
                      placeholderNone={m.common.none}
                      sx={{ width: "100%" }}
                    />
                  </LabeledField>
                )}
              />

              <Controller
                name="institutionId"
                control={form.control}
                render={({ field }) => (
                  <LabeledField label={m.transactions.fields.institution}>
                    <CreatableEntitySelect
                      value={field.value ?? null}
                      onChange={field.onChange}
                      options={institutions}
                      onCreate={noopCreate}
                      canCreate={false}
                      variant="outlined"
                      ariaLabel={m.transactions.fields.institution}
                      placeholderNone={m.common.none}
                      sx={{ width: "100%" }}
                    />
                  </LabeledField>
                )}
              />

              <Controller
                name="responsiblePartyId"
                control={form.control}
                render={({ field }) => (
                  <LabeledField label={m.transactions.fields.responsibleUser}>
                    <ResponsiblePartySelect
                      value={field.value ?? null}
                      onChange={field.onChange}
                      parties={parties}
                      sx={{ width: "100%" }}
                      ariaLabel={m.transactions.fields.responsibleUser}
                    />
                  </LabeledField>
                )}
              />

              <Controller
                name="paymentMethod"
                control={form.control}
                render={({ field }) => (
                  <LabeledField label={m.transactions.fields.paymentMethod}>
                    <TextField
                      select
                      size="small"
                      fullWidth
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange((e.target.value || null) as TransactionPaymentMethod | null)
                      }
                      inputProps={{ "aria-label": m.transactions.fields.paymentMethod }}
                    >
                      <MenuItem value="">{m.transactions.paymentMethodNone}</MenuItem>
                      {Object.values(TransactionPaymentMethod).map((pm) => (
                        <MenuItem key={pm} value={pm}>
                          {m.transactions.paymentMethods[pm]}
                        </MenuItem>
                      ))}
                    </TextField>
                  </LabeledField>
                )}
              />
            </Box>

            {/* Tipo de transação — linha própria, toggle com ícone + texto */}
            <Box sx={{ mt: layout.stack }}>
              <Controller
                name="expenseType"
                control={form.control}
                render={({ field }) => (
                  <LabeledField
                    label={m.transactions.fields.expenseType}
                    hint={field.value ? ta.expenseTypeClearHint : undefined}
                  >
                    <ToggleButtonGroup
                      value={field.value}
                      exclusive
                      size="small"
                      aria-label={m.transactions.fields.expenseType}
                      onChange={(_e, val) =>
                        field.onChange((val as TransactionExpenseType | null) ?? null)
                      }
                    >
                      <ToggleButton value="fixed" sx={{ gap: 0.75 }}>
                        <LockOutlinedIcon fontSize="small" />
                        {m.transactions.expenseTypes.fixed}
                      </ToggleButton>
                      <ToggleButton value="variable" sx={{ gap: 0.75 }}>
                        <WavesOutlinedIcon fontSize="small" />
                        {m.transactions.expenseTypes.variable}
                      </ToggleButton>
                      <ToggleButton value="one_time" sx={{ gap: 0.75 }}>
                        <FlashOnOutlinedIcon fontSize="small" />
                        {m.transactions.expenseTypes.one_time}
                      </ToggleButton>
                    </ToggleButtonGroup>
                  </LabeledField>
                )}
              />
            </Box>
          </FieldGroup>

          {/* Valor e status */}
          <CollapsibleSection
            label={ta.behaviorSectionLabel}
            hint={ta.behaviorHint}
            open={openSections.value}
            onToggle={() => setOpenSections((s) => ({ ...s, value: !s.value }))}
          >
            <Box sx={twoCol}>
              <Controller
                name="amountCents"
                control={form.control}
                render={({ field, fieldState }) => (
                  <LabeledField
                    label={ta.amountLabel}
                    error={fieldState.error?.message}
                    hint={fieldState.error ? undefined : ta.amountHint}
                  >
                    <NumericFormat
                      customInput={TextField}
                      size="small"
                      value={field.value != null ? centsToReais(field.value) : ""}
                      thousandSeparator="."
                      decimalSeparator=","
                      decimalScale={2}
                      fixedDecimalScale
                      allowNegative
                      onValueChange={({ floatValue }) =>
                        field.onChange(floatValue !== undefined ? reaisToCents(floatValue) : null)
                      }
                      InputProps={{
                        startAdornment: <InputAdornment position="start">R$</InputAdornment>,
                      }}
                      inputProps={{ "aria-label": ta.amountLabel }}
                      fullWidth
                    />
                  </LabeledField>
                )}
              />

              <Controller
                name="investmentType"
                control={form.control}
                render={({ field }) => (
                  <LabeledField label={m.transactions.investmentTypeLabel}>
                    <TextField
                      select
                      size="small"
                      fullWidth
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value || null)}
                      inputProps={{ "aria-label": m.transactions.investmentTypeLabel }}
                    >
                      <MenuItem value="">{m.transactions.investmentTypeNone}</MenuItem>
                      {INVESTMENT_TYPES.map((t) => (
                        <MenuItem key={t} value={t}>
                          {t}
                        </MenuItem>
                      ))}
                    </TextField>
                  </LabeledField>
                )}
              />

              <Controller
                name="cardInstallment"
                control={form.control}
                render={({ field, fieldState }) => (
                  <LabeledField
                    label={m.transactions.fields.cardInstallment}
                    error={fieldState.error?.message}
                    hint={fieldState.error ? undefined : "Ex.: 3/12"}
                  >
                    <TextField
                      size="small"
                      fullWidth
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value || null)}
                      error={!!fieldState.error}
                      placeholder="3/12"
                      inputProps={{
                        inputMode: "numeric",
                        "aria-label": m.transactions.fields.cardInstallment,
                      }}
                    />
                  </LabeledField>
                )}
              />

              <Controller
                name="isPending"
                control={form.control}
                render={({ field }) => (
                  <LabeledField label={m.transactions.fields.isPending}>
                    <TextField
                      select
                      size="small"
                      fullWidth
                      value={triToOption(field.value)}
                      onChange={(e) => {
                        const v = e.target.value;
                        field.onChange(v === "" ? null : v === "true");
                      }}
                      inputProps={{ "aria-label": m.transactions.fields.isPending }}
                    >
                      <MenuItem value="">{ta.isPendingUnset}</MenuItem>
                      <MenuItem value="true">{ta.isPendingTrue}</MenuItem>
                      <MenuItem value="false">{ta.isPendingFalse}</MenuItem>
                    </TextField>
                  </LabeledField>
                )}
              />

              <Controller
                name="isFavorite"
                control={form.control}
                render={({ field }) => (
                  <LabeledField label={m.transactions.fields.isFavorite}>
                    <TextField
                      select
                      size="small"
                      fullWidth
                      value={triToOption(field.value)}
                      onChange={(e) => {
                        const v = e.target.value;
                        field.onChange(v === "" ? null : v === "true");
                      }}
                      inputProps={{ "aria-label": m.transactions.fields.isFavorite }}
                    >
                      <MenuItem value="">{ta.isFavoriteUnset}</MenuItem>
                      <MenuItem value="true">{ta.isFavoriteTrue}</MenuItem>
                      <MenuItem value="false">{ta.isFavoriteFalse}</MenuItem>
                    </TextField>
                  </LabeledField>
                )}
              />
            </Box>
          </CollapsibleSection>

          {/* Moeda estrangeira */}
          <CollapsibleSection
            label={ta.foreignCurrencySectionLabel}
            hint={ta.foreignCurrencyHint}
            open={openSections.fx}
            onToggle={() => setOpenSections((s) => ({ ...s, fx: !s.fx }))}
          >
            <Box sx={twoCol}>
              <Controller
                name="originalCurrency"
                control={form.control}
                render={({ field }) => (
                  <LabeledField label={m.transactions.foreignCurrency.currencyLabel}>
                    <TextField
                      size="small"
                      fullWidth
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(e.target.value.toUpperCase().slice(0, 3) || null)
                      }
                      inputProps={{
                        maxLength: 3,
                        "aria-label": m.transactions.foreignCurrency.currencyLabel,
                      }}
                    />
                  </LabeledField>
                )}
              />

              <Controller
                name="originalAmountCents"
                control={form.control}
                render={({ field }) => (
                  <LabeledField label={m.transactions.foreignCurrency.originalAmountLabel}>
                    <NumericFormat
                      customInput={TextField}
                      size="small"
                      value={field.value != null ? centsToReais(field.value) : ""}
                      thousandSeparator="."
                      decimalSeparator=","
                      decimalScale={2}
                      fixedDecimalScale
                      allowNegative={false}
                      onValueChange={({ floatValue }) =>
                        field.onChange(floatValue !== undefined ? reaisToCents(floatValue) : null)
                      }
                      inputProps={{
                        "aria-label": m.transactions.foreignCurrency.originalAmountLabel,
                      }}
                      fullWidth
                    />
                  </LabeledField>
                )}
              />

              <Controller
                name="exchangeRate"
                control={form.control}
                render={({ field, fieldState }) => (
                  <LabeledField
                    label={m.transactions.foreignCurrency.exchangeRateLabel}
                    error={fieldState.error?.message}
                  >
                    <NumericFormat
                      customInput={TextField}
                      size="small"
                      value={field.value ?? ""}
                      decimalSeparator=","
                      decimalScale={6}
                      allowNegative={false}
                      error={!!fieldState.error}
                      onValueChange={({ floatValue }) => field.onChange(floatValue ?? null)}
                      inputProps={{
                        "aria-label": m.transactions.foreignCurrency.exchangeRateLabel,
                      }}
                      fullWidth
                    />
                  </LabeledField>
                )}
              />
            </Box>
          </CollapsibleSection>

          {/* Tags e anotações — o menos frequente, no fim */}
          <CollapsibleSection
            label={ta.tagsNotesSectionLabel}
            hint={ta.tagsNotesHint}
            open={openSections.tagsNotes}
            onToggle={() => setOpenSections((s) => ({ ...s, tagsNotes: !s.tagsNotes }))}
          >
            <Stack spacing={layout.stack}>
              <Controller
                name="tagIds"
                control={form.control}
                render={({ field }) => {
                  const selected = tags.filter((t) => field.value.includes(t.id));
                  return (
                    <LabeledField label={ta.tagsLabel}>
                      <Autocomplete
                        multiple
                        size="small"
                        options={tags}
                        value={selected}
                        onChange={(_e, newValue) => field.onChange(newValue.map((t) => t.id))}
                        getOptionLabel={(t) => t.name}
                        isOptionEqualToValue={(a, b) => a.id === b.id}
                        noOptionsText={m.transactions.options.noOptions}
                        renderTags={(value, getTagProps) =>
                          value.map((tag, index) => {
                            const { key, ...rest } = getTagProps({ index });
                            return (
                              <Chip
                                key={key}
                                {...rest}
                                size="small"
                                label={tag.name}
                                sx={tagChipSx(tag.color)}
                              />
                            );
                          })
                        }
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            placeholder={
                              selected.length > 0 ? undefined : m.transactions.tags.noTags
                            }
                            inputProps={{ ...params.inputProps, "aria-label": ta.tagsLabel }}
                          />
                        )}
                      />
                    </LabeledField>
                  );
                }}
              />

              <Controller
                name="notes"
                control={form.control}
                render={({ field }) => (
                  <LabeledField label={m.transactions.fields.notes}>
                    <TextField
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value || null)}
                      multiline
                      minRows={2}
                      maxRows={6}
                      fullWidth
                      inputProps={{ "aria-label": m.transactions.fields.notes }}
                    />
                  </LabeledField>
                )}
              />
            </Stack>
          </CollapsibleSection>
        </Stack>
      </form>
    </DialogShell>
  );
}
