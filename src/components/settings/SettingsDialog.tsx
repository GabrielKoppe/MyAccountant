"use client";

import { DialogShell, type DialogShellProps } from "@/components/ui/DialogShell";

/**
 * Catálogo de larguras de modal das Configurações (Spec 67 §2.7 / D8).
 * - `confirm`: confirmação curta (uma frase + dois botões)
 * - `form`: formulário curto (poucos campos)
 * - `editor`: editor com preview / listas lado a lado
 */
export type SettingsDialogSize = "confirm" | "form" | "editor";

/**
 * Larguras em px explícitos. NÃO usar os breakpoints do MUI (xs=444, sm=600,
 * md=900): ficam largos demais, sobretudo na confirmação (D8).
 */
export const SETTINGS_DIALOG_WIDTH: Record<SettingsDialogSize, number> = {
  confirm: 420,
  form: 560,
  editor: 720,
};

/**
 * Breakpoint imediatamente superior a cada largura em px. Serve só para o
 * comportamento responsivo do MUI (margens, `fullWidth`) continuar sensato —
 * quem manda na largura final é `maxWidthPx`.
 */
const SETTINGS_DIALOG_BREAKPOINT: Record<SettingsDialogSize, "xs" | "sm" | "md"> = {
  confirm: "xs",
  form: "sm",
  editor: "md",
};

export type SettingsDialogProps = Omit<DialogShellProps, "maxWidth"> & {
  /** Uma das três larguras do catálogo. Sem largura sob medida por tela (D8). */
  size: SettingsDialogSize;
};

/**
 * Modal padrão das Configurações: `DialogShell` com uma das três larguras fixas.
 *
 * Use SEMPRE em vez de `<DialogShell>` (e nunca `<Dialog>` cru) nas páginas de
 * configurações, para que todo modal caia em 420 / 560 / 720 px.
 */
export function SettingsDialog({ size, ...shellProps }: SettingsDialogProps) {
  return (
    <DialogShell
      {...shellProps}
      // Depois do spread de propósito: o `size` é a única fonte da largura,
      // mesmo que o chamador tente passar `maxWidthPx` por fora.
      maxWidth={SETTINGS_DIALOG_BREAKPOINT[size]}
      maxWidthPx={SETTINGS_DIALOG_WIDTH[size]}
    />
  );
}
