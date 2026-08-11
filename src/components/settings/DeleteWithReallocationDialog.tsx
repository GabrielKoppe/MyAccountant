"use client";

// Spec 68 §2.6 (EST-08) / M2 — excluir com realocação.
//
// Duas fontes de "raio de impacto", buscadas em paralelo só quando o diálogo abre:
// `getConfigReferencesAction` (barata — apelidos, de-para de templates, transações de
// modelo, filtros de widget, default da conta) e `countUsageAction` (cara — varre
// `Transaction`, por isso nunca dispara antes do usuário pedir). O botão de
// confirmação só libera quando as duas responderam E (não há referência nenhuma OU o
// usuário escolheu um destino — "sem categoria" incluso, como opção explícita).
//
// Este componente NÃO exclui nada: quem decide "excluir" é a página, via `onConfirm`.
// Aqui só se monta o retrato do impacto e se obriga a escolha do destino antes de
// liberar o botão.

import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import { useEffect, useId, useState } from "react";

import { getConfigReferencesAction } from "@/actions/settings-merge";
import { countUsageAction } from "@/actions/settings-usage";
import { ColorDot } from "@/components/settings/ColorDot";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { layout, typography } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import type { ReferenceSummary } from "@/server/services/settings-references-service";
import type { UsageCountResult } from "@/server/services/settings-usage-service";

const t = m.settings.structureDialogs;

/**
 * Sentinela do `<Select>` para a opção explícita "Sem <entidade>" (§2.6: vale
 * `null`, nunca é default silencioso). `""` continua reservado para "nada escolhido
 * ainda" — são estados diferentes, e só o segundo trava o botão quando há referências.
 */
const NONE_VALUE = "__none__";

export type DeleteWithReallocationDialogProps = {
  open: boolean;
  onClose: () => void;
  accountId: string;
  entity: "category" | "subcategory" | "institution" | "responsibleParty";
  target: { id: string; name: string };
  /** Destinos possíveis (a lista da página, sem o alvo). */
  options: Array<{ id: string; name: string; colorKey?: string | null }>;
  /** A página executa a exclusão de fato; recebe o destino escolhido (null = sem destino). */
  onConfirm: (reallocateToId: string | null) => Promise<void>;
};

export function DeleteWithReallocationDialog({
  open,
  onClose,
  accountId,
  entity,
  target,
  options,
  onConfirm,
}: DeleteWithReallocationDialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const reallocateLabelId = useId();

  const [refs, setRefs] = useState<ReferenceSummary | null>(null);
  const [usage, setUsage] = useState<UsageCountResult | null>(null);
  const [selection, setSelection] = useState("");
  const [confirming, setConfirming] = useState(false);

  // Só busca quando o diálogo abre — nunca em background (countUsageAction é cara).
  // Refaz a busca para cada alvo novo (troca de `target.id` com o diálogo já aberto
  // não deveria acontecer na prática, mas o efeito cobre o caso mesmo assim).
  useEffect(() => {
    if (!open) return;
    setRefs(null);
    setUsage(null);
    setSelection("");

    let cancelled = false;

    getConfigReferencesAction(accountId, { entity, entityId: target.id }).then((result) => {
      if (cancelled) return;
      if (result.ok) setRefs(result.data);
      else enqueueSnackbar(result.error.message, { variant: "error" });
    });

    // `force: true`: este diálogo promete "contado agora" (remove.countedNow), não um
    // número de até 24h atrás — quem usa o cache de `UsageCount` é "Ver uso" (M3).
    countUsageAction(accountId, { entity, entityId: target.id, force: true }).then((result) => {
      if (cancelled) return;
      if (result.ok) setUsage(result.data);
      else enqueueSnackbar(result.error.message, { variant: "error" });
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- enqueueSnackbar do notistack não é estável entre renders
  }, [open, accountId, entity, target.id]);

  const dataLoading = refs === null || usage === null;
  const total = (refs?.total ?? 0) + (usage?.transactions ?? 0);
  const hasReferences = total > 0;
  const destinationChosen = selection !== "";
  // Critério de aceite: desabilitado ENQUANTO houver referência E nenhum destino
  // escolhido. Sem referência nenhuma, o botão libera mesmo com o campo intocado —
  // não há o que realocar.
  const confirmDisabled = dataLoading || confirming || (hasReferences && !destinationChosen);

  const entityLabel = t.entityLabels[entity];
  const nonZeroGroups = refs?.groups.filter((group) => group.count > 0) ?? [];

  async function handleConfirm() {
    const reallocateToId = selection === "" || selection === NONE_VALUE ? null : selection;
    setConfirming(true);
    try {
      await onConfirm(reallocateToId);
    } catch {
      // O chamador (a página) já avisa o erro por conta própria (snackbar) — aqui só
      // evitamos deixar a rejeição pendurada travando o diálogo em "confirmando".
    } finally {
      setConfirming(false);
    }
  }

  return (
    <SettingsDialog
      open={open}
      onClose={onClose}
      size="form"
      titleIcon={<WarningAmberOutlinedIcon />}
      tone="danger"
      title={t.remove.title(entityLabel, target.name)}
      description={t.remove.description}
      loading={confirming}
      actions={
        <>
          <Button variant="text" onClick={onClose} disabled={confirming}>
            {m.common.cancel}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirm}
            disabled={confirmDisabled}
          >
            {confirming ? (
              <CircularProgress size={20} />
            ) : total > 0 ? (
              t.remove.confirmWithTotal(total)
            ) : (
              t.remove.confirmSimple
            )}
          </Button>
        </>
      }
    >
      <Stack spacing={layout.stack}>
        {/* Referências de configuração — barato, é o raio de impacto de sempre. */}
        <Box>
          <Stack
            direction="row"
            alignItems="center"
            spacing={layout.inline}
            sx={{ mb: layout.inline }}
          >
            <Typography variant="subtitle2">{t.remove.configRefs}</Typography>
            <StatusBadge variant="neutral">{t.remove.verified}</StatusBadge>
          </Stack>

          {refs === null ? (
            <Stack spacing={layout.micro}>
              <Skeleton variant="text" width="70%" />
              <Skeleton variant="text" width="50%" />
            </Stack>
          ) : nonZeroGroups.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t.remove.noRefs}
            </Typography>
          ) : (
            <Stack spacing={layout.micro}>
              {nonZeroGroups.map((group) => (
                <Stack key={group.kind} direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    {t.referenceKinds[group.kind]}
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: typography.fontFamily.mono }}>
                    {group.count}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          )}
        </Box>

        {/* Transações reais — bloco destacado; é o que trava a exclusão de verdade. */}
        <Box sx={{ bgcolor: "background.subtle", borderRadius: "8px", p: layout.stack }}>
          <Typography variant="subtitle2" sx={{ mb: layout.inline }}>
            {t.remove.realTransactions}
          </Typography>

          {usage === null ? (
            <Stack direction="row" alignItems="center" spacing={layout.inline}>
              <CircularProgress size={16} />
              <Typography variant="body2" color="text.secondary">
                {m.common.loading}
              </Typography>
            </Stack>
          ) : usage.transactions === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t.remove.noTransactions}
            </Typography>
          ) : (
            <>
              <Typography
                variant="body2"
                fontWeight="medium"
                sx={{ fontFamily: typography.fontFamily.mono }}
              >
                {t.remove.transactionCount(usage.transactions, usage.months)}
              </Typography>
              <Typography variant="caption" color="text.disabled">
                {t.remove.countedNow}
              </Typography>
            </>
          )}
        </Box>

        {/* Realocar para — "Sem X" é escolha explícita, sempre no topo da lista. */}
        <FormControl size="small" fullWidth disabled={dataLoading}>
          <InputLabel id={reallocateLabelId}>{t.remove.reallocateTo}</InputLabel>
          <Select
            labelId={reallocateLabelId}
            label={t.remove.reallocateTo}
            value={selection}
            onChange={(event: SelectChangeEvent) => setSelection(event.target.value)}
          >
            <MenuItem value={NONE_VALUE}>{t.remove.noneOption(entityLabel)}</MenuItem>
            {options.map((option, index) => (
              <MenuItem key={option.id} value={option.id}>
                <Stack direction="row" spacing={layout.inline} alignItems="center">
                  <ColorDot colorKey={option.colorKey} fallbackIndex={index} />
                  <Typography variant="body2">{option.name}</Typography>
                </Stack>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Typography variant="caption" color="text.disabled">
          {t.remove.requiredHint}
        </Typography>
      </Stack>
    </SettingsDialog>
  );
}
