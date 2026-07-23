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
import { useEffect, useMemo, useState, useTransition } from "react";
import { Controller, useForm, type Control, type DefaultValues } from "react-hook-form";
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

/** Nomes das dimensões (chaves do form que são arrays de ids). */
type DimField =
  | "sectionIds"
  | "categoryIds"
  | "memberUserIds"
  | "institutionIds"
  | "tableTypeIds";

/**
 * Uma dimensão do orçamento como MULTI-select (Spec 25 — cada dimensão é um ARRAY de
 * ids). Encapsula o `Controller` + `CreatableEntitySelect multiple` + a caption de erro
 * (o schema aponta os erros para `sectionIds`/`categoryIds`/`tableTypeIds`), evitando
 * repetir o mesmo boilerplate cinco vezes no JSX. Seção/Membro/Tipo de tabela passam
 * `canCreate={false}` (não se cria essas entidades inline); Categoria/Instituição
 * passam `canCreate` + o `onCreate` real.
 */
function MultiDimField({
  control,
  name,
  label,
  options,
  canCreate,
  onCreate,
  gridColumn,
}: {
  control: Control<CreateBudgetInput>;
  name: DimField;
  label: string;
  options: DimOption[];
  canCreate: boolean;
  onCreate: (value: string) => Promise<string | null>;
  gridColumn?: string;
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Box sx={{ gridColumn }}>
          <CreatableEntitySelect
            multiple
            value={field.value ?? []}
            onChange={field.onChange}
            options={options}
            onCreate={onCreate}
            canCreate={canCreate}
            variant="outlined"
            label={label}
            ariaLabel={label}
            placeholderNone={m.budgets.fields.noDimension}
            sx={{ width: "100%" }}
          />
          {fieldState.error && (
            <Typography variant="caption" color="error" sx={{ mt: 0.5, display: "block" }}>
              {fieldState.error.message}
            </Typography>
          )}
        </Box>
      )}
    />
  );
}

// Dimensões não-criáveis (seção, membro, tipo de tabela) ainda precisam de um `onCreate`
// pela assinatura do componente, mas ele nunca é chamado: com `canCreate={false}` a opção
// "＋ Criar" não é injetada e `resolveName` devolve null antes de tentar criar.
const noCreate = (): Promise<string | null> => Promise.resolve(null);

function initDefaults(budget?: BudgetWithDetails): DefaultValues<CreateBudgetInput> {
  if (!budget) {
    return {
      name: "",
      sectionIds: [],
      categoryIds: [],
      memberUserIds: [],
      institutionIds: [],
      tableTypeIds: [],
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
    sectionIds: budget.sectionIds,
    categoryIds: budget.categoryIds,
    memberUserIds: budget.memberUserIds,
    institutionIds: budget.institutionIds,
    tableTypeIds: budget.tableTypeIds,
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
 * As 5 dimensões (seção, categoria, membro, instituição, tipo de tabela) são
 * MULTI-select via `CreatableEntitySelect multiple` (Spec 25 — cada dimensão é um
 * ARRAY de ids; a semântica de interseção AND-entre/OR-dentro vive em
 * `queries/budgets.ts`). Categoria e Instituição têm `canCreate` + criação inline
 * (mesmo mecanismo de `GoalsManager`/`NetWorthManager`: state local de opções +
 * injeção otimista no `onCreate`, resincronizado durante o render se `formOptions`
 * mudar). Seção, Membro e Tipo de tabela usam `canCreate={false}` — não se cria essas
 * entidades a partir daqui. Categoria/Instituição não recebem prop de papel porque os
 * dois call-sites só renderizam/abrem o dialog para quem já tem papel editor (o botão
 * "+" some quando `!canEdit`); o server (`createCategoryAction`/`createInstitutionAction`)
 * re-valida o papel de qualquer forma.
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

  // Responsáveis não são criáveis (sem state local): só normaliza o shape para o
  // `CreatableEntitySelect` (`{ id, name }`). `name` já vem resolvido (partyDisplayMap).
  const memberOptions = useMemo<DimOption[]>(
    () => formOptions.members.map((mb) => ({ id: mb.id, name: mb.name })),
    [formOptions.members],
  );

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
            <Typography variant="overline" sx={{ mb: 1, display: "block" }}>
              {m.budgets.form.dimensionsTitle}
            </Typography>
            {form.formState.errors.sectionIds && (
              <Typography variant="caption" color="error" sx={{ mb: 1, display: "block" }}>
                {form.formState.errors.sectionIds.message}
              </Typography>
            )}
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
              <MultiDimField
                control={form.control}
                name="sectionIds"
                label={m.budgets.fields.section}
                options={formOptions.sections}
                canCreate={false}
                onCreate={noCreate}
              />
              <MultiDimField
                control={form.control}
                name="categoryIds"
                label={m.budgets.fields.category}
                options={categoryOptions}
                canCreate
                onCreate={onCreateCategory}
              />
              <MultiDimField
                control={form.control}
                name="memberUserIds"
                label={m.budgets.fields.member}
                options={memberOptions}
                canCreate={false}
                onCreate={noCreate}
              />
              <MultiDimField
                control={form.control}
                name="institutionIds"
                label={m.budgets.fields.institution}
                options={institutionOptions}
                canCreate
                onCreate={onCreateInstitution}
              />
              <MultiDimField
                control={form.control}
                name="tableTypeIds"
                label={m.budgets.fields.tableType}
                options={formOptions.tableTypes}
                canCreate={false}
                onCreate={noCreate}
                gridColumn="span 2"
              />
            </Box>
          </Box>

          <Divider />

          {/* ── Meta ── */}
          <Box>
            <Typography variant="overline" sx={{ mb: 1.5, display: "block" }}>
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
            <Typography variant="overline" sx={{ mb: 0.5, display: "block" }}>
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
