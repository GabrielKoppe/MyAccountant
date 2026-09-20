import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { StoredWidget } from "@/lib/schemas/dashboard-layout";

import { LAYOUT_HISTORY_LIMIT, useLayoutHistory } from "./useLayoutHistory";

function widget(x: number): StoredWidget {
  return {
    instanceId: `w-${x}`,
    widgetId: "kpi-income",
    visible: true,
    x,
    y: 0,
    w: 1,
    h: 1,
    sizeVariantId: "default",
  };
}

const A = [widget(0)];
const B = [widget(1)];
const C = [widget(2)];

describe("useLayoutHistory", () => {
  it("começa sem nada a desfazer nem refazer", () => {
    const { result } = renderHook(() => useLayoutHistory());
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.undo(A)).toBeNull();
    expect(result.current.redo(A)).toBeNull();
  });

  it("desfaz e refaz uma sequência de alterações", () => {
    const { result } = renderHook(() => useLayoutHistory());

    act(() => result.current.push(A)); // A → B
    act(() => result.current.push(B)); // B → C
    expect(result.current.canUndo).toBe(true);

    let undone: StoredWidget[] | null = null;
    act(() => {
      undone = result.current.undo(C);
    });
    expect(undone).toEqual(B);
    expect(result.current.canRedo).toBe(true);

    act(() => {
      undone = result.current.undo(B);
    });
    expect(undone).toEqual(A);
    expect(result.current.canUndo).toBe(false);

    let redone: StoredWidget[] | null = null;
    act(() => {
      redone = result.current.redo(A);
    });
    expect(redone).toEqual(B);
    act(() => {
      redone = result.current.redo(B);
    });
    expect(redone).toEqual(C);
    expect(result.current.canRedo).toBe(false);
  });

  it("uma alteração nova depois de desfazer descarta o refazer (novo ramo)", () => {
    const { result } = renderHook(() => useLayoutHistory());
    act(() => result.current.push(A));
    act(() => {
      result.current.undo(B);
    });
    expect(result.current.canRedo).toBe(true);
    act(() => result.current.push(A));
    expect(result.current.canRedo).toBe(false);
  });

  it("respeita o teto da pilha descartando o passo mais antigo", () => {
    const { result } = renderHook(() => useLayoutHistory());
    act(() => {
      for (let i = 0; i <= LAYOUT_HISTORY_LIMIT; i++) result.current.push([widget(i)]);
    });
    // Desfaz até o fim: o passo 0 (o mais antigo) já não está lá.
    // Um `act` por undo — `undo` lê a pilha do render atual, como na UI (cada
    // Ctrl+Z é um evento, com re-render entre eles).
    const seen: number[] = [];
    let current: StoredWidget[] = [widget(999)];
    for (let i = 0; i <= LAYOUT_HISTORY_LIMIT; i++) {
      let previous: StoredWidget[] | null = null;
      act(() => {
        previous = result.current.undo(current);
      });
      if (!previous) break;
      seen.push((previous as StoredWidget[])[0].x);
      current = previous;
    }
    expect(seen).toHaveLength(LAYOUT_HISTORY_LIMIT);
    expect(seen).not.toContain(0);
  });

  it("reset limpa as duas pilhas", () => {
    const { result } = renderHook(() => useLayoutHistory());
    act(() => result.current.push(A));
    act(() => {
      result.current.undo(B);
    });
    act(() => result.current.reset());
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });
});
