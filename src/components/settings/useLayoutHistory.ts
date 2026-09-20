"use client";

import { useCallback, useState } from "react";

import type { StoredWidget } from "@/lib/schemas/dashboard-layout";

/**
 * Spec 69 §2.3 — undo / redo do editor de dashboard.
 *
 * Pilha de estados completos de `StoredWidget[]` (não de diffs): o layout é
 * pequeno (dezenas de objetos rasos) e o estado inteiro é o que a action já
 * envia ao servidor — guardar diffs custaria mais código e a mesma memória.
 *
 * Cobre TODAS as operações do editor por construção: quem altera o layout
 * chama sempre o mesmo `onLayoutChange`, e é lá que o estado anterior é
 * empilhado — mover, redimensionar, adicionar, duplicar, remover e ocultar.
 *
 * O estado atual NÃO fica na pilha; ele vive no editor. `undo`/`redo` recebem
 * o estado atual para poder empilhá-lo do outro lado.
 */

/**
 * Teto da pilha. 50 passos cobrem com folga uma sessão de edição (o frame fala
 * em "3 movimentações"), e 50 layouts de ~30 widgets rasos é memória
 * irrelevante. Ao estourar, o passo mais ANTIGO é descartado — perder o começo
 * de uma sessão longa incomoda menos que perder o que acabou de ser feito.
 */
export const LAYOUT_HISTORY_LIMIT = 50;

export type LayoutHistory = {
  canUndo: boolean;
  canRedo: boolean;
  /** Empilha o estado ANTERIOR à mudança e zera o redo (novo ramo). */
  push: (previous: StoredWidget[]) => void;
  /** Devolve o estado anterior (ou null) e empilha `current` no redo. */
  undo: (current: StoredWidget[]) => StoredWidget[] | null;
  /** Devolve o estado refeito (ou null) e empilha `current` no undo. */
  redo: (current: StoredWidget[]) => StoredWidget[] | null;
  /** Limpa as duas pilhas (ex.: "Restaurar padrão" — ponto de partida novo). */
  reset: () => void;
};

export function useLayoutHistory(): LayoutHistory {
  const [past, setPast] = useState<StoredWidget[][]>([]);
  const [future, setFuture] = useState<StoredWidget[][]>([]);

  const push = useCallback((previous: StoredWidget[]) => {
    setPast((stack) => [...stack, previous].slice(-LAYOUT_HISTORY_LIMIT));
    setFuture([]);
  }, []);

  const undo = useCallback(
    (current: StoredWidget[]): StoredWidget[] | null => {
      if (past.length === 0) return null;
      const previous = past[past.length - 1];
      setPast((stack) => stack.slice(0, -1));
      setFuture((stack) => [current, ...stack].slice(0, LAYOUT_HISTORY_LIMIT));
      return previous;
    },
    [past],
  );

  const redo = useCallback(
    (current: StoredWidget[]): StoredWidget[] | null => {
      if (future.length === 0) return null;
      const next = future[0];
      setFuture((stack) => stack.slice(1));
      setPast((stack) => [...stack, current].slice(-LAYOUT_HISTORY_LIMIT));
      return next;
    },
    [future],
  );

  const reset = useCallback(() => {
    setPast([]);
    setFuture([]);
  }, []);

  return { canUndo: past.length > 0, canRedo: future.length > 0, push, undo, redo, reset };
}
