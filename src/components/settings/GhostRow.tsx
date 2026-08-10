"use client";

import AddIcon from "@mui/icons-material/Add";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
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

import { layout, radius } from "@/lib/design-tokens";
import { m } from "@/lib/messages";

export type GhostRowHandle = {
  /** rola até a linha e foca o primeiro campo focável dentro dela */
  focus: () => void;
};

type Props = {
  /** rótulo do estado ocioso; default m.settings.shell.addRow */
  label?: string;
  /** true = a linha está em edição e renderiza `children` */
  editing: boolean;
  onStartEditing: () => void;
  /** Esc — descarta a linha em edição */
  onCancel: () => void;
  /** Enter numa linha válida — grava e a página deve manter o foco na próxima linha-fantasma */
  onCommit: () => void;
  /** quando false, Enter não grava (linha inválida) */
  canCommit?: boolean;
  children?: ReactNode;
};

/** Seletor do contrato da Spec 67 §2.5 para achar o primeiro campo da linha. */
const FOCUSABLE_SELECTOR = 'input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * O seletor acima pega também os inputs auxiliares que o MUI esconde dentro de alguns
 * campos (o `input` nativo do Select, por exemplo, vem `aria-hidden` e `tabindex="-1"`).
 * Focar um deles não leva o cursor para lugar nenhum visível — então só aceitamos o que
 * o usuário realmente alcançaria pelo teclado.
 */
function isKeyboardReachable(element: HTMLElement): boolean {
  return (
    !element.hasAttribute("disabled") &&
    element.getAttribute("tabindex") !== "-1" &&
    element.getAttribute("aria-hidden") !== "true"
  );
}

/**
 * Linha-fantasma no fim das listas dos arquétipos A e B (Spec 67 §2.5 / SET-08).
 *
 * É o **único** caminho de criação dessas páginas: a ação primária do cabeçalho não abre
 * modal, ela chama `focus()` deste handle — exatamente o mesmo efeito de clicar na linha.
 *
 * O contêiner é um `Box`, não um `TableRow`: a linha-fantasma vive **fora** do `<table>`
 * (irmã dele, logo abaixo), porque no estado ocioso ela é um botão de largura total e não
 * uma grade de células.
 */
export const GhostRow = forwardRef<GhostRowHandle, Props>(function GhostRow(
  {
    label = m.settings.shell.addRow,
    editing,
    onStartEditing,
    onCancel,
    onCommit,
    canCommit = true,
    children,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const focusFirstField = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const first = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).find(
      isKeyboardReachable,
    );
    // Ocioso: ainda não há campo nenhum, então o alvo do foco é o próprio botão da linha.
    (first ?? triggerRef.current)?.focus();
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      focus() {
        // `scrollIntoView` não é implementado pelo jsdom; o `?.()` mantém o handle
        // utilizável em teste sem precisar de stub global.
        containerRef.current?.scrollIntoView?.({ block: "nearest" });
        focusFirstField();
      },
    }),
    [focusFirstField],
  );

  const wasEditing = useRef(editing);
  useEffect(() => {
    // SET-08 exige que abrir a linha deixe o cursor no primeiro campo. Quem abriu (clique
    // ou Enter no botão) não consegue focar um campo que ainda não existia naquele
    // instante, então a própria linha assume o foco na transição ocioso -> edição.
    // Só na transição: montar já em edição (restauração de estado) não deve roubar o foco.
    if (editing && !wasEditing.current) focusFirstField();
    wasEditing.current = editing;
  }, [editing, focusFirstField]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Nada a gravar nem a descartar enquanto a linha está ociosa — e aqui o Enter já
    // significa "abrir a linha" (o ButtonBase o converte em clique). Interceptar
    // gravaria uma linha vazia.
    if (!editing) return;

    // Um filho já tratou a tecla: Select/Autocomplete/DatePicker abertos usam Enter para
    // escolher a opção e Esc para fechar o popup, sempre com preventDefault. Tratar de
    // novo aqui gravaria ou descartaria a linha junto com a escolha do usuário.
    if (event.defaultPrevented) return;

    if (event.key === "Escape") {
      onCancel();
      return;
    }

    if (event.key !== "Enter") return;

    // Enter dentro de textarea é quebra de linha legítima, não comando de gravar.
    if ((event.target as HTMLElement).tagName === "TEXTAREA") return;

    if (!canCommit) return;
    event.preventDefault(); // evita submit do form que envolve a lista
    onCommit();
  }

  return (
    <Box
      ref={containerRef}
      onKeyDown={handleKeyDown}
      sx={{
        borderTop: "1px dashed",
        borderColor: "border.subtle",
      }}
    >
      {editing ? (
        <Box sx={{ px: layout.inline, py: layout.micro }}>{children}</Box>
      ) : (
        <ButtonBase
          ref={triggerRef}
          onClick={onStartEditing}
          sx={{
            width: "100%",
            justifyContent: "flex-start",
            gap: layout.inline,
            px: layout.inline,
            py: layout.inline,
            borderRadius: `${radius.sm}px`,
            "&:hover": { bgcolor: "background.subtle" },
          }}
        >
          <AddIcon fontSize="small" sx={{ color: "accent.primary" }} />
          <Typography variant="body2" sx={{ color: "text.tertiary" }}>
            {label}
          </Typography>
        </ButtonBase>
      )}
    </Box>
  );
});
