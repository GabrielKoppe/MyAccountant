"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import AddIcon from "@mui/icons-material/Add";
import ArchiveIcon from "@mui/icons-material/Archive";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import SavingsIcon from "@mui/icons-material/Savings";
import UnarchiveIcon from "@mui/icons-material/Unarchive";
import VisibilityIcon from "@mui/icons-material/Visibility";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import InputLabel from "@mui/material/InputLabel";
import ListItemIcon from "@mui/material/ListItemIcon";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";
import { useSnackbar } from "notistack";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { NumericFormat } from "react-number-format";
import type { z } from "zod";

import { createCategoryAction } from "@/actions/account-settings";
import {
  addContributionAction,
  archiveGoalAction,
  createGoalAction,
  deleteGoalAction,
  updateGoalAction,
} from "@/actions/goals";
import { GoalDetailDrawer } from "@/components/goals/GoalDetailDrawer";
import { GoalProgressBar } from "@/components/goals/GoalProgressBar";
import { PACE_VARIANT } from "@/components/goals/pace-variant";
import { useGoalDetail } from "@/components/goals/useGoalDetail";
import { CreatableEntitySelect } from "@/components/transactions/CreatableEntitySelect";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { DialogShell } from "@/components/ui/DialogShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { MoneyValue } from "@/components/ui/MoneyValue";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDateBr } from "@/lib/dates";
import { layout } from "@/lib/design-tokens";
import { useActionFeedback } from "@/lib/hooks/use-action-feedback";
import { m } from "@/lib/messages";
import { centsToReais, formatCentsToBrl, reaisToCents } from "@/lib/money";
import { addContributionSchema, createGoalSchema, type CreateGoalInput } from "@/lib/schemas/goal";
import type { SerializedGoal } from "@/lib/serializers/goal";
import type { getGoalDimensionOptions, getGoalsOverview } from "@/server/queries/goals";

type Overview = Awaited<ReturnType<typeof getGoalsOverview>>;
type DimensionOptions = Awaited<ReturnType<typeof getGoalDimensionOptions>>;

type Props = {
  accountId: string;
  overview: Overview;
  archived: SerializedGoal[];
  dimensionOptions: DimensionOptions;
  canEdit: boolean;
};

// Aportar (§5.6/§11): goalId/transactionId/responsiblePartyId não são campos do
// form — goalId vem do card clicado, transactionId/responsiblePartyId ficam para
// o fluxo de "vincular sugerido" (Fase 9). `.omit` reusa o MESMO schema (sem
// duplicar as regras de validação de amountCents/contributedOn/notes).
const contributeFieldsSchema = addContributionSchema.omit({
  goalId: true,
  transactionId: true,
  responsiblePartyId: true,
});
type ContributeFormValues = z.infer<typeof contributeFieldsSchema>;

/** "Hoje" como Date âncorado em meia-noite UTC — mesma convenção de `dateSchema`
 * (`z.coerce.date()` interpreta "YYYY-MM-DD" como UTC, ver comentário em
 * `schemas/goal.ts`). Evita `parseLocalDate` aqui de propósito: este valor tanto
 * alimenta o form quanto é o que vai no payload da action. */
function todayDateOnly(): Date {
  return new Date(new Date().toISOString().slice(0, 10));
}

function toDateInputValue(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

/**
 * Aba Metas (spec 47 §5.2, Fase 8) — hero de KPIs, grid de cards ativos, seção
 * "Arquivadas" colapsável e dialogs criar/editar/aportar/excluir. Espelha
 * `net-worth/NetWorthManager.tsx` (props derivadas via `Awaited<ReturnType<…>>`,
 * `useActionFeedback` + `useTransition`, patch otimista + `router.refresh()`).
 *
 * Drawer de detalhe (glide-path/split/sugestões/histórico) é a Fase 9 — fora
 * de escopo aqui; os cards não abrem nada ao clicar, só os botões próprios.
 *
 * Otimismo com limite deliberado: `progressCents`/`percent`/`isAchieved` são
 * aritmética pura (seguros para recomputar no client). `pace` depende de
 * média por mês fiscal + comparação com deadline (`computePace`,
 * `goal-service.ts`) — não é replicado aqui para não duplicar/divergir dessa
 * lógica; fica com o valor anterior (ou "achieved" quando óbvio) até o ajuste
 * de estado abaixo re-sincronizar com o resultado real do `router.refresh()`.
 */
export function GoalsManager({ accountId, overview, archived, dimensionOptions, canEdit }: Props) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const { handle } = useActionFeedback();
  const [isPending, startTransition] = useTransition();

  const [goals, setGoals] = useState<SerializedGoal[]>(overview.goals);
  const [archivedGoals, setArchivedGoals] = useState<SerializedGoal[]>(archived);
  // Opções de categoria do dialog criar/editar meta — em state local (não lidas
  // direto de `dimensionOptions.categories`) porque o "＋ Criar" do
  // CreatableEntitySelect (onCreateCategory abaixo) precisa injetar a opção
  // recém-criada sem esperar o round-trip de router.refresh(). Mesmo mecanismo
  // de TransactionAliasesManager.tsx: a Manager é dona da lista, a action só persiste.
  const [categoryOptions, setCategoryOptions] = useState(dimensionOptions.categories);
  const [archivedOpen, setArchivedOpen] = useState(false);

  // Re-sincroniza com o servidor sempre que o RSC pai refizer o fetch (após
  // router.refresh()) — corrige qualquer imprecisão dos patches otimistas
  // (especialmente `pace`, deliberadamente não recomputado no client acima).
  // Ajuste feito DURANTE o render, não em `useEffect` (evita a cascata de
  // re-render extra que o efeito causaria — padrão "Adjusting state when a
  // prop changes", react.dev/learn/you-might-not-need-an-effect).
  const [prevOverview, setPrevOverview] = useState(overview);
  if (overview !== prevOverview) {
    setPrevOverview(overview);
    setGoals(overview.goals);
  }
  const [prevArchived, setPrevArchived] = useState(archived);
  if (archived !== prevArchived) {
    setPrevArchived(archived);
    setArchivedGoals(archived);
  }
  const [prevDimensionOptions, setPrevDimensionOptions] = useState(dimensionOptions);
  if (dimensionOptions !== prevDimensionOptions) {
    setPrevDimensionOptions(dimensionOptions);
    setCategoryOptions(dimensionOptions.categories);
  }

  // Dialog: criar/editar meta
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SerializedGoal | null>(null);

  // Dialog: aportar
  const [contributeTarget, setContributeTarget] = useState<SerializedGoal | null>(null);

  // Dialog: excluir
  const [deleteTarget, setDeleteTarget] = useState<SerializedGoal | null>(null);

  // Menu de ações (⋮) por card
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; goal: SerializedGoal } | null>(
    null,
  );

  // Drawer de detalhe (glide-path/split/sugestões/histórico, Fase 9) — hook próprio
  // (useGoalDetail) concentra o fetch sob demanda + as mutações do drawer; ver seu
  // JSDoc para o mecanismo (espelha DrillDownDrawer, não o painel de transação da spec
  // 27 — a aba Metas não pré-carrega detalhe por card).
  const goalDetail = useGoalDetail(accountId, canEdit);

  // targetCents/amountCents abrem `undefined` (campo vazio), não `0n` — com `0n`
  // o NumericFormat mostra "R$ 0,00" e, junto de `fixedDecimalScale`, os dígitos
  // digitados no fim são descartados por `decimalScale=2` (o usuário não
  // conseguia digitar nada). `undefined` é o sentinel de "vazio" aqui porque o
  // campo é obrigatório/não-nullable no schema (os campos monetários opcionais
  // de TransactionAliasFormDialog usam `null` pelo mesmo motivo, só que lá o
  // schema é `.nullable()`) — `DefaultValues<T>` do RHF é `DeepPartial<T>`, que
  // aceita `undefined` mesmo em campos required.
  const form = useForm<CreateGoalInput>({
    resolver: zodResolver(createGoalSchema),
    defaultValues: {
      name: "",
      targetCents: undefined,
      deadline: null,
      sectionId: null,
      categoryId: null,
    },
  });

  const contributeForm = useForm<ContributeFormValues>({
    resolver: zodResolver(contributeFieldsSchema),
    defaultValues: { amountCents: undefined, contributedOn: todayDateOnly(), notes: null },
  });

  const totalTargetCents = BigInt(overview.totalTargetCents);
  const heroPercent =
    totalTargetCents > 0n ? (Number(overview.totalSavedCents) / Number(totalTargetCents)) * 100 : 0;
  const nextDeadlineGoalName = overview.nextDeadlineGoal
    ? (goals.find((g) => g.id === overview.nextDeadlineGoal!.id)?.name ?? null)
    : null;

  // Criação inline de categoria no campo do dialog (CreatableEntitySelect, "＋
  // Criar 'X'") — mesmo mecanismo de TransactionAliasesManager.tsx: cria no
  // server e injeta em `categoryOptions` (state local acima), então a opção
  // nova aparece e fica selecionada assim que o id volta.
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

  function openCreate() {
    setEditTarget(null);
    form.reset({
      name: "",
      targetCents: undefined,
      deadline: null,
      sectionId: null,
      categoryId: null,
    });
    setGoalDialogOpen(true);
  }

  function openEdit(goal: SerializedGoal) {
    setEditTarget(goal);
    form.reset({
      name: goal.name,
      targetCents: BigInt(goal.targetCents),
      deadline: goal.deadline ? new Date(goal.deadline) : null,
      sectionId: goal.sectionId,
      categoryId: goal.categoryId,
    });
    setGoalDialogOpen(true);
    setMenuAnchor(null);
  }

  function closeGoalDialog() {
    setGoalDialogOpen(false);
    setEditTarget(null);
    form.reset();
  }

  function onGoalSubmit(values: CreateGoalInput) {
    startTransition(async () => {
      if (editTarget) {
        const target = editTarget;
        const result = await updateGoalAction(accountId, { ...values, goalId: target.id });
        const ok = handle(result);
        if (!ok) return;

        // Patch otimista: só aritmética pura (percent/isAchieved a partir do
        // progressCents já conhecido) — pace fica como estava (ver nota da JSDoc).
        const newTarget = values.targetCents;
        const percent =
          newTarget > 0n ? (Number(target.progressCents) / Number(newTarget)) * 100 : 0;
        const isAchieved = BigInt(target.progressCents) >= newTarget;
        setGoals((prev) =>
          prev.map((g) =>
            g.id === target.id
              ? {
                  ...g,
                  name: values.name,
                  targetCents: newTarget.toString(),
                  deadline: values.deadline ? toDateInputValue(values.deadline) : null,
                  sectionId: values.sectionId ?? null,
                  categoryId: values.categoryId ?? null,
                  percent,
                  isAchieved,
                  pace: isAchieved ? "achieved" : g.pace,
                }
              : g,
          ),
        );
        enqueueSnackbar(m.goals.updated, { variant: "success" });
        closeGoalDialog();
        router.refresh();
      } else {
        const result = await createGoalAction(accountId, values);
        const ok = handle(result);
        if (!ok || !result.ok) return;

        // Meta recém-criada: zero contribuições é sempre exatamente correto
        // (sem matemática a duplicar) — requiredMonthlyCents fica null até o
        // refresh calcular com o mês fiscal corrente (§4.2).
        setGoals((prev) => [
          ...prev,
          {
            id: result.data.goalId,
            name: values.name,
            targetCents: values.targetCents.toString(),
            progressCents: "0",
            percent: 0,
            deadline: values.deadline ? toDateInputValue(values.deadline) : null,
            isAchieved: false,
            archivedAt: null,
            pace: "no_contribution",
            requiredMonthlyCents: null,
            projectedMonth: null,
            sectionId: values.sectionId ?? null,
            categoryId: values.categoryId ?? null,
          },
        ]);
        enqueueSnackbar(m.goals.created, { variant: "success" });
        closeGoalDialog();
        router.refresh();
      }
    });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    startTransition(async () => {
      const result = await deleteGoalAction(accountId, { goalId: target.id });
      const ok = handle(result);
      if (!ok) return;
      setGoals((prev) => prev.filter((g) => g.id !== target.id));
      enqueueSnackbar(m.goals.deleted, { variant: "success" });
      router.refresh();
    });
  }

  function toggleArchive(goal: SerializedGoal, archive: boolean) {
    setMenuAnchor(null);
    startTransition(async () => {
      const result = await archiveGoalAction(accountId, { goalId: goal.id, archived: archive });
      const ok = handle(result);
      if (!ok) return;
      if (archive) {
        setGoals((prev) => prev.filter((g) => g.id !== goal.id));
        setArchivedGoals((prev) => [{ ...goal, archivedAt: new Date().toISOString() }, ...prev]);
      } else {
        setArchivedGoals((prev) => prev.filter((g) => g.id !== goal.id));
        setGoals((prev) => [...prev, { ...goal, archivedAt: null }]);
      }
      enqueueSnackbar(archive ? m.goals.archived : m.goals.unarchived, { variant: "success" });
      router.refresh();
    });
  }

  function openDetail(goal: SerializedGoal) {
    setMenuAnchor(null);
    goalDetail.open(goal);
  }

  function openContribute(goal: SerializedGoal) {
    contributeForm.reset({ amountCents: undefined, contributedOn: todayDateOnly(), notes: null });
    setContributeTarget(goal);
    setMenuAnchor(null);
  }

  function closeContributeDialog() {
    setContributeTarget(null);
    contributeForm.reset();
  }

  function onContributeSubmit(values: ContributeFormValues) {
    if (!contributeTarget) return;
    const target = contributeTarget;
    startTransition(async () => {
      const result = await addContributionAction(accountId, {
        ...values,
        goalId: target.id,
        transactionId: null,
        responsiblePartyId: null,
      });
      const ok = handle(result);
      if (!ok) return;

      const newProgress = BigInt(target.progressCents) + values.amountCents;
      const targetCents = BigInt(target.targetCents);
      const percent = targetCents > 0n ? (Number(newProgress) / Number(targetCents)) * 100 : 0;
      const isAchieved = newProgress >= targetCents;
      setGoals((prev) =>
        prev.map((g) =>
          g.id === target.id
            ? {
                ...g,
                progressCents: newProgress.toString(),
                percent,
                isAchieved,
                pace: isAchieved ? "achieved" : g.pace === "no_contribution" ? "on_track" : g.pace,
              }
            : g,
        ),
      );
      enqueueSnackbar(m.goals.contributed, { variant: "success" });
      closeContributeDialog();
      router.refresh();
    });
  }

  return (
    <Box sx={{ p: layout.page }}>
      <Stack spacing={layout.cluster}>
        {/* ── Barra de ação (o PageHeader do hub já vem do layout — só o botão contextual) ── */}
        {canEdit && (
          <Stack direction="row" alignItems="center" justifyContent="flex-end">
            {goals.length > 0 && (
              <Typography variant="caption" sx={{ color: "text.tertiary", mr: "auto" }}>
                {m.goals.activeCount(goals.length)}
              </Typography>
            )}
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              {m.goals.newGoal}
            </Button>
          </Stack>
        )}

        {goals.length === 0 ? (
          <EmptyState
            icon={<SavingsIcon sx={{ fontSize: 48 }} />}
            // Há metas ARQUIVADAS (a seção "Arquivadas" continua renderizando logo
            // abaixo) — o texto não pode soar como se o dado tivesse sumido.
            title={archivedGoals.length > 0 ? m.goals.emptyArchivedOnly : m.goals.empty}
            description={
              archivedGoals.length > 0 ? m.goals.emptyArchivedOnlyHint : m.goals.emptyHint
            }
            action={
              canEdit ? (
                <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
                  {m.goals.newGoal}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Stack spacing={layout.cluster}>
            {/* ── Hero KPIs ── */}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, 1fr)",
                  // "Guardado" é a métrica primária do hero — mais peso que os irmãos
                  // (espelha o card de patrimônio líquido em NetWorthManager, "2fr 1fr 1fr").
                  md: "2fr 1fr 1fr 1fr",
                },
                gap: layout.cluster,
              }}
            >
              <Paper
                variant="outlined"
                sx={{ p: layout.card, display: "flex", flexDirection: "column", gap: layout.micro }}
              >
                <Typography variant="overline" sx={{ color: "text.tertiary" }}>
                  {m.goals.totalSaved}
                </Typography>
                <Typography
                  variant="mono"
                  component="div"
                  sx={{ fontSize: "1.5rem", fontWeight: 600, lineHeight: 1.2 }}
                >
                  {formatCentsToBrl(BigInt(overview.totalSavedCents))}
                </Typography>
                <Typography variant="caption" sx={{ color: "text.tertiary" }}>
                  {`${heroPercent.toFixed(0)}% · ${m.goals.totalTarget} ${formatCentsToBrl(totalTargetCents)}`}
                </Typography>
              </Paper>

              <Paper
                variant="outlined"
                sx={{ p: layout.card, display: "flex", flexDirection: "column", gap: layout.micro }}
              >
                <Typography variant="overline" sx={{ color: "text.tertiary" }}>
                  {m.goals.contributedThisMonth}
                </Typography>
                {/* Sign-aware (GOAL-06/§5.11): 0 aportado no mês fica em text.tertiary,
                    não verde fixo — verde só quando há aporte real no mês. Tamanho/mono
                    ajustado no wrapper (Box), o componente MoneyValue não muda. */}
                <Box
                  sx={{
                    fontSize: "1.25rem",
                    fontWeight: 600,
                    "& > span": { fontSize: "inherit", fontWeight: "inherit" },
                  }}
                >
                  <MoneyValue cents={BigInt(overview.contributedThisMonthCents)} variant="mono" />
                </Box>
              </Paper>

              <Paper
                variant="outlined"
                sx={{ p: layout.card, display: "flex", flexDirection: "column", gap: layout.micro }}
              >
                <Typography variant="overline" sx={{ color: "text.tertiary" }}>
                  {m.goals.nextDeadline}
                </Typography>
                {overview.nextDeadlineGoal ? (
                  <>
                    <Tooltip title={nextDeadlineGoalName ?? ""}>
                      <Typography variant="body1" sx={{ fontWeight: 600 }} noWrap>
                        {nextDeadlineGoalName}
                      </Typography>
                    </Tooltip>
                    <Typography variant="caption" sx={{ color: "text.tertiary" }}>
                      {formatDateBr(overview.nextDeadlineGoal.deadline)}
                    </Typography>
                  </>
                ) : (
                  <Typography variant="body2" sx={{ color: "text.tertiary" }}>
                    {m.goals.noUpcomingDeadline}
                  </Typography>
                )}
              </Paper>

              <Paper
                variant="outlined"
                sx={{
                  p: layout.card,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: layout.micro,
                  justifyContent: "center",
                }}
              >
                <Typography variant="overline" sx={{ color: "text.tertiary" }}>
                  {m.goals.statusOverview}
                </Typography>
                {/* U7 (fix wave): badges em row+flexWrap (antes empilhavam em coluna,
                    herdado do flexDirection:"column" do Paper pai) — unificado com o
                    mesmo padrão do hero de Orçamento (BudgetsPlanningManager.tsx). */}
                <Stack direction="row" flexWrap="wrap" gap={layout.inline}>
                  <StatusBadge variant="success">
                    {m.goals.onTrackCount(overview.counts.onTrack)}
                  </StatusBadge>
                  <StatusBadge variant="warning">
                    {m.goals.behindCount(overview.counts.behind)}
                  </StatusBadge>
                  <StatusBadge variant="success">
                    {m.goals.achievedCount(overview.counts.achieved)}
                  </StatusBadge>
                  {overview.counts.noContribution > 0 && (
                    <StatusBadge variant="neutral">
                      {`${overview.counts.noContribution} · ${m.goals.pace.no_contribution}`}
                    </StatusBadge>
                  )}
                </Stack>
              </Paper>
            </Box>

            {/* ── Grid de cards ativos ── */}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" },
                gap: layout.cluster,
              }}
            >
              {goals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  canEdit={canEdit}
                  onContribute={() => openContribute(goal)}
                  onOpenMenu={(el) => setMenuAnchor({ el, goal })}
                />
              ))}
            </Box>
          </Stack>
        )}

        {/* ── Arquivadas (fora do hero/agregado, DD-02) ── */}
        {archivedGoals.length > 0 && (
          <CollapsibleSection
            label={m.goals.archivedSection}
            badge={
              <Typography variant="caption" color="text.tertiary">
                {archivedGoals.length}
              </Typography>
            }
            open={archivedOpen}
            onToggle={() => setArchivedOpen((prev) => !prev)}
          >
            <Stack spacing={layout.stack}>
              {archivedGoals.map((goal) => (
                <ArchivedGoalRow
                  key={goal.id}
                  goal={goal}
                  canEdit={canEdit}
                  onUnarchive={() => toggleArchive(goal, false)}
                  onViewDetail={() => openDetail(goal)}
                />
              ))}
            </Stack>
          </CollapsibleSection>
        )}
      </Stack>

      {/* ── Menu de ações (⋮) por card — "Ver detalhes" sempre visível (todos os
          papéis, mesma filosofia da spec 27 FEAT-03); mutações só para canEdit ── */}
      <Menu
        anchorEl={menuAnchor?.el ?? null}
        open={!!menuAnchor}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem onClick={() => menuAnchor && openDetail(menuAnchor.goal)}>
          <ListItemIcon>
            <VisibilityIcon fontSize="small" />
          </ListItemIcon>
          {m.goals.viewDetails}
        </MenuItem>
        {canEdit && [
          <MenuItem key="edit" onClick={() => menuAnchor && openEdit(menuAnchor.goal)}>
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            {m.common.edit}
          </MenuItem>,
          <MenuItem
            key="archive"
            onClick={() => menuAnchor && toggleArchive(menuAnchor.goal, true)}
          >
            <ListItemIcon>
              <ArchiveIcon fontSize="small" />
            </ListItemIcon>
            {m.goals.archive}
          </MenuItem>,
          <Divider key="divider" />,
          <MenuItem
            key="delete"
            onClick={() => {
              if (menuAnchor) setDeleteTarget(menuAnchor.goal);
              setMenuAnchor(null);
            }}
            sx={{ color: "danger.main" }}
          >
            <ListItemIcon>
              <DeleteIcon fontSize="small" sx={{ color: "danger.main" }} />
            </ListItemIcon>
            {m.common.delete}
          </MenuItem>,
        ]}
      </Menu>

      {/* ── Drawer de detalhe (glide-path/split/sugestões/histórico, Fase 9) ── */}
      <GoalDetailDrawer
        canEdit={canEdit}
        goalDetail={goalDetail}
        onEdit={openEdit}
        onToggleArchive={toggleArchive}
        onDelete={setDeleteTarget}
      />

      {/* ── Dialog: criar/editar meta ── */}
      <DialogShell
        open={goalDialogOpen}
        onClose={closeGoalDialog}
        maxWidth="xs"
        title={editTarget ? m.goals.editGoal : m.goals.newGoal}
        loading={isPending}
        actions={
          <>
            <Button size="small" onClick={closeGoalDialog}>
              {m.common.cancel}
            </Button>
            <Button
              size="small"
              type="submit"
              form="goal-form"
              variant="contained"
              endIcon={isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {m.common.save}
            </Button>
          </>
        }
      >
        <form id="goal-form" onSubmit={form.handleSubmit(onGoalSubmit)} noValidate>
          <Stack spacing={layout.stack}>
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label={m.goals.fields.name}
                  placeholder={m.goals.fields.namePlaceholder}
                  fullWidth
                  autoFocus
                  inputProps={{ maxLength: 80 }}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />

            <Controller
              name="targetCents"
              control={form.control}
              render={({ field, fieldState }) => (
                <NumericFormat
                  customInput={TextField}
                  label={m.goals.fields.targetCents}
                  fullWidth
                  value={field.value != null ? centsToReais(field.value) : ""}
                  thousandSeparator="."
                  decimalSeparator=","
                  decimalScale={2}
                  fixedDecimalScale
                  allowNegative={false}
                  onValueChange={({ floatValue }) =>
                    field.onChange(floatValue !== undefined ? reaisToCents(floatValue) : undefined)
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
              name="deadline"
              control={form.control}
              render={({ field, fieldState }) => (
                <TextField
                  type="date"
                  label={m.goals.fields.deadline}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                  inputProps={{ min: toDateInputValue(todayDateOnly()) }}
                  value={toDateInputValue(field.value)}
                  onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : null)}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />

            <Controller
              name="sectionId"
              control={form.control}
              render={({ field }) => (
                <FormControl fullWidth>
                  <InputLabel id="goal-section-label">{m.goals.fields.section}</InputLabel>
                  <Select
                    labelId="goal-section-label"
                    label={m.goals.fields.section}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value === "" ? null : e.target.value)}
                  >
                    <MenuItem value="">{m.goals.fields.noDimension}</MenuItem>
                    {dimensionOptions.sections.map((s) => (
                      <MenuItem key={s.id} value={s.id}>
                        {s.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />

            <Controller
              name="categoryId"
              control={form.control}
              render={({ field }) => (
                <CreatableEntitySelect
                  value={field.value ?? null}
                  onChange={field.onChange}
                  options={categoryOptions}
                  onCreate={onCreateCategory}
                  canCreate={canEdit}
                  variant="outlined"
                  label={m.goals.fields.category}
                  ariaLabel={m.goals.fields.category}
                  placeholderNone={m.goals.fields.noDimension}
                  sx={{ width: "100%" }}
                />
              )}
            />
          </Stack>
        </form>
      </DialogShell>

      {/* ── Dialog: aportar ── */}
      <DialogShell
        open={!!contributeTarget}
        onClose={closeContributeDialog}
        maxWidth="xs"
        title={m.goals.contributeTitle}
        description={contributeTarget?.name}
        loading={isPending}
        actions={
          <>
            <Button size="small" onClick={closeContributeDialog}>
              {m.common.cancel}
            </Button>
            <Button
              size="small"
              type="submit"
              form="contribute-form"
              variant="contained"
              endIcon={isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {m.common.save}
            </Button>
          </>
        }
      >
        <form
          id="contribute-form"
          onSubmit={contributeForm.handleSubmit(onContributeSubmit)}
          noValidate
        >
          <Stack spacing={layout.stack}>
            <Controller
              name="amountCents"
              control={contributeForm.control}
              render={({ field, fieldState }) => (
                <NumericFormat
                  customInput={TextField}
                  label={m.goals.fields.amount}
                  fullWidth
                  autoFocus
                  value={field.value != null ? centsToReais(field.value) : ""}
                  thousandSeparator="."
                  decimalSeparator=","
                  decimalScale={2}
                  fixedDecimalScale
                  allowNegative={false}
                  onValueChange={({ floatValue }) =>
                    field.onChange(floatValue !== undefined ? reaisToCents(floatValue) : undefined)
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
              name="contributedOn"
              control={contributeForm.control}
              render={({ field, fieldState }) => (
                <TextField
                  type="date"
                  label={m.goals.fields.date}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                  inputProps={{ max: toDateInputValue(todayDateOnly()) }}
                  value={toDateInputValue(field.value)}
                  onChange={(e) => {
                    if (e.target.value) field.onChange(new Date(e.target.value));
                  }}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />

            <Controller
              name="notes"
              control={contributeForm.control}
              render={({ field }) => (
                <TextField
                  label={m.goals.fields.notes}
                  fullWidth
                  multiline
                  minRows={2}
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value || null)}
                />
              )}
            />
          </Stack>
        </form>
      </DialogShell>

      {/* ── Dialog: confirmar exclusão ── */}
      <DialogShell
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        maxWidth="xs"
        title={m.goals.deleteGoal}
        description={m.goals.deleteConfirm(deleteTarget?.name ?? "")}
        actions={
          <>
            <Button size="small" onClick={() => setDeleteTarget(null)}>
              {m.common.cancel}
            </Button>
            <Button size="small" color="error" variant="contained" onClick={confirmDelete}>
              {m.common.delete}
            </Button>
          </>
        }
      />
    </Box>
  );
}

// ─── Card de meta ativa (grid da aba Metas, §5.2) ──────────────────────────

type GoalCardProps = {
  goal: SerializedGoal;
  canEdit: boolean;
  onContribute: () => void;
  onOpenMenu: (el: HTMLElement) => void;
};

function GoalCard({ goal, canEdit, onContribute, onOpenMenu }: GoalCardProps) {
  return (
    <Paper
      variant="outlined"
      sx={{ p: layout.card, display: "flex", flexDirection: "column", gap: layout.card }}
    >
      <Stack direction="column" gap={layout.inline} sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }} noWrap>
          {goal.name}
        </Typography>

        <GoalProgressBar
          progressCents={goal.progressCents}
          targetCents={goal.targetCents}
          percent={goal.percent}
        />

        <Stack direction="row" alignItems="center" gap={layout.inline} flexWrap="wrap">
          <StatusBadge variant={PACE_VARIANT[goal.pace]}>{m.goals.pace[goal.pace]}</StatusBadge>
          {!goal.isAchieved && goal.requiredMonthlyCents !== null && (
            <Typography variant="caption" sx={{ color: "text.tertiary" }}>
              {m.goals.monthlyNeeded(formatCentsToBrl(BigInt(goal.requiredMonthlyCents)))}
            </Typography>
          )}
        </Stack>
      </Stack>

      {/* "Aportar" só para quem edita; o ⋮ fica sempre visível — viewer usa só a
          entrada "Ver detalhes" dele (espelha spec 27 FEAT-03: menu sempre presente,
          itens condicionais ao papel). */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent={canEdit ? "space-between" : "flex-end"}
      >
        {canEdit && (
          <Button size="small" variant="contained" onClick={onContribute}>
            {m.goals.contribute}
          </Button>
        )}
        <IconButton
          size="small"
          aria-label={`${m.common.moreActions} — ${goal.name}`}
          onClick={(e) => onOpenMenu(e.currentTarget)}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Stack>
    </Paper>
  );
}

// ─── Linha de meta arquivada (seção "Arquivadas", §5.2) ────────────────────

type ArchivedGoalRowProps = {
  goal: SerializedGoal;
  canEdit: boolean;
  onUnarchive: () => void;
  onViewDetail: () => void;
};

function ArchivedGoalRow({ goal, canEdit, onUnarchive, onViewDetail }: ArchivedGoalRowProps) {
  // Sem opacity no Paper inteiro (baixaria o contraste do StatusBadge junto —
  // ver fix de StatusBadge.tsx). De-ênfase só no nome (cor/peso), não no bloco todo.
  return (
    <Paper variant="outlined" sx={{ px: layout.card, py: layout.stack }}>
      <Stack direction="row" alignItems="center" gap={layout.inline}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Tooltip title={goal.name}>
            <Typography variant="body2" noWrap>
              {goal.name}
            </Typography>
          </Tooltip>
          <GoalProgressBar
            compact
            progressCents={goal.progressCents}
            targetCents={goal.targetCents}
            percent={goal.percent}
          />
        </Box>

        {/* U4 (fix wave): badge neutro fixo — toda meta desta linha está arquivada,
            "Atrasado"/"Adiantado" (PACE_VARIANT) não faz sentido fora do tracking
            ativo. Mesma correção já aplicada no header do drawer de detalhe. */}
        <StatusBadge variant="neutral">{m.goals.archivedBadge}</StatusBadge>

        <Tooltip title={m.goals.viewDetails}>
          <IconButton
            size="small"
            aria-label={`${m.goals.viewDetails} — ${goal.name}`}
            onClick={onViewDetail}
            sx={{ flexShrink: 0 }}
          >
            <VisibilityIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {canEdit && (
          <Button
            size="small"
            startIcon={<UnarchiveIcon fontSize="small" />}
            onClick={onUnarchive}
            sx={{ flexShrink: 0 }}
          >
            {m.goals.unarchive}
          </Button>
        )}
      </Stack>
    </Paper>
  );
}
