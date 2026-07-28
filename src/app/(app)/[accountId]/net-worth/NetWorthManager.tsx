"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { SvgIconComponent } from "@mui/icons-material";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import AddIcon from "@mui/icons-material/Add";
import ArchiveIcon from "@mui/icons-material/Archive";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import SyncIcon from "@mui/icons-material/Sync";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingFlatIcon from "@mui/icons-material/TrendingFlat";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import UnarchiveIcon from "@mui/icons-material/Unarchive";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useSnackbar } from "notistack";
import { useMemo, useState, useTransition } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { NumericFormat } from "react-number-format";

import { createInstitutionAction } from "@/actions/account-settings";
import {
  archiveBalanceAccountAction,
  createBalanceAccountAction,
  deleteBalanceAccountAction,
  updateBalanceAccountAction,
  upsertBalanceSnapshotsAction,
} from "@/actions/net-worth";
import { ChartSkeleton } from "@/components/dashboards/charts/ChartSkeleton";
import { CreatableEntitySelect } from "@/components/transactions/CreatableEntitySelect";
import { DialogShell } from "@/components/ui/DialogShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { MoneyValue } from "@/components/ui/MoneyValue";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageInfoButton } from "@/components/ui/PageInfoButton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDateBr, parseLocalDate } from "@/lib/dates";
import { layout } from "@/lib/design-tokens";
import { useActionFeedback } from "@/lib/hooks/use-action-feedback";
import { m } from "@/lib/messages";
import { formatCentsToBrl, parseBrlMaskToCents, centsToBrlInput } from "@/lib/money";
import {
  createBalanceAccountSchema,
  type CreateBalanceAccountInput,
} from "@/lib/schemas/balance-account";
import type { getNetWorthOverview, getNetWorthSeries } from "@/server/queries/net-worth";

// Lazy — mantém recharts fora do bundle inicial (Fase 8).
const NetWorthEvolutionChart = dynamic(
  () =>
    import("@/components/net-worth/NetWorthEvolutionChart").then(
      (mod) => mod.NetWorthEvolutionChart,
    ),
  { ssr: false, loading: () => <ChartSkeleton height={260} /> },
);

type Overview = Awaited<ReturnType<typeof getNetWorthOverview>>;
type SeriesPoint = Awaited<ReturnType<typeof getNetWorthSeries>>[number];
type BalanceAccountRow = Overview["accounts"][number];
type InstitutionOption = { id: string; name: string };

type Props = {
  accountId: string;
  overview: Overview;
  series: SeriesPoint[];
  institutions: InstitutionOption[];
  canEdit: boolean;
};

const STALE_DAYS = 35;

function isStale(capturedOn: string): boolean {
  const diffMs = Date.now() - parseLocalDate(capturedOn).getTime();
  return diffMs > STALE_DAYS * 24 * 60 * 60 * 1000;
}

function deltaVisual(pct: number | null): { Icon: SvgIconComponent; color: string } | null {
  if (pct === null) return null;
  if (pct > 0) return { Icon: TrendingUpIcon, color: "success.main" };
  if (pct === 0) return { Icon: TrendingFlatIcon, color: "text.disabled" };
  return { Icon: TrendingDownIcon, color: "error.main" };
}

type BalanceEntryForm = { balanceAccountId: string; name: string; balanceInput: string };
type BalancesFormValues = { capturedOn: string; entries: BalanceEntryForm[] };

export function NetWorthManager({ accountId, overview, series, institutions, canEdit }: Props) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const { handle } = useActionFeedback();
  const [isPending, startTransition] = useTransition();

  const [accounts, setAccounts] = useState<BalanceAccountRow[]>(overview.accounts);
  // Opções de instituição do dialog criar/editar conta — em state local (não lidas
  // direto da prop `institutions`) porque o "＋ Criar" do CreatableEntitySelect
  // (onCreateInstitution abaixo) precisa injetar a opção recém-criada sem esperar
  // o round-trip de router.refresh(). Mesmo mecanismo de GoalsManager.tsx
  // (categoryOptions) e TransactionAliasesManager.tsx: a Manager é dona da lista,
  // a action só persiste.
  const [institutionOptions, setInstitutionOptions] = useState<InstitutionOption[]>(institutions);

  // Re-sincroniza com o servidor sempre que o RSC pai refizer o fetch (após
  // router.refresh()) — cobre o caso de outra sessão/aba ter criado uma instituição
  // nesse meio tempo. Ajuste feito DURANTE o render, não em `useEffect` (evita a
  // cascata de re-render extra que o efeito causaria — padrão "Adjusting state
  // when a prop changes", react.dev/learn/you-might-not-need-an-effect; mesmo
  // idioma de GoalsManager.tsx).
  const [prevInstitutions, setPrevInstitutions] = useState(institutions);
  if (institutions !== prevInstitutions) {
    setPrevInstitutions(institutions);
    setInstitutionOptions(institutions);
  }

  // Dialog: criar/editar conta
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<BalanceAccountRow | null>(null);

  // Dialog: excluir
  const [deleteTarget, setDeleteTarget] = useState<BalanceAccountRow | null>(null);

  // Dialog: atualizar saldos (bulk ou de uma única conta, via menu de linha)
  const [balanceIds, setBalanceIds] = useState<string[] | null>(null);

  // Menu de ações por linha
  const [menuAnchor, setMenuAnchor] = useState<{
    el: HTMLElement;
    account: BalanceAccountRow;
  } | null>(null);

  const netCents = BigInt(overview.netCents);
  const delta = deltaVisual(overview.deltaPct);

  const assets = useMemo(
    () => accounts.filter((a) => a.kind === "asset").sort((a, b) => a.name.localeCompare(b.name)),
    [accounts],
  );
  const liabilities = useMemo(
    () =>
      accounts.filter((a) => a.kind === "liability").sort((a, b) => a.name.localeCompare(b.name)),
    [accounts],
  );
  const activeAccounts = useMemo(() => accounts.filter((a) => a.archivedAt === null), [accounts]);

  const form = useForm<CreateBalanceAccountInput>({
    resolver: zodResolver(createBalanceAccountSchema),
    defaultValues: { kind: "asset", name: "", institutionId: null },
  });

  const balancesForm = useForm<BalancesFormValues>({
    defaultValues: { capturedOn: new Date().toISOString().slice(0, 10), entries: [] },
  });
  const { fields } = useFieldArray({ control: balancesForm.control, name: "entries" });

  // Criação inline de instituição no campo do dialog (CreatableEntitySelect, "＋
  // Criar 'X'") — mesmo mecanismo de GoalsManager.tsx (onCreateCategory): cria no
  // server e injeta em `institutionOptions` (state local acima), então a opção
  // nova aparece e fica selecionada assim que o id volta.
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

  function openCreate() {
    setEditTarget(null);
    form.reset({ kind: "asset", name: "", institutionId: null });
    setAccountDialogOpen(true);
  }

  function openEdit(account: BalanceAccountRow) {
    setEditTarget(account);
    form.reset({ kind: account.kind, name: account.name, institutionId: account.institutionId });
    setAccountDialogOpen(true);
    setMenuAnchor(null);
  }

  function closeAccountDialog() {
    setAccountDialogOpen(false);
    setEditTarget(null);
    form.reset();
  }

  function onAccountSubmit(values: CreateBalanceAccountInput) {
    startTransition(async () => {
      if (editTarget) {
        const result = await updateBalanceAccountAction(accountId, {
          balanceAccountId: editTarget.id,
          name: values.name,
          institutionId: values.institutionId ?? null,
        });
        const ok = handle(result);
        if (!ok) return;
        const institutionName =
          institutionOptions.find((i) => i.id === values.institutionId)?.name ?? null;
        setAccounts((prev) =>
          prev.map((a) =>
            a.id === editTarget.id
              ? {
                  ...a,
                  name: values.name,
                  institutionId: values.institutionId ?? null,
                  institutionName,
                }
              : a,
          ),
        );
        enqueueSnackbar(m.netWorth.updated, { variant: "success" });
        closeAccountDialog();
        router.refresh();
      } else {
        const result = await createBalanceAccountAction(accountId, values);
        const ok = handle(result);
        if (!ok || !result.ok) return;
        const institutionName =
          institutionOptions.find((i) => i.id === values.institutionId)?.name ?? null;
        setAccounts((prev) => [
          ...prev,
          {
            id: result.data.balanceAccountId,
            kind: values.kind,
            name: values.name,
            institutionId: values.institutionId ?? null,
            institutionName,
            archivedAt: null,
            latestSnapshot: null,
          },
        ]);
        enqueueSnackbar(m.netWorth.created, { variant: "success" });
        closeAccountDialog();
        router.refresh();
      }
    });
  }

  function toggleArchive(account: BalanceAccountRow) {
    setMenuAnchor(null);
    const archived = account.archivedAt === null;
    startTransition(async () => {
      const result = await archiveBalanceAccountAction(accountId, {
        balanceAccountId: account.id,
        archived,
      });
      const ok = handle(result);
      if (!ok) return;
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === account.id
            ? { ...a, archivedAt: archived ? new Date().toISOString() : null }
            : a,
        ),
      );
      enqueueSnackbar(archived ? m.netWorth.archived : m.netWorth.updated, { variant: "success" });
      router.refresh();
    });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    startTransition(async () => {
      const result = await deleteBalanceAccountAction(accountId, { balanceAccountId: target.id });
      const ok = handle(result);
      if (!ok) return;
      setAccounts((prev) => prev.filter((a) => a.id !== target.id));
      enqueueSnackbar(m.netWorth.deleted, { variant: "success" });
      router.refresh();
    });
  }

  function openBalancesDialog(ids: string[]) {
    const entries: BalanceEntryForm[] = ids.map((id) => {
      const acc = accounts.find((a) => a.id === id);
      return {
        balanceAccountId: id,
        name: acc?.name ?? "",
        balanceInput: acc?.latestSnapshot
          ? centsToBrlInput(BigInt(acc.latestSnapshot.balanceCents))
          : "",
      };
    });
    balancesForm.reset({ capturedOn: new Date().toISOString().slice(0, 10), entries });
    setBalanceIds(ids);
    setMenuAnchor(null);
  }

  function closeBalancesDialog() {
    setBalanceIds(null);
    balancesForm.reset();
  }

  function onBalancesSubmit(values: BalancesFormValues) {
    const entries = values.entries.map((e) => ({
      balanceAccountId: e.balanceAccountId,
      balanceCents: parseBrlMaskToCents(e.balanceInput || "0"),
    }));
    startTransition(async () => {
      const result = await upsertBalanceSnapshotsAction(accountId, {
        capturedOn: values.capturedOn,
        entries,
      });
      const ok = handle(result);
      if (!ok) return;
      setAccounts((prev) =>
        prev.map((a) => {
          const entry = entries.find((e) => e.balanceAccountId === a.id);
          if (!entry) return a;
          return {
            ...a,
            latestSnapshot: {
              balanceCents: entry.balanceCents.toString(),
              capturedOn: values.capturedOn,
            },
          };
        }),
      );
      enqueueSnackbar(m.netWorth.balancesSaved, { variant: "success" });
      closeBalancesDialog();
      router.refresh();
    });
  }

  return (
    <Box sx={{ p: layout.page }}>
      <PageHeader
        title={m.netWorth.title}
        actions={
          <Stack direction="row" spacing={layout.inline}>
            <PageInfoButton guide={m.netWorth.guide} />
            {canEdit && (
              <>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<SyncIcon />}
                  disabled={activeAccounts.length === 0}
                  onClick={() => openBalancesDialog(activeAccounts.map((a) => a.id))}
                  sx={{
                    color: "text.secondary",
                    borderColor: "divider",
                    "&:hover": { borderColor: "divider" },
                  }}
                >
                  {m.netWorth.updateBalances}
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={openCreate}
                >
                  {m.netWorth.newAccount}
                </Button>
              </>
            )}
          </Stack>
        }
      />

      {accounts.length === 0 ? (
        <EmptyState
          icon={<AccountBalanceWalletIcon sx={{ fontSize: 48 }} />}
          title={m.netWorth.title}
          description={m.netWorth.empty}
          action={
            canEdit ? (
              <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
                {m.netWorth.newAccount}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Stack spacing={layout.page}>
          {/* ── Hero KPI + cards Ativos/Passivos ── */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "2fr 1fr 1fr" },
              gap: layout.page,
            }}
          >
            <Paper
              variant="outlined"
              sx={{ p: layout.card, display: "flex", flexDirection: "column", gap: layout.micro }}
            >
              <Typography variant="overline" sx={{ color: "text.tertiary" }}>
                {m.netWorth.title}
              </Typography>
              <Typography
                variant="mono"
                component="div"
                sx={{ fontSize: "1.5rem", fontWeight: 600, lineHeight: 1.2 }}
              >
                {formatCentsToBrl(netCents)}
              </Typography>
              {delta && (
                <Box sx={{ display: "flex", alignItems: "center", gap: layout.micro }}>
                  <delta.Icon sx={{ fontSize: 18, color: delta.color }} />
                  <Typography variant="body2" sx={{ color: delta.color, fontWeight: 500 }}>
                    {`${overview.deltaPct! > 0 ? "+" : ""}${overview.deltaPct!.toFixed(1)}%`}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.tertiary" }}>
                    {m.netWorth.vsPrevMonth}
                  </Typography>
                </Box>
              )}
            </Paper>

            <SummaryCard
              label={m.netWorth.assets}
              cents={BigInt(overview.assetsCents)}
              color="success.main"
              bg="success.light"
            />
            <SummaryCard
              label={m.netWorth.liabilities}
              cents={BigInt(overview.liabilitiesCents)}
              color="danger.main"
              bg="danger.subtle"
            />
          </Box>

          {/* ── Gráfico de evolução (Fase 8, lazy) ── */}
          <Paper variant="outlined" sx={{ p: layout.card }}>
            <Stack spacing={layout.stack}>
              <Stack direction="row" alignItems="center" gap={layout.inline}>
                <ShowChartIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {m.dashboards.widgets.yearly["net-worth-evolution"]}
                </Typography>
              </Stack>
              <NetWorthEvolutionChart series={series} />
            </Stack>
          </Paper>

          {/* ── Listas Ativos / Passivos ── */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
              gap: layout.cluster,
            }}
          >
            <Stack spacing={layout.stack}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {m.netWorth.assets}
              </Typography>
              {assets.length === 0 ? (
                <Typography variant="body2" color="text.tertiary">
                  {m.common.none}
                </Typography>
              ) : (
                <Stack spacing={layout.inline}>
                  {assets.map((account) => (
                    <AccountRow
                      key={account.id}
                      account={account}
                      canEdit={canEdit}
                      onOpenMenu={(el) => setMenuAnchor({ el, account })}
                    />
                  ))}
                </Stack>
              )}
            </Stack>

            <Stack spacing={layout.stack}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {m.netWorth.liabilities}
              </Typography>
              {liabilities.length === 0 ? (
                <Typography variant="body2" color="text.tertiary">
                  {m.common.none}
                </Typography>
              ) : (
                <Stack spacing={layout.inline}>
                  {liabilities.map((account) => (
                    <AccountRow
                      key={account.id}
                      account={account}
                      canEdit={canEdit}
                      onOpenMenu={(el) => setMenuAnchor({ el, account })}
                    />
                  ))}
                </Stack>
              )}
            </Stack>
          </Box>
        </Stack>
      )}

      {/* ── Menu de ações por linha ── */}
      <Menu
        anchorEl={menuAnchor?.el ?? null}
        open={!!menuAnchor}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem onClick={() => menuAnchor && openEdit(menuAnchor.account)}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          {m.common.edit}
        </MenuItem>
        {menuAnchor && menuAnchor.account.archivedAt === null && (
          <MenuItem onClick={() => openBalancesDialog([menuAnchor.account.id])}>
            <ListItemIcon>
              <SyncIcon fontSize="small" />
            </ListItemIcon>
            {m.netWorth.updateBalances}
          </MenuItem>
        )}
        <MenuItem onClick={() => menuAnchor && toggleArchive(menuAnchor.account)}>
          <ListItemIcon>
            {menuAnchor?.account.archivedAt ? (
              <UnarchiveIcon fontSize="small" />
            ) : (
              <ArchiveIcon fontSize="small" />
            )}
          </ListItemIcon>
          {menuAnchor?.account.archivedAt ? m.netWorth.unarchive : m.netWorth.archive}
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            if (menuAnchor) setDeleteTarget(menuAnchor.account);
            setMenuAnchor(null);
          }}
          sx={{ color: "danger.main" }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" sx={{ color: "danger.main" }} />
          </ListItemIcon>
          {m.common.delete}
        </MenuItem>
      </Menu>

      {/* ── Dialog: criar/editar conta ── */}
      <DialogShell
        open={accountDialogOpen}
        onClose={closeAccountDialog}
        maxWidth="xs"
        title={editTarget ? m.common.edit : m.netWorth.newAccount}
        loading={isPending}
        actions={
          <>
            <Button size="small" onClick={closeAccountDialog}>
              {m.common.cancel}
            </Button>
            <Button
              size="small"
              type="submit"
              form="ba-form"
              variant="contained"
              endIcon={isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {m.common.save}
            </Button>
          </>
        }
      >
        <form id="ba-form" onSubmit={form.handleSubmit(onAccountSubmit)} noValidate>
          <Stack spacing={layout.stack}>
            <Controller
              name="kind"
              control={form.control}
              render={({ field }) => (
                <ToggleButtonGroup
                  exclusive
                  value={field.value}
                  disabled={!!editTarget}
                  onChange={(_e, v: "asset" | "liability" | null) => v && field.onChange(v)}
                  sx={{ width: "100%" }}
                >
                  <ToggleButton value="asset" sx={{ flex: 1 }}>
                    {m.netWorth.kindAsset}
                  </ToggleButton>
                  <ToggleButton value="liability" sx={{ flex: 1 }}>
                    {m.netWorth.kindLiability}
                  </ToggleButton>
                </ToggleButtonGroup>
              )}
            />

            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label={m.netWorth.nameLabel}
                  fullWidth
                  autoFocus
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />

            <Controller
              name="institutionId"
              control={form.control}
              render={({ field }) => (
                <CreatableEntitySelect
                  value={field.value ?? null}
                  onChange={field.onChange}
                  options={institutionOptions}
                  onCreate={onCreateInstitution}
                  canCreate={canEdit}
                  variant="outlined"
                  label={m.netWorth.institutionLabel}
                  ariaLabel={m.netWorth.institutionLabel}
                  placeholderNone={m.common.none}
                  sx={{ width: "100%" }}
                />
              )}
            />
          </Stack>
        </form>
      </DialogShell>

      {/* ── Dialog: atualizar saldos (bulk ou única conta) ── */}
      <DialogShell
        open={balanceIds !== null}
        onClose={closeBalancesDialog}
        maxWidth="sm"
        title={m.netWorth.updateBalances}
        loading={isPending}
        actions={
          <>
            <Button size="small" onClick={closeBalancesDialog}>
              {m.common.cancel}
            </Button>
            <Button
              size="small"
              type="submit"
              form="balances-form"
              variant="contained"
              endIcon={isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {m.common.save}
            </Button>
          </>
        }
      >
        <form id="balances-form" onSubmit={balancesForm.handleSubmit(onBalancesSubmit)} noValidate>
          <Stack spacing={layout.stack}>
            <Controller
              name="capturedOn"
              control={balancesForm.control}
              render={({ field }) => (
                <TextField
                  {...field}
                  type="date"
                  label={m.netWorth.dateLabel}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              )}
            />

            <Stack spacing={layout.stack}>
              {fields.map((field, index) => (
                <Controller
                  key={field.id}
                  name={`entries.${index}.balanceInput`}
                  control={balancesForm.control}
                  render={({ field: f }) => (
                    <NumericFormat
                      customInput={TextField}
                      fullWidth
                      size="small"
                      label={field.name}
                      InputLabelProps={{ shrink: true }}
                      prefix="R$ "
                      thousandSeparator="."
                      decimalSeparator=","
                      decimalScale={2}
                      fixedDecimalScale
                      allowNegative
                      value={f.value}
                      onValueChange={(v) => f.onChange(v.formattedValue.replace("R$ ", ""))}
                    />
                  )}
                />
              ))}
            </Stack>
          </Stack>
        </form>
      </DialogShell>

      {/* ── Dialog: confirmar exclusão ── */}
      <DialogShell
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        maxWidth="xs"
        title={m.netWorth.deleteTitle}
        description={m.netWorth.deleteConfirm}
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

// ─── Card resumo (Ativos / Passivos) ─────────────────────────────────────

type SummaryCardProps = { label: string; cents: bigint; color: string; bg: string };

function SummaryCard({ label, cents, color, bg }: SummaryCardProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: layout.card,
        bgcolor: bg,
        display: "flex",
        flexDirection: "column",
        gap: layout.micro,
      }}
    >
      <Typography variant="overline" sx={{ color: "text.tertiary" }}>
        {label}
      </Typography>
      <Typography
        variant="mono"
        component="div"
        sx={{ fontSize: "1.2rem", fontWeight: 600, color }}
      >
        {formatCentsToBrl(cents)}
      </Typography>
    </Paper>
  );
}

// ─── Linha de conta patrimonial (Ativos/Passivos) ─────────────────────────

type AccountRowProps = {
  account: BalanceAccountRow;
  canEdit: boolean;
  onOpenMenu: (el: HTMLElement) => void;
};

function AccountRow({ account, canEdit, onOpenMenu }: AccountRowProps) {
  const isArchived = account.archivedAt !== null;
  const stale = account.latestSnapshot ? isStale(account.latestSnapshot.capturedOn) : false;

  return (
    <Paper
      variant="outlined"
      sx={{ px: layout.card, py: layout.stack, opacity: isArchived ? 0.6 : 1 }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: layout.inline }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight="medium" noWrap>
            {account.name}
          </Typography>
          <Typography variant="caption" color="text.tertiary" noWrap>
            {account.institutionName ?? m.common.none}
          </Typography>
        </Box>

        <Stack alignItems="flex-end" spacing={0.25} sx={{ flexShrink: 0 }}>
          {account.latestSnapshot ? (
            account.kind === "liability" ? (
              // Passivo: cor por contexto (danger), NUNCA <MoneyValue> cru (pintaria de verde).
              <Typography variant="mono" sx={{ color: "danger.main", fontWeight: 500 }}>
                {formatCentsToBrl(BigInt(account.latestSnapshot.balanceCents))}
              </Typography>
            ) : (
              <MoneyValue cents={BigInt(account.latestSnapshot.balanceCents)} variant="mono" />
            )
          ) : (
            <Typography variant="caption" color="text.tertiary">
              —
            </Typography>
          )}

          {account.latestSnapshot &&
            (stale ? (
              <StatusBadge variant="warning">
                {m.netWorth.staleSince.replace(
                  "{when}",
                  formatDateBr(account.latestSnapshot.capturedOn),
                )}
              </StatusBadge>
            ) : (
              <Typography variant="caption" color="text.tertiary">
                {formatDateBr(account.latestSnapshot.capturedOn)}
              </Typography>
            ))}
        </Stack>

        {canEdit && (
          <IconButton size="small" onClick={(e) => onOpenMenu(e.currentTarget)}>
            <MoreVertIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
    </Paper>
  );
}
