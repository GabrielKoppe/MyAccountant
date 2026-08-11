"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import Box from "@mui/material/Box";
import { useEffect, useState, type ReactNode } from "react";

import { m } from "@/lib/messages";

export type SortableRowsProps = {
  /** Ids na ordem ATUAL de exibição. */
  ids: string[];
  /** Chamado com a lista completa já reordenada — pronta para virar `orderedIds`. */
  onReorder: (orderedIds: string[]) => void;
  children: ReactNode;
};

/**
 * Contexto de arraste vertical para linhas de tabela (Spec 68 §7.4).
 *
 * Usado por Seções e por Categorias — a ordem da lista É a informação (ordem das abas
 * do mês, ordem manual da árvore), então persistir o arraste é a feature, não enfeite.
 *
 * O arraste é travado no eixo vertical zerando o `x` do transform em `SortableRow`, e
 * não com `@dnd-kit/modifiers`: uma linha de tabela que desliza lateralmente sai de
 * baixo das colunas e o resultado fica ilegível. Duas linhas de código evitam uma
 * dependência nova só para isso.
 *
 * O gate `mounted` não é frescura: o @dnd-kit gera ids de acessibilidade que divergem
 * entre SSR e cliente, e sem ele o React derruba a hidratação da página inteira. Mesmo
 * padrão já usado em `DashboardGridCanvas`.
 *
 * ⚠️ **ENVOLVA A TABELA INTEIRA, NUNCA SÓ O `<TableBody>`.** O `DndContext` injeta um
 * `<div>` oculto de acessibilidade como irmão do conteúdo; dentro de `<tbody>` isso é
 * HTML inválido (`<div>` filho de `<tbody>`) e produz warning de hidratação em runtime.
 *
 * ```tsx
 * // ✅ Certo
 * <SortableRows ids={ids} onReorder={save}>
 *   <TableContainer><Table>…</Table></TableContainer>
 * </SortableRows>
 *
 * // ❌ Errado — o <div> do DndContext vira filho de <tbody>
 * <Table><SortableRows …><TableBody>…</TableBody></SortableRows></Table>
 * ```
 */
export function SortableRows({ ids, onReorder, children }: SortableRowsProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const sensors = useSensors(
    // 5px antes de considerar arraste: sem isso, um clique no menu da linha (que fica
    // na mesma linha) é interpretado como início de drag e o menu não abre.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;

    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onReorder(next);
  }

  if (!mounted) return <>{children}</>;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

export type SortableRowRenderProps = {
  /** Vai na raiz da linha (`<TableRow ref={…}>`). */
  setNodeRef: (node: HTMLElement | null) => void;
  /** Transform/transition do arraste — aplicar via `sx` ou `style` da linha. */
  style: { transform: string | undefined; transition: string | undefined; opacity?: number };
  /** A alça pronta, com ícone e aria-label. Renderizar na primeira célula. */
  handle: ReactNode;
  isDragging: boolean;
};

export type SortableRowProps = {
  id: string;
  /** Nome do objeto — compõe o aria-label da alça. */
  name: string;
  disabled?: boolean;
  children: (props: SortableRowRenderProps) => ReactNode;
};

/**
 * Uma linha arrastável. Render-prop porque a linha em si é um `<TableRow>` montado
 * pela página, com suas próprias células — este componente fornece só o comportamento.
 *
 * A alça vem pronta: o §7.4 exige `DragIndicator` e proíbe a linha inteira arrastável
 * (a linha carrega links, switch e menu; arrastá-la por qualquer ponto tornaria esses
 * controles inalcançáveis por toque).
 */
export function SortableRow({ id, name, disabled = false, children }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });

  const handle = (
    <Box
      component="span"
      {...attributes}
      {...listeners}
      aria-label={`${m.settings.structure.dragHandleLabel}: ${name}`}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        color: "text.disabled",
        cursor: disabled ? "default" : "grab",
        touchAction: "none",
        "&:active": { cursor: disabled ? "default" : "grabbing" },
        "&:focus-visible": { outline: "2px solid", outlineColor: "accent.primary" },
      }}
    >
      <DragIndicatorIcon sx={{ fontSize: 16 }} />
    </Box>
  );

  return (
    <>
      {children({
        setNodeRef,
        style: {
          // `x: 0` trava o eixo: a linha só sobe e desce, nunca desliza para fora
          // das colunas da tabela.
          transform: CSS.Transform.toString(transform && { ...transform, x: 0 }),
          transition,
          // A linha arrastada some parcialmente para o vizinho aparecer no lugar dela.
          ...(isDragging ? { opacity: 0.5 } : {}),
        },
        handle,
        isDragging,
      })}
    </>
  );
}
