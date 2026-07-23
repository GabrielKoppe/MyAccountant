"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import { useEffect, useState, useTransition } from "react";
import { Controller, useForm, type DefaultValues } from "react-hook-form";
import { NumericFormat } from "react-number-format";

import { createCategoryAction, createInstitutionAction } from "@/actions/account-settings";
import { createBudgetAction, updateBudgetAction } from "@/actions/budgets";
import { CreatableEntitySelect } from "@/components/transactions/CreatableEntitySelect";
import { DialogShell } from "@/components/ui/DialogShell";
import { MONTH_NAMES } from "@/lib/dates";
import { useActionFeedback } from "@/lib/hooks/use-action-feedback";
import { m } from "@/lib/messages";
import { centsToReais, reaisToCents } from "@/lib/money";
import { createBudgetSchema, type CreateBudgetInput } from "@/lib/schemas/budget";
import type { BudgetWithDetails, BudgetFormOptions } from "@/server/queries/budgets";

type Props = {
  open: boolean;
  onClose: () => void;
  accountId: string;
  formOptions: BudgetFormOptions;
  budget?: BudgetWithDetails;
  onSuccess: (budgetId: string) => void;
};

type DimOption = BudgetFormOptions["categories"][number];

// Dimensões (sectionId/categoryId/.../tableTypeId) são `string | undefined` no schema
// (createBudgetSchema usa só `.optional()`, sem `.nullable()` — diferente de Goal/NetWorth,
// que usam `null` pra "nenhuma"). `CreatableEntitySelect` fala `string | null`; estes dois
// helpers fazem a ponte sem espalhar `?? undefined`/`?? null` pelo JSX abaixo.
function toSelectValue(id: string | undefined): string | null {
  return id ?? null;
}
function fromSelectValue(id: string | null): string | undefined {
  return id ?? undefined;
}

function initDefaults(budget?: BudgetWithDetails): DefaultValues<CreateBudgetInput> {
  if (!budget) {
    return {
      name: "",
      sectionId: undefined,
      categoryId: undefined,
      memberUserId: undefined,
      institutionId: undefined,
      tableTypeId: undefined,
      // Vazio (não 0n): com valor fixo, o NumericFormat mostraria "R$ 0,00" e, junto de
      // fixedDecimalScale, os dígitos digitados no fim seriam descartados — mesma nota de
      // GoalsManager.tsx (campo targetCents). `DefaultValues<T>` do RHF é `DeepPartial<T>`,
      // que aceita `undefined` mesmo este campo sendo `bigint` (não-opcional) no schema.
      amountCents: undefined,
      alertThresholdPercent: 80,
      isRecurring: true,
      showInSummary: false,
      year: null,
      month: null,
    };
  }
  return {
    name: budget.name ?? "",
    sectionId: budget.sectionId ?? undefined,
    categoryId: budget.categoryId ?? undefined,
    memberUserId: budget.memberUserId ?? undefined,
    institutionId: budget.institutionId ?? undefined,
    tableTypeId: budget.tableTypeId ?? undefined,
    amountCents: BigInt(budget.amountCents),
    alertThresholdPercent: budget.alertThresholdPercent,
    isRecurring: budget.isRecurring,
    showInSummary: budget.showInSummary,
    year: budget.year,
    month: budget.month,
  };
}

/**
 * Dialog criar/editar orçamento (spec 47 §3.5) — compartilhado entre a aba Orçamento
 * (`BudgetsPlanningManager`) e o widget do dashboard mensal (`BudgetsWidget`); ver o
 * JSDoc de ambos para o motivo de não haver otimismo específico aqui (só o toast +
 * `onSuccess`, quem chama decide se dá `router.refresh()`).
 *
 * Reescrito para o padrão RHF + `zodResolver` do projeto — antes: `useState` + um
 * `validate()` manual duplicando as regras de `createBudgetSchema` (e um bug de
 * mascaramento: `TextField` cru pro valor deixava digitar "." como separador de milhar
 * "de graça", então "1.234,56" virava R$ 123.456,00 sem nenhum aviso). O `.superRefine`
 * do schema já cobre "pelo menos uma dimensão" + os conflitos seção×categoria/tipo de
 * tabela — os erros aparecem via `fieldState.error`/`formState.errors`, zero regra
 * duplicada no componente.
 *
 * Categoria e Instituição usam `CreatableEntitySelect` (mesmo mecanismo de
 * `GoalsManager`/`NetWorthManager`: state local de opções + injeção otimista no
 * `onCreate`, resincronizado durante o render se `formOptions` mudar). As outras três
 * dimensões (seção, membro, tipo de tabela) continuam `<TextField select>` comum.
 * `canCreate` é sempre `true` — diferente daqueles dois managers, este dialog não
 * recebe prop de papel porque os dois call-sites só o renderizam/abrem para quem já
 * tem papel editor (o botão "+" some quando `!canEdit`); o server
 * (`createCategoryAction`/`createInstitutionAction`) re-valida o papel de qualquer forma.
 */
export function BudgetFormDialog({
  open,
  onClose,
  accountId,
  formOptions,
  budget,
  onSuccess,
}: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const { handle } = useActionFeedback();
  const [isPending, startTransition] = useTransition();

  const isEditing = !!budget;

  // Opções de categoria/instituição do dialog — em state local (não lidas direto de
  // `formOptions`) porque o "＋ Criar" do CreatableEntitySelect (onCreateCategory/
  // onCreateInstitution abaixo) precisa injetar a opção recém-criada sem esperar o
  // round-trip de router.refresh() do pai. Mesmo mecanismo de GoalsManager.tsx
  // (categoryOptions) e NetWorthManager.tsx (institutionOptions).
  const [categoryOptions, setCategoryOptions] = useState<DimOption[]>(formOptions.categories);
  const [institutionOptions, setInstitutionOptions] = useState<DimOption[]>(
    formOptions.institutions,
  );

  // Re-sincroniza com o servidor sempre que o pai refizer o fetch de formOptions —
  // ajuste feito DURANTE o render, não em useEffect (evita re-render extra, "Adjusting
  // state when a prop changes", react.dev/learn/you-might-not-need-an-effect; mesmo
  // idioma de GoalsManager.tsx/NetWorthManager.tsx).
  const [prevFormOptions, setPrevFormOptions] = useState(formOptions);
  if (formOptions !== prevFormOptions) {
    setPrevFormOptions(formOptions);
    setCategoryOptions(formOptions.categories);
    setInstitutionOptions(formOptions.institutions);
  }

  const form = useForm<CreateBudgetInput>({
    resolver: zodResolver(createBudgetSchema),
    defaultValues: initDefaults(budget),
  });

  // Dialog é standalone (open/budget vêm por prop; não há openCreate/openEdit internos
  // como em GoalsManager) — reseta ao ABRIR, mesmo padrão de TransactionAliasFormDialog.tsx.
  useEffect(() => {
    if (!open) return;
    form.reset(initDefaults(budget));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, budget]);

  const isRecurring = form.watch("isRecurring");

  // Criação inline de categoria/instituição (CreatableEntitySelect, "＋ Criar 'X'") —
  // mesmo mecanismo de GoalsManager.tsx/NetWorthManager.tsx: cria no server e injeta na
  // lista local, então a opção nova aparece e fica selecionada assim que o id volta.
  async function onCreateCategory(name: string): Promise<string | null> {
    const result = await createCategoryAction(accountId, { name });
    const ok = handle(result);
    if (!ok || !result.ok) return null;
    setCategoryOptions((prev) =>
      [...prev, { id: result.data.categoryId, name }].sort((a, b) => a.name.localeCompare(b.name)),
    );
    enqueueSnackbar(m.transactions.options.created, { variant: "success" });
    return result.data.categoryId;
  }

  async function onCreateInstitution(name: string): Promise<string | null> {
    const result = await createInstitutionAction(accountId, { name });
    const ok = handle(result);
    if (!ok || !result.ok) return null;
    setInstitutionOptions((prev) =>
      [...prev, { id: result.data.institutionId, name }].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    );
    enqueueSnackbar(m.transactions.options.created, { variant: "success" });
    return result.data.institutionId;
  }

  function onSubmit(values: CreateBudgetInput) {
    // Nome vazio vira `null` (não string vazia) — mesma normalização do form antigo
    // (`form.name.trim() || null`); o service só troca `null`/`undefined` por `null`
    // (`input.name ?? null`), não uma string vazia.
    const payload = { ...values, name: values.name || null };

    startTransition(async () => {
      if (isEditing) {
        const result = await updateBudgetAction(accountId, { ...payload, budgetId: budget!.id });
        const ok = handle(result);
        if (!ok) return;
        enqueueSnackbar(m.budgets.updated, { variant: "success" });
        onSuccess(budget!.id);
        onClose();
        return;
      }

      const result = await createBudgetAction(accountId, payload);
      const ok = handle(result);
      if (!ok || !result.ok) return;
      enqueueSnackbar(m.budgets.created, { variant: "success" });
      onSuccess(result.data.budgetId);
      onClose();
    });
  }

  return (
    <DialogShell
      open={open}
      onClose={onClose}
      title={isEditing ? m.budgets.editTitle : m.budgets.createTitle}
      maxWidth="sm"
      loading={isPending}
      actions={
        <>
          <Button size="small" onClick={onClose}>
            {m.common.cancel}
          </Button>
          <Button
            size="small"
            type="submit"
            form="budget-form"
            variant="contained"
            endIcon={isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {m.common.save}
          </Button>
        </>
      }
    >
      <form id="budget-form" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <Stack spacing={2.5}>
          {/* ── Dimensões ── */}
          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                mb: 1,
                display: "block",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontSize: "0.65rem",
              }}
            >
              {m.budgets.form.dimensionsTitle}
            </Typography>
            {form.formState.errors.sectionId && (
              <Typography variant="caption" color="error" sx={{ mb: 1, display: "block" }}>
                {form.formState.errors.sectionId.message}
              </Typography>
            )}
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
              <Controller
                name="sectionId"
                control={form.control}
                render={({ field, fieldState }) => (
                  <TextField
                    select
                    size="small"
                    label={m.budgets.fields.section}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value || undefined)}
                    error={!!fieldState.error}
                  >
                    <MenuItem value="">{m.budgets.fields.noDimension}</MenuItem>
                    {formOptions.sections.map((s) => (
                      <MenuItem key={s.id} value={s.id}>
                        {s.name}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />

              <Controller
                name="categoryId"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Box>
                    <CreatableEntitySelect
                      value={toSelectValue(field.value)}
                      onChange={(id) => field.onChange(fromSelectValue(id))}
                      options={categoryOptions}
                      onCreate={onCreateCategory}
                      canCreate
                      variant="outlined"
                      label={m.budgets.fields.category}
                      ariaLabel={m.budgets.fields.category}
                      placeholderNone={m.budgets.fields.noDimension}
                      sx={{ width: "100%" }}
                    />
                    {fieldState.error && (
                      <Typography
                        variant="caption"
                        color="error"
                        sx={{ mt: 0.5, display: "block" }}
                      >
                        {fieldState.error.message}
                      </Typography>
                    )}
                  </Box>
                )}
              />

              <Controller
                name="memberUserId"
                control={form.control}
                render={({ field }) => (
                  <TextField
                    select
                    size="small"
                    label={m.budgets.fields.member}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value || undefined)}
                  >
                    <MenuItem value="">{m.budgets.fields.noDimension}</MenuItem>
                    {formOptions.members.map((mb) => (
                      <MenuItem key={mb.id} value={mb.id}>
                        {mb.name ?? mb.email}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />

              <Controller
                name="institutionId"
                control={form.control}
                render={({ field }) => (
                  <CreatableEntitySelect
                    value={toSelectValue(field.value)}
                    onChange={(id) => field.onChange(fromSelectValue(id))}
                    options={institutionOptions}
                    onCreate={onCreateInstitution}
                    canCreate
                    variant="outlined"
                    label={m.budgets.fields.institution}
                    ariaLabel={m.budgets.fields.institution}
                    placeholderNone={m.budgets.fields.noDimension}
                    sx={{ width: "100%" }}
                  />
                )}
              />

              <Controller
                name="tableTypeId"
                control={form.control}
                render={({ field, fieldState }) => (
                  <TextField
                    select
                    size="small"
                    label={m.budgets.fields.tableType}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value || undefined)}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                    sx={{ gridColumn: "span 2" }}
                  >
                    <MenuItem value="">{m.budgets.fields.noDimension}</MenuItem>
                    {formOptions.tableTypes.map((t) => (
                      <MenuItem key={t.id} value={t.id}>
                        {t.name}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
            </Box>
          </Box>

          <Divider />

          {/* ── Meta ── */}
          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                mb: 1.5,
                display: "block",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontSize: "0.65rem",
              }}
            >
              {m.budgets.form.goalTitle}
            </Typography>
            <Stack spacing={1.5}>
              <Controller
                name="amountCents"
                control={form.control}
                render={({ field, fieldState }) => (
                  <NumericFormat
                    customInput={TextField}
                    size="small"
                    label={m.budgets.fields.amount}
                    value={field.value != null ? centsToReais(field.value) : ""}
                    thousandSeparator="."
                    decimalSeparator=","
                    decimalScale={2}
                    fixedDecimalScale
                    allowNegative={false}
                    onValueChange={({ floatValue }) =>
                      field.onChange(
                        floatValue !== undefined ? reaisToCents(floatValue) : undefined,
                      )
                    }
                    InputProps={{
                      startAdornment: <InputAdornment position="start">R$</InputAdornment>,
                    }}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />

              <Controller
                name="alertThresholdPercent"
                control={form.control}
                render={({ field, fieldState }) => (
                  <TextField
                    size="small"
                    label={m.budgets.fields.alertThreshold}
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(e.target.value === "" ? undefined : Number(e.target.value))
                    }
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message ?? m.budgets.fields.alertThresholdHint}
                    type="number"
                    inputProps={{ min: 1, max: 99 }}
                    InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                  />
                )}
              />

              <Controller
                name="name"
                control={form.control}
                render={({ field }) => (
                  <TextField
                    size="small"
                    label={m.budgets.fields.name}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value)}
                    placeholder={m.budgets.fields.namePlaceholder}
                    inputProps={{ maxLength: 80 }}
                  />
                )}
              />
            </Stack>
          </Box>

          <Divider />

          {/* ── Quando ── */}
          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                mb: 0.5,
                display: "block",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontSize: "0.65rem",
              }}
            >
              {m.budgets.form.periodTitle}
            </Typography>
            <Controller
              name="isRecurring"
              control={form.control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={field.value}
                      onChange={(e) => {
                        field.onChange(e.target.checked);
                        // Orçamento recorrente não tem mês/ano específico (o schema barra a
                        // combinação) — limpa ao marcar, pra não sobrar um valor escondido
                        // que dispararia esse erro no submit.
                        if (e.target.checked) {
                          form.setValue("year", null);
                          form.setValue("month", null);
                        }
                      }}
                      size="small"
                    />
                  }
                  label={<Typography variant="body2">{m.budgets.fields.isRecurring}</Typography>}
                />
              )}
            />

            {!isRecurring && (
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5, mt: 1 }}>
                <Controller
                  name="year"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <TextField
                      size="small"
                      label={m.budgets.fields.year}
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(e.target.value === "" ? null : Number(e.target.value))
                      }
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                      type="number"
                      inputProps={{ min: 2000, max: 2100 }}
                    />
                  )}
                />
                <Controller
                  name="month"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <TextField
                      select
                      size="small"
                      label={m.budgets.fields.month}
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(e.target.value === "" ? null : Number(e.target.value))
                      }
                      error={!!fieldState.error}
                    >
                      <MenuItem value="">{m.budgets.fields.noDimension}</MenuItem>
                      {MONTH_NAMES.map((name, i) => (
                        <MenuItem key={i + 1} value={i + 1}>
                          {name}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </Box>
            )}

            <Controller
              name="showInSummary"
              control={form.control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                      size="small"
                    />
                  }
                  label={<Typography variant="body2">{m.budgets.fields.showInSummary}</Typography>}
                  sx={{ mt: 0.5 }}
                />
              )}
            />
          </Box>
        </Stack>
      </form>
    </DialogShell>
  );
}
