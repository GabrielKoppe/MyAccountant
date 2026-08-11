"use client";

import type { ReactElement } from "react";
import { cloneElement } from "react";

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

/**
 * Intenção do diálogo — decide a COR do ícone do título, como no desenho:
 * perigo em "excluir", atenção em "desativar", accent em tudo o mais.
 *
 * A cor não é decoração: é o que distingue, antes da leitura, um diálogo que
 * destrói de um que só informa.
 */
export type SettingsDialogTone = "accent" | "warning" | "danger";

const TONE_COLOR: Record<SettingsDialogTone, string> = {
  accent: "accent.primary",
  warning: "warning.main",
  danger: "danger.main",
};

export type SettingsDialogProps = Omit<DialogShellProps, "maxWidth" | "titleVariant"> & {
  /** Uma das três larguras do catálogo. Sem largura sob medida por tela (D8). */
  size: SettingsDialogSize;
  /** Intenção: colore o ícone do título. Default `accent`. */
  tone?: SettingsDialogTone;
};

/**
 * Modal padrão das Configurações: `DialogShell` com uma das três larguras fixas.
 *
 * Use SEMPRE em vez de `<DialogShell>` (e nunca `<Dialog>` cru) nas páginas de
 * configurações, para que todo modal caia em 420 / 560 / 720 px.
 */
export function SettingsDialog({
  size,
  tone = "accent",
  titleIcon,
  ...shellProps
}: SettingsDialogProps) {
  // O chamador passa só o ícone; a COR e o TAMANHO vêm daqui, para os seis diálogos
  // da família não divergirem um a um.
  const tintedIcon =
    titleIcon != null
      ? cloneElement(titleIcon as ReactElement<{ sx?: object }>, {
          sx: { fontSize: 18, color: TONE_COLOR[tone] },
        })
      : undefined;

  return (
    <DialogShell
      {...shellProps}
      titleIcon={tintedIcon}
      // 16px: a medida do título no desenho. O default do `DialogShell` (20px) fica
      // para os diálogos de fora de Configurações, que não foram revisados.
      titleVariant="h5"
      // Depois do spread de propósito: o `size` é a única fonte da largura,
      // mesmo que o chamador tente passar `maxWidthPx` por fora.
      maxWidth={SETTINGS_DIALOG_BREAKPOINT[size]}
      maxWidthPx={SETTINGS_DIALOG_WIDTH[size]}
    />
  );
}
