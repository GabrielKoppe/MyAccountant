import type { SxProps, Theme } from "@mui/material/styles";

import {
  resolvePinnedColumns,
  visibleColumnsFromHidden,
  type PinnableColumnKey,
} from "@/lib/table-columns";

import type { RowLayout } from "./row-layout";

/**
 * Um item de `sx` em forma de ARRAY (`sx={[base, extra]}`), que é como estas
 * receitas são consumidas: o item pode ser `false`, e o MUI simplesmente o
 * ignora — é assim que "coluna não presa" não custa nem um `if` no JSX.
 *
 * O tipo é derivado do próprio `SxProps` porque `SystemStyleObject` não é
 * reexportado por `@mui/material`, e devolver `SxProps` direto não serviria:
 * `SxProps` já inclui a forma de array, e array dentro de array é inválido.
 */
export type SxEntry = Extract<SxProps<Theme>, readonly unknown[]>[number];

/**
 * Spec 69 §16 — colunas fixadas à esquerda (`pinnedColumns`), layout A.
 *
 * ## Por que dá para fazer sem medir nada em JS
 *
 * Só `occurredOn` e `description` são fixáveis (`PINNABLE_COLUMNS`), e as duas
 * são o PREFIXO da linha: a grade do layout A é sempre
 *
 *     [seleção] [data] [descrição] [demais colunas…] [ações]
 *
 * Então o `left` de cada célula presa é a soma de larguras que **este módulo
 * declara**, não que ele descobre:
 *
 *     seleção     → left 0                                    (largura 48)
 *     occurredOn  → left 48                                   (largura 148)
 *     description → left 48 + 148 = 196  (se `occurredOn` também estiver presa)
 *                   left 48             (se estiver presa sozinha)
 *
 * Nenhum `getBoundingClientRect`, nenhum `ResizeObserver`, nada que precise
 * re-rodar quando a densidade, o conjunto de colunas visíveis ou a largura do
 * contêiner mudarem — o anti-padrão que a §7.2 rejeita.
 *
 * ## Por que as larguras são estas
 *
 * Medidas na tabela real (Chrome, `table-layout: auto`), porque em layout
 * automático `width` numa `<td>` só é honrado quando é **maior ou igual** ao
 * min-content da coluna. Um valor abaixo disso seria silenciosamente ignorado e
 * a coluna seguinte grudaria no lugar errado.
 *
 * | coluna       | min-content medido | constante | de onde vem                                    |
 * |---|---|---|---|
 * | seleção      | 48                 | 48        | `padding="checkbox"` em `<Table size="small">`: 16 + 20 + 12 |
 * | `occurredOn` | 148 (com linha em edição / fantasma na tela) | 148 | `maxWidth: 116` do campo de data + 32 de padding da célula |
 * | `description`| 200                | 224       | `maxWidth: 200` da célula de leitura + 24 de folga |
 *
 * A da data é a que manda: em leitura pura a coluna caberia em ~73px, mas basta
 * uma linha em edição (ou a linha-fantasma) aparecer para o min-content saltar
 * para 148. Uma constante menor faria a coluna presa mudar de largura conforme
 * a linha-fantasma entra e sai — exatamente o "gruda torto" que não pode
 * acontecer. 148 vale nos dois casos.
 */
export const PIN_SELECT_WIDTH = 48;

export const PIN_COLUMN_WIDTH: Record<PinnableColumnKey, number> = {
  occurredOn: 148,
  description: 224,
};

/**
 * Empilhamento. Célula presa acima das demais células da linha; cabeçalho preso
 * acima do corpo (o `<thead>` vem ANTES no DOM, então sem isto o corpo pintaria
 * por cima). Os dois muito abaixo do `zIndex.modal` do MUI (1300) — menu ⋮,
 * selects da edição e tooltips continuam abrindo por cima.
 */
export const PIN_Z_INDEX = { body: 2, head: 3 } as const;

/**
 * Separador do painel congelado. `boxShadow` inset, **não** `borderRight`:
 * com `border-collapse: collapse` (o default do `<Table>` do MUI) a borda
 * pertence à GRADE da tabela e é pintada na posição original da célula — ela
 * ficaria para trás enquanto a célula gruda. A sombra interna é pintada na
 * caixa da própria célula e acompanha o `sticky`.
 */
const pinEdgeShadow = (theme: Theme) => `inset -1px 0 0 ${theme.palette.divider}`;

/**
 * Cor de repouso das células presas de cada tipo de linha. Precisa ser **opaca**
 * (é o que impede o conteúdo que rola por baixo de aparecer através dela) e
 * precisa ser a MESMA do `<tr>`, senão a célula presa vira um retângulo de outra
 * cor no meio da linha.
 */
export const PIN_ROW_BACKGROUND = {
  /** Linha de leitura — o fundo do card. */
  read: "background.surface",
  /** Linha em edição (`TransactionRowEditor`). */
  editing: "background.subtle",
  /** Linha-fantasma (`NewTransactionRow`). */
  ghost: "accent.primarySubtle",
  /** Cabeçalho — o `head` do tema já pinta `background.subtle`; repetimos porque
   *  aqui a opacidade é requisito de correção, não escolha estética. */
  head: "background.subtle",
} as const;

/**
 * As colunas EFETIVAMENTE presas na tela.
 *
 * Duas regras, e as duas moram aqui para poderem ser testadas sem montar a
 * tabela inteira:
 *
 * 1. **Só no layout A.** Em pílulas — configurado OU por degradação de viewport
 *    (`resolveRowLayout`) — não existe grade de colunas, então nada gruda, mesmo
 *    com valor gravado no tipo de tabela.
 * 2. O resto é `resolvePinnedColumns`: ∩ `PINNABLE_COLUMNS` ∩ visíveis, na ordem
 *    das visíveis.
 *
 * `raw` é `unknown` de propósito: vem de um `Json` do banco, e a tela de
 * Configurações pode ter gravado uma coluna que não é fixável.
 */
export function effectivePinnedColumns(
  raw: unknown,
  hiddenColumns: Record<string, boolean | undefined> | null | undefined,
  effectiveLayout: RowLayout,
): PinnableColumnKey[] {
  if (effectiveLayout !== "columns") return [];
  return resolvePinnedColumns(raw, visibleColumnsFromHidden(hiddenColumns));
}

/**
 * O `left` de cada coluna presa, na ordem em que elas aparecem.
 *
 * `leadingWidth` é a largura das colunas fixas que vêm ANTES da primeira presa
 * — hoje só a coluna de seleção. Ela é um parâmetro (e não uma constante
 * embutida) porque a cadeia inteira desloca quando essa coluna não existe:
 * passe `0` e a primeira presa gruda em 0.
 */
export function pinnedColumnOffsets(
  pinned: readonly PinnableColumnKey[],
  leadingWidth: number = PIN_SELECT_WIDTH,
): Partial<Record<PinnableColumnKey, number>> {
  const offsets: Partial<Record<PinnableColumnKey, number>> = {};
  let left = leadingWidth;
  for (const key of pinned) {
    offsets[key] = left;
    left += PIN_COLUMN_WIDTH[key];
  }
  return offsets;
}

/** Largura total do painel congelado (seleção + presas). `0` quando não há presa. */
export function pinnedPaneWidth(
  pinned: readonly PinnableColumnKey[],
  leadingWidth: number = PIN_SELECT_WIDTH,
): number {
  if (pinned.length === 0) return 0;
  return pinned.reduce((sum, key) => sum + PIN_COLUMN_WIDTH[key], leadingWidth);
}

/**
 * Fundo que segue o estado da linha. Sem isto a célula presa ficaria parada na
 * cor de repouso enquanto o resto da linha muda no hover / na seleção — um
 * retângulo de outra cor no meio da linha, exatamente onde o olho está.
 *
 * **Hover.** O `<TableRow hover>` do MUI não troca a cor: ele pinta um VÉU
 * translúcido (`action.hover`) por cima do que já estava lá. A célula presa não
 * pode ter fundo translúcido — é o fundo opaco que impede o conteúdo de rolar
 * visível por baixo dela —, então ela reproduz o mesmo véu como
 * `background-image` SOBRE a sua cor opaca. A composição dá o mesmo pixel, com a
 * opacidade preservada. (Tentar `bgcolor: "background.subtle"` aqui erra a cor:
 * medido no dark, a linha em hover dá rgb(52,49,45) e `background.subtle` é
 * rgb(42,38,32).)
 *
 * O seletor é `tr.MuiTableRow-hover:hover` — a classe que o MUI só adiciona
 * quando a linha tem o prop `hover`. É o recorte certo: a linha em edição e a
 * linha-fantasma **não** reagem ao hover, e uma regra em `tr:hover` faria a
 * célula presa delas piscar sozinha.
 *
 * **Seleção.** `ColumnsRow` fixa a linha selecionada em `accent.primarySubtle`
 * (opaco), inclusive sob hover; a regra vem DEPOIS da do véu, com a mesma
 * especificidade, e apaga o `background-image` para não somar os dois.
 */
const rowStateBackgrounds = {
  "tr.MuiTableRow-hover:hover &": {
    backgroundImage: (theme: Theme) =>
      `linear-gradient(${theme.palette.action.hover}, ${theme.palette.action.hover})`,
  },
  "tr.Mui-selected &, tr.Mui-selected:hover &": {
    bgcolor: "accent.primarySubtle",
    backgroundImage: "none",
  },
} as const;

function stickyBase(pinned: readonly PinnableColumnKey[], key: PinnableColumnKey, zIndex: number) {
  const left = pinnedColumnOffsets(pinned)[key];
  if (left === undefined) return null;
  const width = PIN_COLUMN_WIDTH[key];
  return {
    position: "sticky" as const,
    left,
    zIndex,
    // As três juntas: em `table-layout: auto` a coluna é o MÁXIMO das larguras
    // pedidas pelas suas células, então travar as três em todas elas (cabeçalho,
    // leitura, edição, fantasma) é o que garante que a coluna meça o que a
    // cadeia de `left` assume.
    width,
    minWidth: width,
    maxWidth: width,
    boxSizing: "border-box" as const,
    ...(pinned[pinned.length - 1] === key ? { boxShadow: pinEdgeShadow } : null),
  };
}

/**
 * `sx` da célula de uma coluna presa **no corpo** da tabela. Retorna `false`
 * (item neutro de um `sx` em array) quando a coluna não está presa — é assim que
 * o layout de pílulas e o caso "nada fixado" saem de graça.
 */
export function pinnedBodyCellSx(
  pinned: readonly PinnableColumnKey[],
  key: PinnableColumnKey,
  background: string = PIN_ROW_BACKGROUND.read,
): SxEntry {
  const base = stickyBase(pinned, key, PIN_Z_INDEX.body);
  if (!base) return false;
  return { ...base, bgcolor: background, ...rowStateBackgrounds };
}

/** `sx` da célula de uma coluna presa **no cabeçalho**. */
export function pinnedHeadCellSx(
  pinned: readonly PinnableColumnKey[],
  key: PinnableColumnKey,
): SxEntry {
  const base = stickyBase(pinned, key, PIN_Z_INDEX.head);
  if (!base) return false;
  return { ...base, bgcolor: PIN_ROW_BACKGROUND.head };
}

/**
 * `sx` da coluna de SELEÇÃO (checkbox / "+" da linha-fantasma). Ela é a mais à
 * esquerda e precisa grudar junto: se ficasse rolante, a primeira coluna presa
 * pararia a 48px da borda do scroll e essa faixa mostraria o conteúdo passando
 * por baixo.
 *
 * A célula é emitida em toda linha mesmo sem `allowBulkEdit` (vazia) — é ela que
 * alinha a grade —, por isso a cadeia de `left` sempre começa em
 * `PIN_SELECT_WIDTH`.
 */
export function pinnedSelectCellSx(
  pinned: readonly PinnableColumnKey[],
  background: string = PIN_ROW_BACKGROUND.read,
): SxEntry {
  if (pinned.length === 0) return false;
  return {
    position: "sticky",
    left: 0,
    zIndex: PIN_Z_INDEX.body,
    width: PIN_SELECT_WIDTH,
    minWidth: PIN_SELECT_WIDTH,
    maxWidth: PIN_SELECT_WIDTH,
    boxSizing: "border-box",
    bgcolor: background,
    ...rowStateBackgrounds,
  };
}

/** Idem, no cabeçalho. */
export function pinnedSelectHeadCellSx(pinned: readonly PinnableColumnKey[]): SxEntry {
  if (pinned.length === 0) return false;
  return {
    position: "sticky",
    left: 0,
    zIndex: PIN_Z_INDEX.head,
    width: PIN_SELECT_WIDTH,
    minWidth: PIN_SELECT_WIDTH,
    maxWidth: PIN_SELECT_WIDTH,
    boxSizing: "border-box",
    bgcolor: PIN_ROW_BACKGROUND.head,
  };
}
