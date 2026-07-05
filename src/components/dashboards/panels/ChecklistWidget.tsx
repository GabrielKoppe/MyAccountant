"use client";

import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import LinkIcon from "@mui/icons-material/Link";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import { useOptimistic, useState, useTransition } from "react";

import {
  createChecklistItemAction,
  toggleChecklistCompletionAction,
  unlinkChecklistTransactionAction,
} from "@/actions/checklist";
import { WIDGET_ICONS } from "@/components/dashboards/_core/widget-icons";
import { WidgetContainer } from "@/components/ui/WidgetContainer";
import { formatDateShort } from "@/lib/dates";
import { m } from "@/lib/messages";
import { formatCentsToBrl } from "@/lib/money";
import type { ChecklistMonthItem } from "@/server/services/checklist-service";

import { LinkChecklistTransactionDialog } from "./LinkChecklistTransactionDialog";

const ChecklistIcon = WIDGET_ICONS["checklist"];

// "YYYY-MM-DD" → "DD/MM" (mesma convenção de data curta do ActivityWidget).
function formatDayMonth(occurredOn: string): string {
  return `${occurredOn.slice(8, 10)}/${occurredOn.slice(5, 7)}`;
}

type Density = "compact" | "default" | "full";

export type ChecklistWidgetProps = {
  accountId: string;
  monthId: string;
  // Itens do template + estado de conclusão do mês (pré-carregado no RSC).
  items: ChecklistMonthItem[];
  // Papel do usuário — viewer é read-only (checkboxes desabilitados, sem add).
  canEdit: boolean;
  renderMode: Density;
};

// A exclusão de item (que remove o template de TODOS os meses) fica só na página de
// configurações, atrás de um dialog de confirmação — não no widget (evita footgun).
export function ChecklistWidget({
  accountId,
  monthId,
  items,
  canEdit,
  renderMode = "default",
}: ChecklistWidgetProps) {
  const { enqueueSnackbar } = useSnackbar();
  const cw = m.dashboards.checklistWidget;
  const [isPending, startTransition] = useTransition();
  const [addInput, setAddInput] = useState("");
  const [linkTarget, setLinkTarget] = useState<ChecklistMonthItem | null>(null);

  // Base do otimista = prop vinda do RSC (§3.9 item 2). revalidateMonth reconcilia
  // após a action — sem useState(props), sem useEffect/remount.
  const [optimisticItems, applyToggle] = useOptimistic(
    items,
    (state, update: { itemId: string; done: boolean }) =>
      state.map((it) => (it.id === update.itemId ? { ...it, done: update.done } : it)),
  );

  const isCompact = renderMode === "compact";
  const isFull = renderMode === "full";
  const canAdd = canEdit && !isCompact;

  const total = optimisticItems.length;
  const doneCount = optimisticItems.filter((it) => it.done).length;

  function toggle(item: ChecklistMonthItem, done: boolean) {
    if (!canEdit) return;
    startTransition(async () => {
      applyToggle({ itemId: item.id, done });
      const result = await toggleChecklistCompletionAction(accountId, {
        itemId: item.id,
        monthId,
        done,
      });
      if (!result.ok) enqueueSnackbar(cw.toggleError, { variant: "error" });
    });
  }

  function unlink(item: ChecklistMonthItem) {
    startTransition(async () => {
      const result = await unlinkChecklistTransactionAction(accountId, {
        itemId: item.id,
        monthId,
      });
      if (!result.ok) enqueueSnackbar(result.error.message || cw.unlinkError, { variant: "error" });
      else enqueueSnackbar(cw.unlinked, { variant: "success" });
    });
  }

  // Add inline grava no template recorrente (B1). Não-otimista: o item novo só
  // aparece após revalidateMonth (insert otimista exigiria id temporário).
  function handleAdd() {
    const label = addInput.trim();
    if (!label) return;
    startTransition(async () => {
      const result = await createChecklistItemAction(accountId, { label, monthId });
      if (!result.ok) {
        enqueueSnackbar(result.error.message || cw.addError, { variant: "error" });
        return;
      }
      setAddInput("");
    });
  }

  // Badge de progresso no header (mesmo padrão do contador das listas de atividade):
  // verde quando tudo concluído, neutro caso contrário.
  const badge =
    total > 0 ? (
      <Chip
        label={`${doneCount}/${total}`}
        size="small"
        color={doneCount === total ? "success" : "default"}
        sx={{ height: 16, fontSize: "0.6rem", "& .MuiChip-label": { px: 0.75 } }}
      />
    ) : undefined;

  return (
    <WidgetContainer
      title={m.dashboards.widgets.month_summary.checklist}
      icon={ChecklistIcon}
      tertiary={badge}
    >
      {total === 0 ? (
        <Typography variant="caption" color="text.disabled" sx={{ px: 0.5 }}>
          {canAdd ? cw.emptyEditor : cw.empty}
        </Typography>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column" }}>
          {optimisticItems.map((item) => {
            const tx = item.linkedTransaction;
            const amount = tx ? BigInt(tx.amountCents) : 0n;

            // Botão de vincular (aparece no hover) — reusado nos itens sem transação.
            const linkButton = canAdd ? (
              <Tooltip title={cw.linkAction} placement="left">
                <IconButton
                  className="checklist-link"
                  size="small"
                  disabled={isPending}
                  onClick={() => setLinkTarget(item)}
                  aria-label={cw.linkAction}
                  sx={{
                    p: 0.25,
                    flexShrink: 0,
                    color: "text.disabled",
                    opacity: 0,
                    transition: "opacity 120ms",
                  }}
                >
                  <LinkIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Tooltip>
            ) : null;

            // Subtítulo (só no full): densifica a linha com metadados estruturados —
            // transação vinculada (descrição · data · quem) ou dados da conclusão.
            let secondary: string | null = null;
            if (isFull && tx) {
              const parts = [
                tx.description?.trim() || cw.linkedNoDescription,
                formatDayMonth(tx.occurredOn),
              ];
              if (item.completedByName) parts.push(item.completedByName);
              secondary = parts.join(" · ");
            } else if (isFull && item.done && item.completedAt) {
              const who = item.completedByName
                ? cw.completedBy(item.completedByName)
                : cw.completedByUnknown;
              secondary = `${who} · ${formatDateShort(item.completedAt)}`;
            }

            return (
              <Box
                key={item.id}
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  px: isCompact ? 0.25 : 0.5,
                  py: isCompact ? 0.125 : 0.375,
                  borderRadius: 1,
                  transition: "background-color 120ms",
                  "&:hover": { bgcolor: "action.hover" },
                  "&:hover .checklist-link": { opacity: 0.55 },
                  minWidth: 0,
                }}
              >
                {/* Linha 1: checkbox + tarefa + valor/ação */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: isCompact ? 0.25 : 0.5,
                    minWidth: 0,
                  }}
                >
                  <Checkbox
                    checked={item.done}
                    disabled={!canEdit || isPending}
                    onChange={(e) => toggle(item, e.target.checked)}
                    inputProps={{ "aria-label": item.label }}
                    sx={{
                      p: 0.25,
                      flexShrink: 0,
                      "& .MuiSvgIcon-root": { fontSize: isCompact ? 15 : 17 },
                    }}
                  />
                  <Typography
                    variant="caption"
                    noWrap
                    title={item.label}
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: isCompact ? "0.68rem" : "0.75rem",
                      color: item.done ? "text.tertiary" : "text.primary",
                      textDecoration: item.done ? "line-through" : "none",
                    }}
                  >
                    {item.label}
                  </Typography>

                  {/* Slot direito: transação vinculada OU ação de vincular.
                      Full: valor (monospace) + desvincular no hover; detalhe vai pro subtítulo.
                      Compact/default: chip enxuto (valor), descrição no tooltip. */}
                  {tx ? (
                    isFull ? (
                      <>
                        <Typography
                          variant="caption"
                          sx={{
                            fontFamily: "var(--font-jetbrains-mono), monospace",
                            fontVariantNumeric: "tabular-nums",
                            fontSize: "0.75rem",
                            fontWeight: 500,
                            flexShrink: 0,
                            color: amount < 0n ? "danger.main" : "success.main",
                          }}
                        >
                          {formatCentsToBrl(amount)}
                        </Typography>
                        {canEdit && (
                          <Tooltip title={cw.unlinkAction} placement="left">
                            <IconButton
                              className="checklist-link"
                              size="small"
                              disabled={isPending}
                              onClick={() => unlink(item)}
                              aria-label={cw.unlinkAction}
                              sx={{
                                p: 0.25,
                                flexShrink: 0,
                                color: "text.disabled",
                                opacity: 0,
                                transition: "opacity 120ms",
                              }}
                            >
                              <CloseIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </>
                    ) : (
                      <Tooltip title={tx.description ?? ""} placement="left">
                        <Chip
                          label={formatCentsToBrl(amount)}
                          size="small"
                          onDelete={canEdit && !isCompact ? () => unlink(item) : undefined}
                          sx={{
                            height: 18,
                            flexShrink: 0,
                            fontSize: "0.62rem",
                            fontFamily: "var(--font-jetbrains-mono), monospace",
                            "& .MuiChip-label": { px: 0.75 },
                            "& .MuiChip-deleteIcon": { fontSize: 13 },
                          }}
                        />
                      </Tooltip>
                    )
                  ) : (
                    linkButton
                  )}
                </Box>

                {/* Linha 2 (só no full): subtítulo com metadados estruturados */}
                {secondary && (
                  <Typography
                    variant="caption"
                    noWrap
                    title={secondary}
                    sx={{
                      pl: 3.25,
                      mt: -0.25,
                      minWidth: 0,
                      fontSize: "0.68rem",
                      color: "text.tertiary",
                    }}
                  >
                    {secondary}
                  </Typography>
                )}
              </Box>
            );
          })}
        </Box>
      )}

      {canAdd && (
        <TextField
          value={addInput}
          onChange={(e) => setAddInput(e.target.value)}
          placeholder={cw.addPlaceholder}
          variant="standard"
          fullWidth
          disabled={isPending}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          sx={{ flexShrink: 0, mt: 0.5, px: 0.5 }}
          slotProps={{
            input: {
              sx: { fontSize: "0.75rem" },
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={handleAdd}
                    disabled={!addInput.trim() || isPending}
                    edge="end"
                    aria-label={cw.addAria}
                    sx={{ p: 0.25 }}
                  >
                    <AddIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />
      )}

      {linkTarget && (
        <LinkChecklistTransactionDialog
          open
          onClose={() => setLinkTarget(null)}
          accountId={accountId}
          monthId={monthId}
          itemId={linkTarget.id}
          itemLabel={linkTarget.label}
          onLinked={() => setLinkTarget(null)}
        />
      )}
    </WidgetContainer>
  );
}
