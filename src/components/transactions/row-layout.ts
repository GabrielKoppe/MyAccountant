"use client";

import { useEffect, useState, type RefObject } from "react";

// Layout da linha (Spec 66 TX-04b, Spec 69 D4): "columns" (A, default, colunas
// explícitas) × "pills" (B, descrição + pílulas). Espelha o `RowLayout` do
// schema; declarado aqui para não acoplar a fronteira Client aos schemas de
// settings. O valor B se chamava "rich" até a Spec 69.
export type RowLayout = "columns" | "pills";

/**
 * Resolve o layout efetivo de renderização (TX-04d):
 * - viewport estreito SEMPRE degrada para "pills" (mais compacto), sem alterar a
 *   config compartilhada do `TableType`;
 * - caso contrário, usa o configurado, normalizando qualquer valor diferente de
 *   "pills" para "columns".
 */
export function resolveRowLayout(configured: RowLayout, isNarrow: boolean): RowLayout {
  if (isNarrow) return "pills";
  return configured !== "pills" ? "columns" : "pills";
}

/**
 * Observa a largura do container e indica se está abaixo do limiar (default 640px).
 * Retorna `false` até montar (`mounted`) — SSR e a 1ª render do client usam
 * sempre o layout configurado, evitando divergência de hidratação (CLAUDE §7).
 */
export function useIsNarrow<T extends HTMLElement>(
  ref: RefObject<T | null>,
  thresholdPx = 640,
): boolean {
  const [narrow, setNarrow] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const el = ref.current;
    if (!el) return;

    const update = () => setNarrow(el.getBoundingClientRect().width < thresholdPx);
    update();

    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [mounted, ref, thresholdPx]);

  return mounted ? narrow : false;
}
