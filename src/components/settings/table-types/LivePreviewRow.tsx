"use client";

import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import type { CSSProperties, ReactNode } from "react";

import { ColorDot } from "@/components/settings/ColorDot";
import { pillOutlineSx, pillSx } from "@/components/transactions/pill-sx";
import { typography } from "@/lib/design-tokens";
import type { RowLayout } from "@/lib/schemas/settings";
import type { TableColumnKey } from "@/lib/table-columns";
import { DENSITY_VAR, densityCssVars, type Density } from "@/lib/table-density";

/**
 * Conteúdo de UMA célula da linha.
 *
 * `content` é `ReactNode` (e não `string`) porque a aba "Transações do modelo"
 * (Spec 69 §2.2, P7) renderiza a MESMA linha com campos editáveis dentro das
 * células — se o contrato fosse texto puro, aquela aba teria de desenhar uma
 * segunda linha "parecida", e as duas divergiriam na primeira mudança de estilo.
 */
export type LivePreviewCell = {
  content: ReactNode;
  /**
   * Chave de `accent-colors` (NUNCA hex) do ponto de cor à esquerda — categoria,
   * seção. Ausente/`null` = sem ponto.
   */
  colorKey?: string | null;
  /**
   * Só interpretado na coluna `amount`: decide a cor do valor
   * (`positive` → success, `negative` → danger, `neutral` → terciário).
   */
  tone?: "positive" | "negative" | "neutral";
  /** Pílula contornada em vez de preenchida (parcela `3/12`), no layout B. */
  outlined?: boolean;
};

export type LivePreviewSample = {
  /** Chave de lista. */
  id: string;
  /**
   * Valor por coluna. Uma coluna visível SEM entrada aqui aparece vazia no layout
   * A (a grade não pode perder o alinhamento) e é omitida no layout B (pílula
   * vazia não é informação).
   */
  cells: Partial<Record<TableColumnKey, LivePreviewCell>>;
};

export type LivePreviewRowProps = {
  sample: LivePreviewSample;
  /** `columns` (A) ou `pills` (B) — Spec 66 / D4. */
  rowLayout: RowLayout;
  /** Densidade do TIPO. As 3 variáveis CSS são fixadas na própria linha. */
  density: Density;
  /**
   * Colunas visíveis **na ordem escolhida**. A ordem recebida é a ordem
   * renderizada — é o que faz a pré-visualização responder ao arraste dos chips
   * no mesmo render (D3).
   */
  columns: readonly TableColumnKey[];
  /** Última linha do bloco: sem a borda inferior. */
  last?: boolean;
  /** Ancorado no fim da linha (o menu `⋮` da aba de Modelos). */
  trailing?: ReactNode;
};

/** Largura das células não-estruturais no layout A. Fixa de propósito: alinhar
 *  colunas entre linhas é o que distingue o layout A do B. */
const CELL_WIDTH = 104;
const DATE_WIDTH = 52;
const AMOUNT_WIDTH = 88;
/** Piso da descrição: abaixo disso ela deixa de ser legível. */
const DESCRIPTION_MIN_WIDTH = 140;

/**
 * Layout B: a data tem lugar fixo à esquerda e NÃO é célula de grade — a medida é a
 * do `PillsRow` real (`minWidth: 40`, cresce se o rótulo for maior), não os 52px
 * fixos do layout A.
 */
const PILLS_DATE_MIN_WIDTH = 40;

/**
 * As três colunas estruturais têm lugar fixo no layout B (data à esquerda, descrição
 * no bloco central, valor à direita) — só as outras viram pílula.
 */
const PILLS_STRUCTURAL: readonly TableColumnKey[] = ["occurredOn", "description", "amount"];

const TONE_COLOR = {
  positive: "success.main",
  negative: "danger.main",
  neutral: "text.tertiary",
} as const;

/**
 * Uma linha de transação renderizada com o layout, a densidade e as colunas de um
 * tipo de tabela (Spec 69 §2.1 — "Pré-visualização ao vivo").
 *
 * **Não lê estado de página nenhum**: tudo entra por prop, inclusive a densidade
 * (aplicada como as 3 variáveis CSS de `densityCssVars` na própria raiz da linha,
 * sem depender de um contêiner com `data-density`). É o que permite reusá-la fora
 * desta página — a aba "Transações do modelo" monta a mini-tabela editável com
 * este mesmo componente.
 *
 * Não é a linha real da tabela do mês (`ColumnsRow`/`PillsRow`): aquela carrega
 * seleção, gaveta, menu de ações e handlers de mutação. Aqui só a FORMA importa —
 * e é a forma que o usuário precisa ver antes de salvar.
 */
export function LivePreviewRow({
  sample,
  rowLayout,
  density,
  columns,
  last = false,
  trailing,
}: LivePreviewRowProps) {
  const pills = rowLayout === "pills";

  return (
    <Box
      // As 3 variáveis vivem NA LINHA: sem isso a pré-visualização dependeria de
      // um ancestral com `data-density`, e o componente deixaria de ser reusável
      // fora desta página (§7.2).
      //
      // `style` e não `sx` de propósito: custom property é VALOR, não regra de
      // estilo. Pelo `sx`, cada densidade viraria uma classe Emotion nova; inline,
      // é o mesmo objeto que `densityCssVars` devolve, aplicado ao elemento — e
      // fica inspecionável (a proibição do CLAUDE §7 é `style` com COR).
      style={densityCssVars(density) as CSSProperties}
      sx={{
        display: "flex",
        alignItems: "center",
        // Layout B usa o gap 2 e o respiro vertical da célula do `PillsRow` real
        // (`TableCell` com `py: 1`): são duas linhas de conteúdo, e sem o respiro a
        // pílula encosta na divisória.
        gap: pills ? 2 : 0.875,
        px: 1.375,
        py: pills ? 1 : 0,
        // MÍNIMO, não altura: no layout B as duas linhas crescem à vontade (mesma
        // semântica do `height` em `<tr>` na linha real), e no A a linha para aqui.
        minHeight: DENSITY_VAR.rowHeight,
        fontSize: DENSITY_VAR.fontSize,
        borderBottomWidth: last ? 0 : "1px",
        borderBottomStyle: "solid",
        borderBottomColor: "border.subtle",
      }}
    >
      {pills ? (
        <PillsBody sample={sample} columns={columns} />
      ) : (
        <ColumnsBody sample={sample} columns={columns} />
      )}

      {trailing}
    </Box>
  );
}

/**
 * Layout B (pílulas) — **duas linhas**, como o `PillsRow` real
 * (`src/components/transactions/PillsRow.tsx`):
 *
 * ```
 * [ data ]  [ descrição            ]  [ valor ]
 *           [ pílulas, wrap        ]
 * ```
 *
 * Antes esta pré-visualização desenhava tudo numa única linha flex — era o layout A
 * com chips no lugar do texto, e não parecia com a tabela do mês, que é a ÚNICA
 * coisa que a pré-visualização precisa fazer. As medidas (gap 16px entre os três
 * blocos, gap 5px entre pílulas, `mt: 0.5` na linha de metadados) são as da linha
 * real; se elas mudarem lá, mudam aqui.
 */
function PillsBody({
  sample,
  columns,
}: {
  sample: LivePreviewSample;
  columns: readonly TableColumnKey[];
}) {
  const visible = new Set<TableColumnKey>(columns);
  const date = visible.has("occurredOn") ? sample.cells.occurredOn : undefined;
  const description = visible.has("description") ? sample.cells.description : undefined;
  const amount = visible.has("amount") ? sample.cells.amount : undefined;

  // A ORDEM recebida é a ordem das pílulas (D3) — só as estruturais saem da fila,
  // e pílula sem valor não existe.
  const pillCells = columns
    .filter((key) => !PILLS_STRUCTURAL.includes(key))
    .flatMap((key) => {
      const cell = sample.cells[key];
      return cell ? [{ key, cell }] : [];
    });

  return (
    <>
      {date && (
        // Medido na linha real (densidade `default`): mono 13px, peso 400,
        // `text.secondary`, 40px de mínimo. Diferente da célula de data do layout
        // A (0.7rem / `text.tertiary` / 52px fixos), que é uma coluna de grade —
        // aqui a data é o rótulo à esquerda de um bloco de duas linhas.
        <Box
          component="span"
          sx={{
            minWidth: PILLS_DATE_MIN_WIDTH,
            flexShrink: 0,
            fontFamily: typography.fontFamily.mono,
            color: "text.secondary",
          }}
        >
          {date.content}
        </Box>
      )}

      {/* Bloco central: descrição em cima, metadados embaixo. `minWidth: 0` é o que
          permite a descrição truncar em vez de empurrar o valor para fora. */}
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Box
            component="span"
            sx={{
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontWeight: 500,
              color: "text.primary",
            }}
          >
            {description?.content}
          </Box>
        </Box>

        {/* Sem pílula nenhuma a segunda linha não é renderizada: um contêiner vazio
            com `mt` deixaria 4px de vão sem conteúdo abaixo da descrição. */}
        {pillCells.length > 0 && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              flexWrap: "wrap",
              mt: 0.5,
            }}
          >
            {pillCells.map(({ key, cell }) => (
              <Chip
                key={key}
                size="small"
                sx={cell.outlined ? pillOutlineSx : pillSx}
                label={
                  <Box
                    component="span"
                    sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
                  >
                    {cell.colorKey ? <ColorDot colorKey={cell.colorKey} size={8} /> : null}
                    {cell.content}
                  </Box>
                }
              />
            ))}
          </Box>
        )}
      </Box>

      {amount && (
        <Box
          component="span"
          sx={{
            flexShrink: 0,
            textAlign: "right",
            fontFamily: typography.fontFamily.mono,
            fontWeight: 500,
            // `tabular-nums` vem da linha real: sem ela os valores de duas linhas
            // seguidas não alinham na vírgula.
            fontVariantNumeric: "tabular-nums",
            color: TONE_COLOR[amount.tone ?? "neutral"],
          }}
        >
          {amount.content}
        </Box>
      )}
    </>
  );
}

/**
 * Layout A (colunas fixas) — uma célula por coluna visível, largura fixa, na ordem
 * escolhida. A célula existe mesmo vazia: é o alinhamento entre linhas que
 * distingue este layout do B.
 */
function ColumnsBody({
  sample,
  columns,
}: {
  sample: LivePreviewSample;
  columns: readonly TableColumnKey[];
}) {
  return (
    <>
      {columns.map((key) => {
        const cell = sample.cells[key];

        if (key === "occurredOn") {
          return (
            <Box
              key={key}
              component="span"
              sx={{
                width: DATE_WIDTH,
                flexShrink: 0,
                fontFamily: typography.fontFamily.mono,
                fontSize: "0.7rem",
                fontWeight: 500,
                color: "text.tertiary",
              }}
            >
              {cell?.content}
            </Box>
          );
        }

        if (key === "description") {
          return (
            <Box
              key={key}
              component="span"
              sx={{
                // `1 0 <base>`: cresce, mas NÃO encolhe. Com 12 colunas de
                // largura fixa ao lado, um `flex: 1` comum espremia a descrição
                // até uma letra ("P.") enquanto as células vazias mantinham seu
                // espaço — a linha tem que estourar para o lado (o contêiner
                // rola) em vez de esmagar justamente o conteúdo principal.
                flex: `1 0 ${DESCRIPTION_MIN_WIDTH}px`,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: "text.primary",
              }}
            >
              {cell?.content}
            </Box>
          );
        }

        if (key === "amount") {
          return (
            <Box
              key={key}
              component="span"
              sx={{
                width: AMOUNT_WIDTH,
                flexShrink: 0,
                textAlign: "right",
                fontFamily: typography.fontFamily.mono,
                fontWeight: 500,
                color: TONE_COLOR[cell?.tone ?? "neutral"],
              }}
            >
              {cell?.content}
            </Box>
          );
        }

        return (
          <Box
            key={key}
            component="span"
            sx={{
              width: CELL_WIDTH,
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              color: "text.secondary",
            }}
          >
            {cell?.colorKey ? <ColorDot colorKey={cell.colorKey} size={8} /> : null}
            {cell?.content}
          </Box>
        );
      })}
    </>
  );
}
