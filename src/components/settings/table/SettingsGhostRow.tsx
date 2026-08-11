"use client";

import AddIcon from "@mui/icons-material/Add";
import ButtonBase from "@mui/material/ButtonBase";
import Stack from "@mui/material/Stack";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { m } from "@/lib/messages";

import {
  SETTINGS_CELL_PADDING,
  SETTINGS_GRIP_WIDTH,
  SETTINGS_ROW_HEIGHT,
  SETTINGS_ROW_ICON,
  SETTINGS_TABLE_FONT,
} from "./settings-table-tokens";
import { SettingsEditActions } from "./SettingsRowField";

export type SettingsGhostRowHandle = {
  /** Rola até a linha e foca o primeiro campo focável dentro dela. */
  focus: () => void;
};

export type SettingsGhostRowProps = {
  /** Rótulo do estado ocioso ("Adicionar seção…"). */
  label: string;
  editing: boolean;
  onStartEditing: () => void;
  onCancel: () => void;
  onCommit: () => void;
  canCommit?: boolean;
  /** Quantas colunas a tabela tem — o estado ocioso ocupa a linha inteira. */
  columnCount: number;
  /**
   * Células do estado de edição, **na ordem das colunas da tabela**, começando DEPOIS
   * da coluna do `+` e terminando ANTES da coluna das ações. É isso que alinha o campo
   * de criação com a coluna que ele preenche.
   */
  children?: ReactNode;
  /** Nome para os aria-labels das ações (default: o próprio rótulo). */
  name?: string;
  /**
   * A tabela tem coluna de alça de arraste? (default: sim)
   *
   * Passe `false` nas listas sem arraste (Instituições, Responsáveis): reservar uma
   * coluna vazia só para alinhar o `+` da criação empurra o conteúdo da primeira
   * coluna 24px para dentro, e o nome deixa de ficar sob o rótulo "NOME". Com `false`
   * a primeira célula é a sua — inclua o `+` nela (`SettingsGhostAddIcon`) para a
   * linha continuar se anunciando como a de criar.
   */
  gripColumn?: boolean;
};

const FOCUSABLE = 'input, select, textarea, [tabindex]:not([tabindex="-1"])';

function isReachable(element: HTMLElement): boolean {
  return (
    !element.hasAttribute("disabled") &&
    element.getAttribute("tabindex") !== "-1" &&
    element.getAttribute("aria-hidden") !== "true"
  );
}

/**
 * A linha de criação, **dentro** da tabela (Spec 68, revisão de estilo).
 *
 * Difere do `GhostRow` da Spec 67 num ponto que a revisão pediu: ali a linha é um
 * `Box` irmão do `<table>`, então os campos de criação não se alinham com as colunas —
 * criar uma seção não parecia preencher a mesma tabela que a lista mostra. Aqui a
 * linha é um `<TableRow>` de verdade e cada campo cai na sua coluna.
 *
 * O contrato de teclado é o mesmo (Enter grava e reabre, Esc descarta) **e** agora há
 * os dois botões explícitos: quem não descobre o atalho ainda tem como confirmar e
 * cancelar com o mouse, na mesma posição em que a linha em edição os mostra.
 */
export const SettingsGhostRow = forwardRef<SettingsGhostRowHandle, SettingsGhostRowProps>(
  function SettingsGhostRow(
    {
      label,
      editing,
      onStartEditing,
      onCancel,
      onCommit,
      canCommit = true,
      columnCount,
      children,
      name,
      gripColumn = true,
    },
    ref,
  ) {
    const rowRef = useRef<HTMLTableRowElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    const focusFirstField = useCallback(() => {
      const container = rowRef.current;
      if (!container) return;
      const first = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).find(isReachable);
      (first ?? triggerRef.current)?.focus();
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        focus() {
          // `scrollIntoView` não existe no jsdom; o `?.()` mantém o handle testável.
          rowRef.current?.scrollIntoView?.({ block: "nearest" });
          focusFirstField();
        },
      }),
      [focusFirstField],
    );

    const wasEditing = useRef(editing);
    useEffect(() => {
      // Abrir a linha tem de deixar o cursor no primeiro campo. Só na TRANSIÇÃO:
      // montar já em edição não deve roubar o foco de onde o usuário estava.
      if (editing && !wasEditing.current) focusFirstField();
      wasEditing.current = editing;
    }, [editing, focusFirstField]);

    function handleKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
      if (!editing) return;
      // Um filho já tratou a tecla: Select/Autocomplete abertos usam Enter para
      // escolher e Esc para fechar, sempre com preventDefault.
      if (event.defaultPrevented) return;

      if (event.key === "Escape") {
        onCancel();
        return;
      }
      if (event.key !== "Enter") return;
      if ((event.target as HTMLElement).tagName === "TEXTAREA") return;
      if (!canCommit) return;
      event.preventDefault();
      onCommit();
    }

    if (!editing) {
      return (
        <TableRow ref={rowRef} sx={{ height: SETTINGS_ROW_HEIGHT }}>
          <TableCell
            colSpan={columnCount}
            sx={{
              p: 0,
              // Tracejada: sinaliza "aqui ainda não é um item" sem precisar de texto.
              borderBottomStyle: "dashed",
            }}
          >
            <ButtonBase
              ref={triggerRef}
              onClick={onStartEditing}
              sx={{
                width: "100%",
                justifyContent: "flex-start",
                gap: 1,
                px: SETTINGS_CELL_PADDING.x,
                py: SETTINGS_CELL_PADDING.y,
                "&:hover": { bgcolor: "background.subtle" },
              }}
            >
              <AddIcon sx={{ fontSize: SETTINGS_ROW_ICON.size, color: "accent.primary" }} />
              <Typography
                sx={{ fontSize: SETTINGS_TABLE_FONT.row.size, color: "text.tertiary" }}
              >
                {label}
              </Typography>
            </ButtonBase>
          </TableCell>
        </TableRow>
      );
    }

    return (
      <TableRow
        ref={rowRef}
        onKeyDown={handleKeyDown}
        sx={{ height: SETTINGS_ROW_HEIGHT, bgcolor: "background.subtle" }}
      >
        {gripColumn && (
          <TableCell
            sx={{
              width: SETTINGS_GRIP_WIDTH,
              px: 0,
              py: SETTINGS_CELL_PADDING.y,
              textAlign: "right",
              borderLeftWidth: "2px",
              borderLeftStyle: "solid",
              borderLeftColor: "accent.primary",
            }}
          >
            {/* O `+` fica onde a alça de arraste está nas outras linhas: é o que diz
                "esta linha é a de criar", sem depender do texto. */}
            <SettingsGhostAddIcon />
          </TableCell>
        )}

        {children}

        <TableCell sx={{ px: 0.5, py: SETTINGS_CELL_PADDING.y }} align="right">
          <Stack direction="row" justifyContent="flex-end">
            <SettingsEditActions
              onCancel={onCancel}
              onCommit={onCommit}
              canCommit={canCommit}
              name={name ?? label}
            />
          </Stack>
        </TableCell>
      </TableRow>
    );
  },
);

/**
 * O `+` que marca a linha de criação. Renderizado pela própria `SettingsGhostRow`
 * quando ela tem coluna de alça; exportado para as tabelas SEM alça o colocarem na
 * primeira célula (ver `gripColumn`).
 */
export function SettingsGhostAddIcon() {
  return <AddIcon sx={{ fontSize: SETTINGS_ROW_ICON.size, color: "accent.primary" }} />;
}

/** Dica do atalho, para a página exibir abaixo da tabela enquanto a linha está aberta. */
export const settingsGhostHint = () => m.settings.structure.ghostHint;
