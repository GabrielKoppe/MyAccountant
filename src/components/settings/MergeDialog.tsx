"use client";

// Spec 68 §2.5 (EST-07) — M5 · Mesclar dois objetos de estrutura que significam a
// mesma coisa ("Restaurante" e "Restaurantes"). Reusado por Categorias, Instituições
// e Responsáveis (e por Apelidos na Spec 70) — por isso o componente não sabe nada
// de página: recebe `entity` + `options` já filtrados por quem o abre.
//
// Autocontido de propósito (ver instruções da task): não é ligado a nenhum manager
// aqui. Quem abre o diálogo controla `open`/`onClose` e reage a `onMerged`.

import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import MergeTypeIcon from "@mui/icons-material/MergeType";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import MenuItem from "@mui/material/MenuItem";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import { useEffect, useState, useTransition } from "react";

import { getConfigReferencesAction, mergeEntityAction } from "@/actions/settings-merge";
import { countUsageAction } from "@/actions/settings-usage";
import { ColorDot } from "@/components/settings/ColorDot";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { SettingsFieldLabel } from "@/components/settings/SettingsFieldLabel";
import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import type {
  ReferenceGroup,
  ReferenceKind,
  ReferencedEntity,
} from "@/server/services/settings-references-service";

const t = m.settings.structureDialogs.merge;
const entityLabels = m.settings.structureDialogs.entityLabels;
const referenceKindLabels = m.settings.structureDialogs.referenceKinds;

export type MergeDialogOption = {
  id: string;
  name: string;
  colorKey?: string | null;
};

export type MergeDialogProps = {
  open: boolean;
  onClose: () => void;
  accountId: string;
  entity: ReferencedEntity;
  /** Opções selecionáveis, já filtradas pela página. */
  options: MergeDialogOption[];
  /** Pré-seleciona "Absorver" — a linha de onde o usuário abriu o menu. */
  initialAbsorbedId?: string;
  /** Chamado após mesclar com sucesso, para a página atualizar sua lista. */
  onMerged: (result: { absorbedId: string; keptId: string }) => void;
};

/** Primeira letra minúscula — os rótulos de `referenceKinds` vêm capitalizados
 * (título de coluna em outros contextos), mas o chip lê como frase ("2 apelidos"). */
function lowerFirst(label: string): string {
  return label.length === 0 ? label : label.charAt(0).toLowerCase() + label.slice(1);
}

type MergeCounts = {
  transactions: number;
  referenceGroups: ReferenceGroup[];
};

/** `<Select>` com ponto de cor + nome no valor exibido e em cada opção — mesmo
 * vocabulário visual das listas (Spec 68 §7.4: `ColorDot` único). */
function EntitySelect({
  label,
  hint,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  options: MergeDialogOption[];
  disabled: boolean;
  onChange: (id: string) => void;
}) {
  return (
    <Stack spacing={layout.micro} sx={{ minWidth: 0 }}>
      <Typography variant="body2" fontWeight={500}>
        {label}
      </Typography>
      <Select
        size="small"
        fullWidth
        displayEmpty
        value={value}
        disabled={disabled}
        onChange={(event: SelectChangeEvent) => onChange(event.target.value)}
        inputProps={{ "aria-label": label }}
        renderValue={(selected) => {
          const index = options.findIndex((o) => o.id === selected);
          const option = index >= 0 ? options[index] : undefined;
          if (!option) {
            return (
              <Typography component="span" variant="body2" color="text.disabled">
                {t.placeholder}
              </Typography>
            );
          }
          return (
            <Stack direction="row" spacing={layout.micro} alignItems="center">
              <ColorDot colorKey={option.colorKey} fallbackIndex={index} />
              <Typography component="span" variant="body2" noWrap>
                {option.name}
              </Typography>
            </Stack>
          );
        }}
      >
        <MenuItem value="" disabled>
          <em>{t.placeholder}</em>
        </MenuItem>
        {options.map((option, index) => (
          <MenuItem key={option.id} value={option.id}>
            <Stack direction="row" spacing={layout.micro} alignItems="center">
              <ColorDot colorKey={option.colorKey} fallbackIndex={index} />
              <span>{option.name}</span>
            </Stack>
          </MenuItem>
        ))}
      </Select>
      <Typography variant="caption" color="text.tertiary">
        {hint}
      </Typography>
    </Stack>
  );
}

/**
 * M5 · Mesclar (Spec 68 §2.5). Dois selects (Absorver → Manter), contagem do que
 * será movido (referências de configuração + transações do absorvido) e aviso de
 * irreversibilidade (D5 — sem undo, nunca prometa desfazer aqui).
 */
export function MergeDialog({
  open,
  onClose,
  accountId,
  entity,
  options,
  initialAbsorbedId,
  onMerged,
}: MergeDialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [absorbedId, setAbsorbedId] = useState("");
  const [keptId, setKeptId] = useState("");
  const [counts, setCounts] = useState<MergeCounts | null>(null);
  const [countsLoading, setCountsLoading] = useState(false);
  const [isMerging, startMerging] = useTransition();

  // Reabrir o diálogo (inclusive para outra linha) começa do zero: absorvida
  // pré-selecionada pela linha de origem, mantida em branco, contagens limpas.
  useEffect(() => {
    if (!open) return;
    setAbsorbedId(initialAbsorbedId ?? "");
    setKeptId("");
    setCounts(null);
  }, [open, initialAbsorbedId]);

  const bothChosen = absorbedId !== "" && keptId !== "";
  const isSameObject = bothChosen && absorbedId === keptId;

  // Busca as contagens só quando os dois lados estão escolhidos e são diferentes —
  // com os dois iguais a mesclagem nem seria permitida, então contar seria custo à
  // toa (Spec 68 §2.5).
  useEffect(() => {
    if (!open || !bothChosen || isSameObject) {
      setCounts(null);
      return;
    }

    let cancelled = false;
    setCountsLoading(true);

    Promise.all([
      getConfigReferencesAction(accountId, { entity, entityId: absorbedId }),
      // `force: true` mesmo pagando a varredura: a mesclagem é IRREVERSÍVEL (D5) e o
      // botão nomeia o total movido. Servir do cache de 24 h faria o número mostrado —
      // e o texto do próprio botão — divergir do que a operação de fato move.
      countUsageAction(accountId, { entity, entityId: absorbedId, force: true }),
    ]).then(([refsResult, usageResult]) => {
      if (cancelled) return;
      setCountsLoading(false);

      if (!refsResult.ok) {
        enqueueSnackbar(refsResult.error.message, { variant: "error" });
        return;
      }
      if (!usageResult.ok) {
        enqueueSnackbar(usageResult.error.message, { variant: "error" });
        return;
      }

      setCounts({
        transactions: usageResult.data.transactions,
        referenceGroups: refsResult.data.groups,
      });
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, accountId, entity, absorbedId, keptId, bothChosen, isSameObject]);

  function handleConfirm() {
    if (!bothChosen || isSameObject) return;

    startMerging(async () => {
      const result = await mergeEntityAction(accountId, { entity, absorbedId, keptId });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }

      const absorbedName = options.find((o) => o.id === absorbedId)?.name ?? "";
      const keptName = options.find((o) => o.id === keptId)?.name ?? "";
      enqueueSnackbar(t.success(absorbedName, keptName), { variant: "success" });
      onMerged({ absorbedId, keptId });
      onClose();
    });
  }

  const confirmDisabled = !bothChosen || isSameObject || countsLoading || isMerging;

  // Spec 68 §2.5 — o botão nomeia o total movido. Numa operação sem undo (D5), o
  // tamanho do estrago possível tem que estar no próprio gesto de confirmar, não só
  // na lista de chips acima dele. Antes das contagens chegarem, rótulo genérico.
  const totalToMove = counts
    ? counts.transactions + counts.referenceGroups.reduce((sum, g) => sum + g.count, 0)
    : null;
  const confirmLabel = totalToMove === null ? t.confirm : t.confirmWithTotal(totalToMove);

  return (
    <SettingsDialog
      open={open}
      onClose={onClose}
      size="form"
      titleIcon={<MergeTypeIcon />}
      title={`${t.title} ${entityLabels[entity]}`}
      description={t.description}
      loading={isMerging}
      actions={
        <>
          <Button size="small" onClick={onClose}>
            {m.common.cancel}
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={handleConfirm}
            disabled={confirmDisabled}
            endIcon={isMerging ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          gap: layout.inline,
          alignItems: "flex-start",
          mb: layout.stack,
        }}
      >
        <EntitySelect
          label={t.absorbLabel}
          hint={t.absorbHint}
          value={absorbedId}
          options={options}
          disabled={isMerging}
          onChange={setAbsorbedId}
        />
        <ArrowForwardIcon sx={{ color: "text.disabled", mt: "34px" }} />
        <EntitySelect
          label={t.keepLabel}
          hint={t.keepHint}
          value={keptId}
          options={options}
          disabled={isMerging}
          onChange={setKeptId}
        />
      </Box>

      {isSameObject && (
        <Typography variant="body2" color="error.main" sx={{ mb: layout.stack }}>
          {t.sameObject}
        </Typography>
      )}

      {bothChosen && !isSameObject && (
        <Box sx={{ mb: layout.stack }}>
          <SettingsFieldLabel>{t.whatMoves}</SettingsFieldLabel>
          {countsLoading ? (
            <Stack
              direction="row"
              spacing={layout.micro}
              alignItems="center"
              sx={{ mt: layout.micro }}
            >
              <CircularProgress size={14} />
              <Typography variant="body2" color="text.tertiary">
                {t.countingTransactions}
              </Typography>
            </Stack>
          ) : (
            counts && (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: layout.micro, mt: layout.micro }}>
                <Chip size="small" label={t.transactionsChip(counts.transactions)} />
                {counts.referenceGroups.map((group: ReferenceGroup) => (
                  <Chip
                    key={group.kind}
                    size="small"
                    label={`${group.count} ${lowerFirst(referenceKindLabels[group.kind as ReferenceKind])}`}
                  />
                ))}
              </Box>
            )
          )}
        </Box>
      )}

      <Stack
        direction="row"
        spacing={layout.inline}
        alignItems="flex-start"
        sx={{
          p: layout.stack,
          borderRadius: "8px",
          border: 1,
          borderColor: "warning.main",
          bgcolor: "warning.light",
        }}
      >
        <InfoOutlinedIcon fontSize="small" sx={{ color: "warning.main", mt: "2px" }} />
        <Typography variant="body2" color="text.secondary">
          {t.irreversible}
        </Typography>
      </Stack>
    </SettingsDialog>
  );
}
