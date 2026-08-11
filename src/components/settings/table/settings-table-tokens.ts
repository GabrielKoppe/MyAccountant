// Spec 68 (revisão de estilo) — densidade e tipografia da tabela de Configurações.
//
// POR QUE ESTES NÚMEROS EXISTEM AQUI, e não espalhados nas quatro páginas: o frame v2
// usa UMA tabela para Seções, Categorias, Instituições e Responsáveis. Cada página tem
// suas colunas, mas a moldura — altura de linha, padding de célula, tipografia do
// cabeçalho, tamanho dos ícones — é a mesma. Com cada página escolhendo o próprio
// `sx`, quatro tabelas divergem no primeiro ajuste.
//
// POR QUE NÃO MEXER NO TEMA: o override global de `MuiTableCell` (`padding: 12px 16px`,
// `fontSize: 14px`) vale para as tabelas de mês e de transações, que são densas por
// outro motivo. Apertar lá quebraria telas fora desta spec. A densidade de
// Configurações vive escopada nos componentes deste diretório.
//
// Os valores vêm do frame (`.ch`, `.rw`, `.addrow`, `.fld`), convertidos para px:
//   .ch  → padding 8px 3px · 0.6rem  (cabeçalho de coluna)
//   .rw  → padding 8px 3px · 0.79rem (linha)
//   .fld → height 33px    · 0.8rem   (campo)
// O padding lateral de 3px do frame é relativo a um `.body` que já tem 18px de
// goteira; aqui a goteira é do shell, então a célula usa um respiro próprio menor
// que o do tema.

/**
 * Altura-alvo da linha de dados.
 *
 * 36px depois de olhar a tela: o tema entregava 55px (grosso), 34px ficou apertado, e
 * este é o ponto em que a linha respira sem virar bloco. O frame calcula ~33px, mas
 * lá a fonte é menor — na tipografia real do projeto 36 é o equivalente visual.
 */
export const SETTINGS_ROW_HEIGHT = 36;

/** Altura-alvo do cabeçalho de coluna. Curto de propósito: é rótulo, não conteúdo. */
export const SETTINGS_HEAD_HEIGHT = 30;

/** Padding de célula. Vertical apertado; horizontal só o suficiente para separar colunas. */
export const SETTINGS_CELL_PADDING = { x: 1.5, y: 0.75 } as const;

/**
 * Largura da coluna da alça de arraste.
 *
 * 24px: o ícone tem 16px e a célula não leva padding horizontal — é isso que cola a
 * alça no nome. Antes a alça herdava os 16px de padding do tema de cada lado, abrindo
 * 32px de vão entre o grip e o ponto de cor.
 */
export const SETTINGS_GRIP_WIDTH = 24;

/** Largura da coluna do menu da linha (elipses), alinhada à direita. */
export const SETTINGS_MENU_WIDTH = 40;

/** Altura dos campos dentro de uma linha em edição — não pode esticar a linha. */
export const SETTINGS_FIELD_HEIGHT = 28;

/**
 * Tipografia da tabela. `head` usa **mono** de propósito: é rótulo estrutural, da
 * mesma família dos números e das contagens, e é o que separa visualmente o cabeçalho
 * do conteúdo sem precisar de peso extra.
 */
export const SETTINGS_TABLE_FONT = {
  head: { size: "0.625rem", weight: 500, letterSpacing: "0.08em" },
  row: { size: "0.8125rem" },
  field: { size: "0.8125rem" },
} as const;

/** Ícones da linha. O elipses era 20px e branco; no frame é pequeno e cinza. */
export const SETTINGS_ROW_ICON = { size: 16, menuSize: 16 } as const;
