"use client";

import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";

import { ColumnChipList } from "@/components/settings/ColumnChipList";
import { SettingsSelect } from "@/components/settings/table/SettingsSelect";
import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import type { GroupBy } from "@/lib/schemas/settings";
import { getTableColumn, isPinnableColumnKey, isTableColumnKey } from "@/lib/table-columns";

import { BlockLabel, FieldHint, HelpTip } from "./BlockLabel";
import { INHERIT_FIELDS, toggleKey, type TableTypeDraft } from "./table-type-draft";

const t = m.settings.presentation.tableTypes.behavior;

const FORM_FIELD_HEIGHT = 33;
const FIELD_SX = { height: FORM_FIELD_HEIGHT } as const;

const GROUP_BY_OPTIONS: { value: string; label: string }[] = [
  { value: "date", label: t.groupByDate },
  { value: "category", label: t.groupByCategory },
  { value: "responsible", label: t.groupByResponsible },
  { value: "installment", label: t.groupByInstallment },
];

export type BehaviorTabProps = {
  draft: TableTypeDraft;
  onChange: (patch: Partial<TableTypeDraft>) => void;
  disabled?: boolean;
};

/**
 * Aba 2 · Comportamento (Spec 69 §2.1, frame 05b).
 *
 * **Todo controle desta aba já vale na tabela do mês (§16).** Foi por isso que a
 * NOTA DE PENDÊNCIA do topo saiu: ela nomeava os controles que ainda eram gravados
 * sem consumidor, e o último deles — `pinnedColumns` — passou a funcionar. Uma nota
 * avisando sobre nada é pior que nenhuma nota: ela ensina o usuário a desconfiar de
 * uma aba que agora é inteiramente honesta, e o leitor teria de conferir controle
 * por controle para descobrir que a lista está vazia.
 *
 * O caminho de volta está aberto e é o mesmo de antes: se um controle novo entrar
 * aqui sem consumidor na tabela, recrie a chave `behavior.pendingNote` em
 * `pt-BR.ts`, volte a renderar a nota no topo NOMEANDO o controle, e troque o teste
 * "nenhuma nota de pendência" pela lista nominal que existia. A promessa da §16 é
 * auditável nos dois estados — o que ela não admite é um controle inerte calado.
 *
 * A única restrição que sobrou é de ESCOPO, não de pendência: só as duas colunas de
 * identificação podem ser fixadas, e só no layout de colunas — dito no próprio
 * bloco, ver abaixo.
 */
export function BehaviorTab({ draft, onChange, disabled = false }: BehaviorTabProps) {
  const ascending = draft.defaultSort.dir === "asc";

  // A ordenação padrão só pode apontar para uma coluna que a tabela mostra —
  // ordenar por uma coluna removida seria uma regra invisível.
  const sortOptions = draft.visibleColumns.map((key) => ({
    value: key,
    label: getTableColumn(key).label,
  }));

  // Fixáveis = `PINNABLE_COLUMNS` ∩ visíveis. Oferecer as 12 colunas visíveis
  // prometia uma fixação que o renderer do mês descarta: ele filtra o gravado por
  // `PINNABLE_COLUMNS` (só as de identificação, que são o PREFIXO da linha e por
  // isso têm `left` calculável sem medir nada em JS — ver `pinned-columns.ts`).
  const pinnableColumns = draft.visibleColumns.filter(isPinnableColumnKey);

  // Em pílulas NADA gruda: sem grade de colunas não há eixo horizontal para prender
  // nada, e a tabela do mês zera as presas tanto no layout B configurado quanto na
  // degradação abaixo de 640px (`effectivePinnedColumns`). Por isso o bloco fica
  // desabilitado com o motivo à vista, e não silenciosamente ineficaz: um controle
  // que aceita o clique e não faz nada é exatamente a mentira que a §16 veio tirar
  // desta aba.
  const pillsLayout = draft.rowLayout === "pills";

  return (
    <Box sx={{ py: layout.stack }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          gap: layout.stack,
          mb: layout.stack,
        }}
      >
        <Box>
          <BlockLabel help={t.help.defaultSort}>{t.defaultSortLabel}</BlockLabel>
          <Stack direction="row" spacing={layout.inline} useFlexGap sx={{ flexWrap: "wrap" }}>
            <SettingsSelect
              value={draft.defaultSort.key}
              onChange={(event) => {
                const key = event.target.value;
                if (!isTableColumnKey(key)) return;
                onChange({ defaultSort: { ...draft.defaultSort, key } });
              }}
              options={sortOptions}
              disabled={disabled}
              inputProps={{ "aria-label": t.defaultSortLabel }}
              sx={{ ...FIELD_SX, flex: 1, minWidth: 140 }}
            />
            {/* Botão, e não um segundo select: a direção tem dois valores e o
                rótulo já diz qual está valendo — um select de 2 opções custa dois
                cliques para o mesmo resultado. */}
            <Button
              size="small"
              variant="outlined"
              disabled={disabled}
              onClick={() =>
                onChange({
                  defaultSort: { ...draft.defaultSort, dir: ascending ? "desc" : "asc" },
                })
              }
              startIcon={
                ascending ? (
                  <ArrowUpwardIcon fontSize="small" />
                ) : (
                  <ArrowDownwardIcon fontSize="small" />
                )
              }
              sx={{ height: FORM_FIELD_HEIGHT, flexShrink: 0 }}
            >
              {ascending ? t.sortAsc : t.sortDesc}
            </Button>
          </Stack>
        </Box>

        <Box>
          <BlockLabel help={t.help.groupBy}>{t.groupByLabel}</BlockLabel>
          <SettingsSelect
            fullWidth
            value={draft.groupBy ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              onChange({ groupBy: (value === "" ? null : value) as GroupBy });
            }}
            options={GROUP_BY_OPTIONS}
            emptyLabel={t.groupByNone}
            disabled={disabled}
            inputProps={{ "aria-label": t.groupByLabel }}
            sx={FIELD_SX}
          />
          <FieldHint>{t.groupByHint}</FieldHint>
        </Box>
      </Box>

      {/* ── Totais e linhas ─────────────────────────────────────────────── */}
      <BlockLabel>{t.totalsTitle}</BlockLabel>
      <Stack spacing={layout.micro} sx={{ mb: layout.stack }}>
        <BehaviorSwitch
          label={t.showFooterTotal}
          help={t.help.showFooterTotal}
          checked={draft.showFooterTotal}
          onChange={(checked) => onChange({ showFooterTotal: checked })}
          disabled={disabled}
        />
        <BehaviorSwitch
          label={t.showGroupSubtotal}
          help={t.help.showGroupSubtotal}
          checked={draft.showGroupSubtotal}
          onChange={(checked) => onChange({ showGroupSubtotal: checked })}
          disabled={disabled}
        />
        <BehaviorSwitch
          label={t.allowBulkEdit}
          help={t.help.allowBulkEdit}
          checked={draft.allowBulkEdit}
          onChange={(checked) => onChange({ allowBulkEdit: checked })}
          disabled={disabled}
        />
        <BehaviorSwitch
          label={t.keepGhostRow}
          help={t.help.keepGhostRow}
          checked={draft.keepGhostRow}
          onChange={(checked) => onChange({ keepGhostRow: checked })}
          disabled={disabled}
        />
      </Stack>

      {/* ── Colunas fixadas à esquerda ──────────────────────────────────── */}
      {/* A ajuda (`help.pinnedColumns`) diz as duas regras do escopo — só as de
          identificação, só no layout de colunas — para quem passa pelo bloco no
          layout A, onde o motivo do desabilitado não aparece. */}
      <BlockLabel help={t.help.pinnedColumns}>{t.pinnedTitle}</BlockLabel>
      <Box sx={{ mb: layout.stack }}>
        <ColumnChipList
          items={pinnableColumns.map((key) => ({
            key,
            label: getTableColumn(key).label,
            selected: draft.pinnedColumns.includes(key),
          }))}
          variant="toggle"
          disabled={disabled || pillsLayout}
          onAdd={(key) => {
            if (!isPinnableColumnKey(key)) return;
            onChange({ pinnedColumns: toggleKey(draft.pinnedColumns, key) });
          }}
          onRemove={(key) => {
            if (!isPinnableColumnKey(key)) return;
            onChange({ pinnedColumns: toggleKey(draft.pinnedColumns, key) });
          }}
          emptyLabel={t.pinnedEmpty}
          ariaLabel={t.pinnedTitle}
        />
        {/* Motivo À VISTA, no fluxo e sob o controle — nunca só no tooltip: é a
            mesma regra que a matriz de visualização dos dashboards segue
            (`ChoiceCard.disabledReason`), e vale mais aqui, onde o bloco fica
            inteiro sem efeito. */}
        {pillsLayout && <FieldHint>{t.pinnedDisabledPills}</FieldHint>}
      </Box>

      {/* ── Ao criar linha nova, herdar ─────────────────────────────────── */}
      <BlockLabel help={t.help.inheritOnNewRow}>{t.inheritTitle}</BlockLabel>
      <ColumnChipList
        // `disabled` da aba (papel sem permissão de escrita / gravação em curso)
        // vale para os chips como já valia para os switches — sem isto o chip era
        // o único controle da aba que continuava aceitando o clique.
        disabled={disabled}
        items={INHERIT_FIELDS.map((field) => ({
          key: field,
          // O rótulo vem do MAPA indexado pela chave persistida: um de-para
          // escrito à mão (`occurredOn → "Data da linha anterior"`) sairia de
          // sincronia na primeira mudança de campo.
          label: t.inheritLabels[field] ?? field,
          selected: draft.inheritOnNewRow.includes(field),
        }))}
        variant="toggle"
        onAdd={(key) => {
          const field = INHERIT_FIELDS.find((item) => item === key);
          if (!field) return;
          onChange({ inheritOnNewRow: toggleKey(draft.inheritOnNewRow, field) });
        }}
        onRemove={(key) => {
          const field = INHERIT_FIELDS.find((item) => item === key);
          if (!field) return;
          onChange({ inheritOnNewRow: toggleKey(draft.inheritOnNewRow, field) });
        }}
        // `emptyLabel` é obrigatório na primitiva, mas aqui é inalcançável:
        // `INHERIT_FIELDS` é uma constante de quatro campos.
        emptyLabel={t.pinnedEmpty}
        ariaLabel={t.inheritTitle}
      />
    </Box>
  );
}

/**
 * Switch da lista "Totais e linhas", com a ajuda ao lado do rótulo.
 *
 * O `HelpTip` fica FORA do `FormControlLabel`, não dentro do seu `label`: o
 * `FormControlLabel` renderiza um `<label>`, e um `<button>` ali dentro herdaria
 * o clique do rótulo — tocar no ícone de ajuda viraria o switch.
 */
function BehaviorSwitch({
  label,
  help,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  help: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: layout.inline }}>
      <FormControlLabel
        sx={{ mr: 0 }}
        control={
          <Switch
            size="small"
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
            disabled={disabled}
          />
        }
        label={<Typography variant="body2">{label}</Typography>}
      />
      <HelpTip text={help} />
    </Box>
  );
}
