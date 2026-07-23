"use client";

import ArchiveIcon from "@mui/icons-material/Archive";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import LinkIcon from "@mui/icons-material/Link";
import UnarchiveIcon from "@mui/icons-material/Unarchive";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import { useTheme } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { useState } from "react";

import { ChartSkeleton } from "@/components/dashboards/charts/ChartSkeleton";
import { DialogShell } from "@/components/ui/DialogShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { MoneyValue } from "@/components/ui/MoneyValue";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDateBr } from "@/lib/dates";
import { getChartColors, layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import { formatCentsToBrl } from "@/lib/money";
import type { SerializedGoal } from "@/lib/serializers/goal";
import type { GoalDetail, GoalDetailHistoryEntry, GoalSuggestion } from "@/server/queries/goals";

import { PACE_VARIANT } from "./pace-variant";
import type { useGoalDetail } from "./useGoalDetail";

// Lazy — mantém recharts fora do bundle inicial (espelha NetWorthManager.tsx). O
// glide-path só existe dentro do drawer, então o corte de código só se paga aqui.
const GoalGlidePathChart = dynamic(
  () => import("./GoalGlidePathChart").then((mod) => mod.GoalGlidePathChart),
  { ssr: false, loading: () => <ChartSkeleton height={220} /> },
);

type Props = {
  canEdit: boolean;
  /** Instância única do hook, criada no `GoalsManager` (o clique que abre o drawer
   * dispara o fetch de lá — ver JSDoc de `useGoalDetail`). */
  goalDetail: ReturnType<typeof useGoalDetail>;
  onEdit: (goal: SerializedGoal) => void;
  onToggleArchive: (goal: SerializedGoal, archived: boolean) => void;
  onDelete: (goal: SerializedGoal) => void;
};

/**
 * Drawer de detalhe da meta (spec 47 §5.3, Fase 9): glide-path + split por membro +
 * aportes sugeridos + histórico, via `DialogShell` (nunca `<Dialog>` cru — CLAUDE.md
 * §5.11). Editar/Arquivar/Excluir NÃO duplicam lógica — chamam de volta os callbacks
 * que já existem no `GoalsManager` (Fase 8); o drawer só fecha antes de repassar,
 * evitando ficar aberto com um `target` desatualizado (mesmo handoff "fecha o detalhe →
 * abre o fluxo" da spec 27 §7.4 para o botão Editar da transação).
 */
export function GoalDetailDrawer({
  canEdit,
  goalDetail,
  onEdit,
  onToggleArchive,
  onDelete,
}: Props) {
  const {
    target,
    detail,
    suggestions,
    suggestionsDimensionLabel,
    loading,
    mutating,
    close,
    linkSuggestion,
    removeContribution,
  } = goalDetail;

  const [linkTarget, setLinkTarget] = useState<GoalSuggestion | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GoalDetailHistoryEntry | null>(null);

  // Estatística do header: prefere o `detail.goal` (recém-buscado, mais preciso) e cai
  // para o `target` (resumo do card, disponível na hora) enquanto o fetch não resolve —
  // evita o header nascer vazio durante o loading.
  const headerGoal = detail?.goal ?? target;

  function handleEdit() {
    if (!target) return;
    close();
    onEdit(target);
  }

  function handleToggleArchive() {
    if (!target) return;
    const archived = target.archivedAt === null;
    close();
    onToggleArchive(target, archived);
  }

  function handleDelete() {
    if (!target) return;
    close();
    onDelete(target);
  }

  function confirmLink() {
    if (!linkTarget) return;
    linkSuggestion(linkTarget.id);
    setLinkTarget(null);
  }

  function confirmDeleteContribution() {
    if (!deleteTarget) return;
    removeContribution(deleteTarget.id);
    setDeleteTarget(null);
  }

  return (
    <>
      <DialogShell
        open={!!target}
        onClose={close}
        maxWidth="md"
        title={target?.name ?? ""}
        description={headerGoal ? <HeaderSummary goal={headerGoal} /> : undefined}
        loading={mutating}
        actions={
          canEdit && target ? (
            <>
              <Button size="small" startIcon={<EditIcon fontSize="small" />} onClick={handleEdit}>
                {m.common.edit}
              </Button>
              <Button
                size="small"
                startIcon={
                  target.archivedAt === null ? (
                    <ArchiveIcon fontSize="small" />
                  ) : (
                    <UnarchiveIcon fontSize="small" />
                  )
                }
                onClick={handleToggleArchive}
              >
                {target.archivedAt === null ? m.goals.archive : m.goals.unarchive}
              </Button>
              <Button
                size="small"
                color="error"
                startIcon={<DeleteIcon fontSize="small" />}
                onClick={handleDelete}
              >
                {m.common.delete}
              </Button>
            </>
          ) : undefined
        }
      >
        {!detail ? (
          loading ? (
            <Stack spacing={layout.section}>
              <ChartSkeleton height={220} />
              <Skeleton variant="rounded" height={64} />
              <Skeleton variant="rounded" height={64} />
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {m.errors.notFound}
            </Typography>
          )
        ) : (
          <Stack spacing={layout.card}>
            <Stack spacing={layout.stack}>
              <SectionHeader>{m.goals.glidePathTitle}</SectionHeader>
              <GoalGlidePathChart series={detail.glidePath} height={220} />
            </Stack>

            <Divider />
            
            <SplitSection split={detail.split} />

            {/* Sugestões só para quem edita (§5.2 — "sugestões ocultas" para viewer);
                a própria busca já é pulada no hook quando !canEdit. */}
            {canEdit && (
              <>
                <Divider />
                <SuggestionsSection
                  suggestions={suggestions}
                  dimensionLabel={suggestionsDimensionLabel}
                  onLink={setLinkTarget}
                />
              </>
            )}

            <Divider />
            <HistorySection history={detail.history} canEdit={canEdit} onDelete={setDeleteTarget} />
          </Stack>
        )}
      </DialogShell>

      {/* Confirmar vincular sugestão (§5.6 — "1 clique confirma", mostra valor/tx) */}
      <DialogShell
        open={!!linkTarget}
        onClose={() => setLinkTarget(null)}
        maxWidth="xs"
        title={m.goals.suggestionLink}
        loading={mutating}
        description={
          linkTarget ? (
            <Stack spacing={layout.micro} sx={{ mt: layout.inline }}>
              <Typography variant="body2">{m.goals.suggestionConfirm}</Typography>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                gap={layout.inline}
              >
                <Typography variant="body2" color="text.secondary" noWrap>
                  {`${linkTarget.description ?? m.goals.noDescription} · ${formatDateBr(linkTarget.occurredOn)}`}
                </Typography>
                <MoneyValue cents={BigInt(linkTarget.amountCents)} variant="body2" />
              </Stack>
            </Stack>
          ) : undefined
        }
        actions={
          <>
            <Button size="small" onClick={() => setLinkTarget(null)}>
              {m.common.cancel}
            </Button>
            <Button size="small" variant="contained" onClick={confirmLink}>
              {m.goals.suggestionLink}
            </Button>
          </>
        }
      />

      {/* Confirmar exclusão de aporte do histórico */}
      <DialogShell
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        maxWidth="xs"
        title={m.goals.deleteContribution}
        loading={mutating}
        description={
          deleteTarget
            ? m.goals.deleteContributionConfirm(
                `${formatCentsToBrl(BigInt(deleteTarget.amountCents))} (${
                  deleteTarget.byUserName ?? m.goals.removedUser
                }, ${formatDateBr(deleteTarget.contributedOn)})`,
              )
            : undefined
        }
        actions={
          <>
            <Button size="small" onClick={() => setDeleteTarget(null)}>
              {m.common.cancel}
            </Button>
            <Button
              size="small"
              color="error"
              variant="contained"
              onClick={confirmDeleteContribution}
            >
              {m.common.delete}
            </Button>
          </>
        }
      />
    </>
  );
}

// ─── Cabeçalho (description do DialogShell) ────────────────────────────────

function HeaderSummary({ goal }: { goal: SerializedGoal }) {
  return (
    <Stack direction="row" alignItems="center" gap={layout.inline} flexWrap="wrap">
      {/* U8 (fix wave): MONO_SX reinventado alinhado ao caminho comum (variant="mono"
          do tema), mesmo usado em GoalProgressBar/BudgetProgressBar. */}
      <Typography variant="mono" sx={{ fontWeight: 600, color: "text.primary" }}>
        {`${formatCentsToBrl(BigInt(goal.progressCents))} / ${formatCentsToBrl(BigInt(goal.targetCents))} (${Math.round(goal.percent)}%)`}
      </Typography>
      {goal.archivedAt !== null ? (
        // Meta arquivada (§5.2, DD-02): ritmo (pace) sai do tracking ativo — "Atrasado"/
        // "Adiantado" não fazem sentido aqui. Badge neutro fixo em vez do PACE_VARIANT.
        <StatusBadge variant="neutral">{m.goals.archivedBadge}</StatusBadge>
      ) : (
        <StatusBadge variant={PACE_VARIANT[goal.pace]}>{m.goals.pace[goal.pace]}</StatusBadge>
      )}
      {goal.deadline && (
        <Typography variant="body2" sx={{ color: "text.tertiary" }}>
          {m.goals.deadlineLabel(formatDateBr(goal.deadline))}
        </Typography>
      )}
      {!goal.isAchieved && goal.requiredMonthlyCents !== null && (
        <Typography variant="body2" sx={{ color: "text.tertiary" }}>
          {m.goals.monthlyNeeded(formatCentsToBrl(BigInt(goal.requiredMonthlyCents)))}
        </Typography>
      )}
    </Stack>
  );
}

// ─── Seções do corpo ────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <Typography variant="overline" sx={{ color: "text.tertiary" }}>
      {children}
    </Typography>
  );
}

function SplitSection({ split }: { split: GoalDetail["split"] }) {
  const theme = useTheme();
  const palette = getChartColors(theme.palette.mode as "light" | "dark");

  return (
    <Stack spacing={layout.stack}>
      <SectionHeader>{m.goals.splitTitle}</SectionHeader>
      <Stack spacing={layout.stack}>
        {split.map((s, i) => (
          <Box key={s.userId}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="baseline"
              gap={layout.inline}
            >
              <Typography variant="body2" noWrap>
                {s.userName}
              </Typography>
              <Typography variant="mono" noWrap>
                {`${formatCentsToBrl(BigInt(s.totalCents))} (${Math.round(s.percent)}%)`}
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={Math.min(Math.max(s.percent, 0), 100)}
              sx={{
                height: 6,
                borderRadius: 3,
                mt: layout.micro,
                bgcolor: "action.hover",
                "& .MuiLinearProgress-bar": { bgcolor: palette[i % palette.length] },
              }}
            />
          </Box>
        ))}
      </Stack>
    </Stack>
  );
}

function SuggestionsSection({
  suggestions,
  dimensionLabel,
  onLink,
}: {
  suggestions: GoalSuggestion[];
  dimensionLabel: string | null;
  onLink: (s: GoalSuggestion) => void;
}) {
  return (
    <Stack spacing={layout.stack}>
      <SectionHeader>
        {dimensionLabel
          ? m.goals.suggestionsTitleWithDimension(dimensionLabel)
          : m.goals.suggestionsTitle}
      </SectionHeader>
      {suggestions.length === 0 ? (
        <EmptyState size="compact" title={m.goals.suggestionsEmpty} />
      ) : (
        <Stack spacing={layout.stack}>
          {suggestions.map((s) => (
            <Stack key={s.id} direction="row" alignItems="center" gap={layout.inline}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" noWrap>
                  {s.description ?? (
                    <Typography
                      component="span"
                      variant="body2"
                      sx={{ color: "text.disabled", fontStyle: "italic" }}
                    >
                      {m.goals.noDescription}
                    </Typography>
                  )}
                </Typography>
                <Typography variant="caption" sx={{ color: "text.tertiary" }}>
                  {formatDateBr(s.occurredOn)}
                </Typography>
              </Box>
              <MoneyValue cents={BigInt(s.amountCents)} variant="body2" />
              <Button size="small" onClick={() => onLink(s)} sx={{ flexShrink: 0 }}>
                {m.goals.suggestionLink}
              </Button>
            </Stack>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function HistorySection({
  history,
  canEdit,
  onDelete,
}: {
  history: GoalDetailHistoryEntry[];
  canEdit: boolean;
  onDelete: (h: GoalDetailHistoryEntry) => void;
}) {
  return (
    <Stack spacing={layout.stack}>
      <SectionHeader>{m.goals.historyTitle}</SectionHeader>
      {history.length === 0 ? (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {m.goals.historyEmpty}
        </Typography>
      ) : (
        <Stack spacing={layout.stack}>
          {history.map((h) => (
            <Stack key={h.id} direction="row" alignItems="center" gap={layout.inline}>
              <Typography
                variant="caption"
                sx={{ color: "text.tertiary", width: 76, flexShrink: 0 }}
              >
                {formatDateBr(h.contributedOn)}
              </Typography>
              <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
                {h.byUserName ?? m.goals.removedUser}
              </Typography>
              {h.transactionId && (
                <Tooltip title={m.goals.linkedToTransaction}>
                  <LinkIcon sx={{ fontSize: 14, color: "text.tertiary", flexShrink: 0 }} />
                </Tooltip>
              )}
              <MoneyValue cents={BigInt(h.amountCents)} variant="body2" />
              {canEdit && (
                <IconButton
                  size="small"
                  aria-label={`${m.goals.deleteContribution} — ${formatCentsToBrl(BigInt(h.amountCents))}`}
                  onClick={() => onDelete(h)}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              )}
            </Stack>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
