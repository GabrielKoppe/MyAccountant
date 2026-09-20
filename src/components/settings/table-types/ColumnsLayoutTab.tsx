"use client";

import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { ChoiceCard } from "@/components/settings/ChoiceCard";
import { ColumnChipList } from "@/components/settings/ColumnChipList";
import { SettingsRowField } from "@/components/settings/table/SettingsRowField";
import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import { getTableColumn, isTableColumnKey, normalizeVisibleColumns } from "@/lib/table-columns";
import { DENSITIES, DENSITY_METRICS, type Density } from "@/lib/table-density";

import { BlockLabel } from "./BlockLabel";
import { DensityPreviewRows } from "./DensityPreviewRows";
import { LivePreviewRow } from "./LivePreviewRow";
import { MINIATURE_INK } from "./miniature-ink";
import { PREVIEW_SAMPLES } from "./preview-samples";
import {
  addColumn,
  availableColumns,
  prunePinned,
  removeColumn,
  type TableTypeDraft,
} from "./table-type-draft";

const t = m.settings.presentation.tableTypes;
const legacy = m.settings.tableTypes;

/** Mesma medida dos campos de formulário da aba de Definição dos Modelos (frame `.fld`). */
const FORM_FIELD_HEIGHT = 33;

const DENSITY_LABEL: Record<Density, string> = {
  compact: t.density.compact,
  default: t.density.default,
  comfortable: t.density.comfortable,
};

export type ColumnsLayoutTabProps = {
  draft: TableTypeDraft;
  onChange: (patch: Partial<TableTypeDraft>) => void;
  /**
   * Tipo padrão da conta. O serviço **recusa** mudar o conjunto de colunas do
   * tipo padrão (`table-type-service.updateTableType`) — ele existe justamente
   * como "mostra tudo". Layout e densidade, que são só apresentação, continuam
   * editáveis. Sem esta trava a UI ofereceria o × e o +, o servidor ignoraria em
   * silêncio, e o usuário só descobriria na recarga seguinte.
   */
  isDefault?: boolean;
  disabled?: boolean;
};

/**
 * Aba 1 · Colunas & layout (Spec 69 §2.1, frame 05).
 *
 * A aba inteira existe para responder a uma pergunta: "como a minha tabela vai
 * ficar?". Por isso a pré-visualização fica no fim da MESMA aba, alimentada pelo
 * rascunho — layout, densidade, conjunto **e ordem** das colunas aparecem no
 * mesmo render em que o controle é mexido, sem salvar (APR-01).
 */
export function ColumnsLayoutTab({
  draft,
  onChange,
  isDefault = false,
  disabled = false,
}: ColumnsLayoutTabProps) {
  const visible = draft.visibleColumns;
  const available = availableColumns(visible);

  function handleReorder(keys: string[]) {
    // `normalize` preserva a ordem recebida; o que ele garante é que nada saiu da
    // lista no caminho (chave desconhecida, duplicata, obrigatória perdida).
    onChange({ visibleColumns: normalizeVisibleColumns(keys.filter(isTableColumnKey)) });
  }

  function handleRemove(key: string) {
    if (!isTableColumnKey(key)) return;
    const next = removeColumn(visible, key);
    // Fixar uma coluna que saiu da tabela deixaria um chip marcado apontando para
    // o nada — a poda anda junto com a remoção, não num "salvar" depois.
    //
    // Continua valendo depois de `PINNABLE_COLUMNS` (§16), só que agora como rede
    // para dado LEGADO: as duas fixáveis (`occurredOn`, `description`) são
    // `locked`, então nenhuma delas chega aqui por remoção. O que a poda tira é o
    // que a tela antiga deixou gravado (uma "Categoria" fixada, por exemplo)
    // quando essa coluna sai das visíveis.
    onChange({ visibleColumns: next, pinnedColumns: prunePinned(draft.pinnedColumns, next) });
  }

  function handleAdd(key: string) {
    if (!isTableColumnKey(key)) return;
    onChange({ visibleColumns: addColumn(visible, key) });
  }

  return (
    <Box sx={{ py: layout.stack }}>
      {/* O selo "Padrão" NÃO mora mais aqui: ele identifica o tipo, então vive ao
          lado do nome na lista mestre (onde se vê qual dos tipos é o padrão sem
          abrir cada um). O que ele explicava de passagem — por que as colunas
          estão travadas — continua dito com todas as letras no rótulo do bloco
          "Colunas visíveis", em `t.columns.defaultLocked`. */}
      <Box sx={{ maxWidth: 360, mb: layout.stack }}>
        <BlockLabel>{legacy.nameLabel}</BlockLabel>
        <SettingsRowField
          label={legacy.nameLabel}
          value={draft.name}
          onChange={(event) => onChange({ name: event.target.value })}
          disabled={disabled}
          // Altura pela PROP, nunca por `sx`: ver a explicação em `SettingsRowField`
          // — um `sx` com `& .MuiOutlinedInput-root` apagaria a tipografia do campo.
          fieldHeight={FORM_FIELD_HEIGHT}
        />
      </Box>

      {/* ── Organização da linha ────────────────────────────────────────── */}
      {/* Sem `hint`: o "· Spec 66" do frame era etiqueta de documento interno, que
          não diz nada a quem usa o app. */}
      <BlockLabel>{t.rowLayout.title}</BlockLabel>
      <Box
        role="radiogroup"
        aria-label={t.rowLayout.title}
        sx={{ display: "flex", gap: layout.inline, mb: layout.stack }}
      >
        <ChoiceCard
          selected={draft.rowLayout === "columns"}
          onSelect={() => onChange({ rowLayout: "columns" })}
          label={t.rowLayout.columnsLabel}
          helper={t.rowLayout.columnsHelp}
          disabled={disabled}
        >
          <LayoutMiniature variant="columns" />
        </ChoiceCard>
        <ChoiceCard
          selected={draft.rowLayout === "pills"}
          onSelect={() => onChange({ rowLayout: "pills" })}
          label={t.rowLayout.pillsLabel}
          helper={t.rowLayout.pillsHelp}
          disabled={disabled}
        >
          <LayoutMiniature variant="pills" />
        </ChoiceCard>
      </Box>

      {/* ── Densidade (APR-03) ──────────────────────────────────────────── */}
      <BlockLabel hint={t.density.hint}>{t.density.title}</BlockLabel>
      <Box
        role="radiogroup"
        aria-label={t.density.title}
        sx={{ display: "flex", gap: layout.inline, mb: layout.stack }}
      >
        {DENSITIES.map((density) => {
          const metrics = DENSITY_METRICS[density];
          return (
            <ChoiceCard
              key={density}
              selected={draft.density === density}
              onSelect={() => onChange({ density })}
              label={DENSITY_LABEL[density]}
              meta={t.density.meta(metrics.rowHeight, metrics.fontSize)}
              disabled={disabled}
            >
              <DensityPreviewRows density={density} selected={draft.density === density} />
            </ChoiceCard>
          );
        })}
      </Box>

      {/* ── Colunas visíveis / Disponíveis (APR-04) ─────────────────────── */}
      {/* No tipo padrão este hint é a ÚNICA explicação da trava (o selo "Padrão"
          agora fica na lista mestre): `defaultLocked` fala do tipo — "O tipo padrão
          sempre exibe todas as colunas" —, enquanto `locked` foi escrito para o
          chip de uma coluna obrigatória qualquer. */}
      <BlockLabel hint={isDefault ? t.columns.defaultLocked : t.columns.visibleHint}>
        {t.columns.visibleTitle}
      </BlockLabel>
      <Box sx={{ mb: layout.stack }}>
        <ColumnChipList
          items={visible.map((key) => {
            const column = getTableColumn(key);
            return {
              key: column.key,
              label: column.label,
              // No tipo padrão TODA coluna é obrigatória: o servidor não aceita
              // mudar o conjunto, então nenhum chip pode oferecer × nem alça.
              locked: isDefault || column.locked,
            };
          })}
          variant="visible"
          // Mesma trava dos demais controles da aba: sem isto o chip continuaria
          // arrastável e removível para quem não pode escrever.
          disabled={disabled}
          onReorder={handleReorder}
          onRemove={handleRemove}
          emptyLabel={t.columns.empty}
          ariaLabel={t.columns.visibleTitle}
        />
      </Box>

      {!isDefault && (
        <>
          <BlockLabel hint={t.columns.availableHint}>{t.columns.availableTitle}</BlockLabel>
          <Box sx={{ mb: layout.stack }}>
            <ColumnChipList
              items={available.map((key) => {
                const column = getTableColumn(key);
                return { key: column.key, label: column.label };
              })}
              variant="available"
              disabled={disabled}
              onAdd={handleAdd}
              emptyLabel={t.columns.allInUse}
              ariaLabel={t.columns.availableTitle}
            />
          </Box>
        </>
      )}

      {/* D3 — dito na tela, não escondido: a ordem já é gravada e já vale no
          preview; a tabela do mês só a respeita com o renderer da Spec 66. */}
      <Stack
        direction="row"
        spacing={layout.inline}
        alignItems="flex-start"
        useFlexGap
        sx={{
          mb: layout.stack,
          p: layout.stack,
          borderRadius: "8px",
          border: 1,
          borderStyle: "dashed",
          borderColor: "border.strong",
        }}
      >
        <InfoOutlinedIcon fontSize="small" sx={{ color: "text.tertiary", mt: "2px" }} />
        <Typography variant="body2" sx={{ color: "text.tertiary" }}>
          {t.columns.orderPendingNote}
        </Typography>
      </Stack>

      {/* ── Pré-visualização ao vivo ────────────────────────────────────── */}
      <BlockLabel hint={t.preview.hint}>{t.preview.title}</BlockLabel>
      <Box
        aria-label={t.preview.title}
        role="group"
        sx={{
          borderRadius: "8px",
          border: 1,
          borderColor: "border.subtle",
          bgcolor: "background.surface",
          overflowX: "auto",
        }}
      >
        {PREVIEW_SAMPLES.map((sample, index) => (
          <LivePreviewRow
            key={sample.id}
            sample={sample}
            rowLayout={draft.rowLayout}
            density={draft.density}
            columns={visible}
            last={index === PREVIEW_SAMPLES.length - 1}
          />
        ))}
      </Box>
    </Box>
  );
}

/**
 * Miniatura dos dois layouts (frame 05): barras alinhadas em grade × pílulas
 * soltas. Abstrata de propósito — o que o card precisa comunicar é a FORMA, e a
 * pré-visualização logo abaixo já mostra o conteúdo real.
 *
 * A tinta é a ILUSTRATIVA de `MINIATURE_INK` — leve de propósito (~1,8–2,3:1),
 * porque quem carrega o significado aqui é o rótulo do card, não o desenho. O que
 * ela NÃO pode ser é o token de fundo do frame: sobre o card selecionado
 * (`accent.primarySubtle`) o `background.muted` original media 1,02:1 no tema
 * claro — a miniatura sumia exatamente no estado escolhido. Ver `miniature-ink.ts`.
 */
function LayoutMiniature({ variant }: { variant: "columns" | "pills" }) {
  if (variant === "columns") {
    return (
      <Box
        aria-hidden
        sx={{
          display: "grid",
          gridTemplateColumns: "30px 1fr 42px",
          gap: "4px",
        }}
      >
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <Box
            key={index}
            sx={{
              height: 6,
              borderRadius: "2px",
              // Tinta única nas duas fileiras: a "hierarquia" de cabeçalho/dados do
              // frame diferia 1,03:1 entre as camadas — invisível. O que distingue
              // este card do B é a GRADE (3 larguras alinhadas em 2 fileiras).
              bgcolor: MINIATURE_INK.illustrative,
            }}
          />
        ))}
      </Box>
    );
  }

  return (
    <Box aria-hidden sx={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
      {[46, 34, 40].map((width) => (
        <Box
          key={width}
          sx={{
            height: 11,
            width,
            borderRadius: "6px",
            // Mesma tinta do card A, para que nenhum dos dois pese mais que o
            // outro na comparação lado a lado.
            bgcolor: MINIATURE_INK.illustrative,
          }}
        />
      ))}
    </Box>
  );
}
