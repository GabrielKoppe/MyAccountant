import type { SxProps, Theme } from "@mui/material/styles";

/**
 * Base do `.chip` do frame (Spec 66 · Fidelidade): height 20, padding interno
 * 0 8px, radius 5, fontWeight 500, fontSize 0.68rem, gap ícone↔label 4px.
 * Usado em TODAS as pílulas de metadado da linha de transação (categoria,
 * instituição, responsável, moeda, tags, +N, parcela). Ver skills/design-system/SKILL.md.
 */
const chipBaseSx = {
  height: 20,
  borderRadius: "5px",
  fontWeight: 500,
  fontSize: "0.68rem",
  "& .MuiChip-label": { px: 1 },
  "& .MuiChip-icon": { fontSize: 12, marginLeft: "6px", marginRight: "-2px" },
  // Dimensões do mini-avatar já vêm do próprio `PartyAvatar` (prop `size`) —
  // aqui só ajustamos o espaçamento em torno dele dentro do chip.
  "& .MuiChip-avatar": { marginLeft: "5px", marginRight: "-2px" },
} as const;

/**
 * Pílula preenchida (categoria, instituição, responsável, moeda, tags overflow "+N"):
 * discreta o suficiente para não competir com o conteúdo primário da linha.
 */
export const pillSx: SxProps<Theme> = {
  ...chipBaseSx,
  bgcolor: "background.muted",
  color: "text.secondary",
};

/**
 * Pílula contornada (parcela): mesma forma do `.chip`, sem preenchimento —
 * variação "Contorno (parcela)" das primitivas reutilizadas do frame.
 */
export const pillOutlineSx: SxProps<Theme> = {
  ...chipBaseSx,
  bgcolor: "transparent",
  border: "1px solid",
  borderColor: "border.default",
  color: "text.secondary",
};

/**
 * `.cbox` do frame — checkbox não marcado: 15x15, borda border.strong, radius 3,
 * sem preenchimento. Passado via prop `icon` do `<Checkbox>` do MUI.
 */
export const rowCheckboxIconSx: SxProps<Theme> = {
  width: 15,
  height: 15,
  borderRadius: "3px",
  border: "1px solid",
  borderColor: "border.strong",
  boxSizing: "border-box",
  display: "inline-block",
};

/**
 * `.cbox` marcado: 15x15, radius 3, preenchido com accent.primary, ícone
 * `check` 12px em background.canvas. Passado via prop `checkedIcon`.
 */
export const rowCheckboxCheckedIconSx: SxProps<Theme> = {
  width: 15,
  height: 15,
  borderRadius: "3px",
  bgcolor: "accent.primary",
  color: "background.canvas",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  boxSizing: "border-box",
};
