// Spec 68 (revisão de estilo) — densidade dos menus de Configurações.
//
// POR QUE EXISTE: todo menu destas telas nasce do `Menu` do MUI, cujo default é de
// aplicação de conteúdo (item de 16px, altura mínima de 48px, ícone de 20px). Ao lado
// de uma tabela de linhas de 36px e texto de 13px, isso lê como se a tela tivesse
// zoom. São quatro menus diferentes — ações da linha, importar/exportar, vincular
// membro e os popups dos seletores — e cada um corrigido no seu arquivo divergiria no
// primeiro ajuste.
//
// POR QUE NÃO NO TEMA: `MuiMenuItem` global vale também para os menus de mês,
// transações e da sidebar, que são de conteúdo e devem seguir a medida de aplicação.
// A densidade de Configurações fica escopada em quem importa daqui.
//
// ⚠️ O seletor do ícone é `& .MuiListItemIcon-root svg`, e não `& svg`: o próprio MUI
// emite `.MuiMenuItem-root .MuiListItemIcon-root svg { font-size: 1.25rem }`, com três
// níveis. Um `& svg` de dois níveis perde e o ícone fica em 20px sem erro nenhum. Ver
// a armadilha de especificidade em `skills/design-system/SKILL.md` §8.1.

import type { MenuProps } from "@mui/material/Menu";

/** Altura mínima de um item de menu — a mesma ordem de grandeza da linha da tabela. */
const MENU_ITEM_MIN_HEIGHT = 32;

/** Tipografia do item: igual à da célula, para o menu não "crescer" sobre a tabela. */
const MENU_ITEM_FONT_SIZE = "0.8125rem";

/**
 * `sx` do item de menu. Aplique em **todo** `MenuItem` de Configurações.
 *
 * Espalhe depois do seu próprio `sx` para poder sobrepor (ex.: a cor destrutiva do
 * item "Excluir").
 */
export const SETTINGS_MENU_ITEM_SX = {
  fontSize: MENU_ITEM_FONT_SIZE,
  minHeight: MENU_ITEM_MIN_HEIGHT,
  py: 0.5,
  "& .MuiListItemIcon-root": { minWidth: 26 },
  "& .MuiListItemIcon-root svg": { fontSize: 16 },
} as const;

/**
 * `slotProps` do `Menu`. Enxuga o respiro da lista.
 *
 * Sem `minWidth` no papel de propósito: o menu já se dimensiona pelo rótulo mais
 * longo, e forçar uma largura só deixaria sobra à direita de menus curtos.
 */
export const SETTINGS_MENU_SLOT_PROPS = {
  list: { dense: true, sx: { py: 0.5 } },
} as const satisfies MenuProps["slotProps"];

/**
 * `MenuProps` do `Select` — o popup de um seletor é um `Menu` como os outros, e sem
 * isto as opções saem em 16px dentro de um campo de 13px.
 */
export const SETTINGS_SELECT_MENU_PROPS = {
  anchorOrigin: { vertical: "bottom", horizontal: "left" },
  transformOrigin: { vertical: "top", horizontal: "left" },
  slotProps: SETTINGS_MENU_SLOT_PROPS,
} as const;
