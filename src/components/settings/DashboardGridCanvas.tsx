"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import { useSnackbar } from "notistack";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";

import { m } from "@/lib/messages";
import type { DashboardContext, WidgetDef } from "@/components/dashboards/_core/widget-registry";
import {
  applyMoveWithPush,
  applyResizeWithPush,
  findFreeCell,
  insertWithPush,
  snapToNearestVariant,
} from "@/components/dashboards/_core/grid-layout";
import type { StoredWidget } from "@/lib/schemas/dashboard-layout";
import type { WidgetConfigOptions } from "@/lib/queries/widget-config-options";
import { WidgetCardBody } from "./WidgetCardBody";
import { PALETTE_DRAG_PREFIX, WidgetPalette } from "./WidgetPalette";
import { WidgetSettingsPanel } from "./WidgetSettingsPanel";

const ROW_HEIGHT = 88; // px por linha da grade no editor
const GAP_PX = 8; // = theme.spacing(2)

type LayoutChangeOpts = { immediate?: boolean };

type Props = {
  widgets: StoredWidget[];
  registry: WidgetDef[];
  configOptions: WidgetConfigOptions;
  cols: number;
  maxRows: number;
  initialRows: number;
  context: DashboardContext;
  onLayoutChange: (widgets: StoredWidget[], opts?: LayoutChangeOpts) => void;
};

type ResizeSession = {
  instanceId: string;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
  def: WidgetDef;
  resultLayout: StoredWidget[] | null;
};

// ─── Geometria local ────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function layoutsEqual(a: StoredWidget[], b: StoredWidget[]): boolean {
  if (a.length !== b.length) return false;
  const byId = new Map(b.map((w) => [w.instanceId, w]));
  return a.every((w) => {
    const o = byId.get(w.instanceId);
    return o != null && o.x === w.x && o.y === w.y && o.w === w.w && o.h === w.h;
  });
}

function newInstanceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `w-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// pointerWithin (mouse/touch) com fallback rectIntersection (teclado) — garante
// que o drop da paleta encontre uma célula tanto no pointer quanto no teclado.
const collisionDetection: CollisionDetection = (args) => {
  const byPointer = pointerWithin(args);
  return byPointer.length > 0 ? byPointer : rectIntersection(args);
};

function parseCellId(id: string | number | null | undefined): { x: number; y: number } | null {
  if (typeof id !== "string" || !id.startsWith("cell:")) return null;
  const [, sx, sy] = id.split(":");
  const x = Number(sx);
  const y = Number(sy);
  if (Number.isNaN(x) || Number.isNaN(y)) return null;
  return { x, y };
}

// ─── Alça de redimensionamento ──────────────────────────────────────────────
// Apenas o canto inferior-direito, com aparência sutil (L em tom neutro) e
// interação robusta via pointer capture (sem listeners de window). Arrasta os
// dois eixos e faz snap para a variante mais próxima.
function ResizeHandle({
  selected,
  onStart,
  onMove,
  onEnd,
}: {
  selected: boolean;
  onStart: (clientX: number, clientY: number) => void;
  onMove: (clientX: number, clientY: number) => void;
  onEnd: () => void;
}) {
  return (
    <Box
      aria-label={m.settings.dashboards.resizeWidget}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        onStart(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) onMove(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
          onEnd();
        }
      }}
      onClick={(e) => e.stopPropagation()}
      sx={{
        position: "absolute",
        right: 3,
        bottom: 3,
        width: 11,
        height: 11,
        zIndex: 4,
        cursor: "nwse-resize",
        touchAction: "none",
        borderRight: "2px solid",
        borderBottom: "2px solid",
        borderColor: selected ? "text.secondary" : "text.disabled",
        // Acompanha a curva do card (radius.lg = 12px), descontado o inset de 3px,
        // para o grip ficar concêntrico ao canto arredondado em vez de reto.
        borderBottomRightRadius: "9px",
        opacity: selected ? 0.7 : 0.4,
        transition: "opacity 120ms, border-color 120ms",
        "&:hover": { opacity: 0.95, borderColor: "text.secondary" },
      }}
    />
  );
}

function DraggableWidget({
  widget,
  context,
  dragging,
  isActive,
  selected,
  showResize,
  onToggleVisible,
  onSelect,
  onResizeStart,
  onResizeMove,
  onResizeEnd,
}: {
  widget: StoredWidget;
  context: DashboardContext;
  /** Algum widget está sendo arrastado (desabilita hover dos demais). */
  dragging: boolean;
  /** Este é o widget arrastado → renderiza como ghost na posição de destino. */
  isActive: boolean;
  selected: boolean;
  showResize: boolean;
  onToggleVisible: () => void;
  onSelect: () => void;
  onResizeStart: (clientX: number, clientY: number) => void;
  onResizeMove: (clientX: number, clientY: number) => void;
  onResizeEnd: () => void;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: widget.instanceId });

  return (
    <Box
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onSelect}
      sx={{
        gridColumn: `${widget.x + 1} / span ${widget.w}`,
        gridRow: `${widget.y + 1} / span ${widget.h}`,
        position: "relative",
        minWidth: 0,
        minHeight: 0,
        cursor: "grab",
        touchAction: "none",
        outline: "none",
        zIndex: isActive ? 3 : selected ? 2 : 1,
        "&:hover": dragging ? undefined : { zIndex: 2 },
        "&:active": { cursor: "grabbing" },
      }}
    >
      <WidgetCardBody
        widget={widget}
        context={context}
        onToggleVisible={onToggleVisible}
        selected={selected}
        ghost={isActive}
        hoverable={!dragging && !selected}
      />
      {showResize && !isActive && !dragging && (
        <ResizeHandle
          selected={selected}
          onStart={onResizeStart}
          onMove={onResizeMove}
          onEnd={onResizeEnd}
        />
      )}
    </Box>
  );
}

function GuideCell({ x, y, droppable }: { x: number; y: number; droppable: boolean }) {
  const { setNodeRef } = useDroppable({ id: `cell:${x}:${y}` });
  return (
    <Box
      ref={droppable ? setNodeRef : undefined}
      sx={{
        gridColumn: `${x + 1}`,
        gridRow: `${y + 1}`,
        border: "1px dashed",
        borderColor: "border.default",
        borderRadius: 1,
        bgcolor: "background.subtle",
      }}
    />
  );
}

// ─── Canvas ─────────────────────────────────────────────────────────────────

export function DashboardGridCanvas({
  widgets,
  registry,
  configOptions,
  cols,
  maxRows,
  initialRows,
  context,
  onLayoutChange,
}: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Layout projetado (com push) enquanto arrasta uma instância — reflow ao vivo.
  const [preview, setPreview] = useState<StoredWidget[] | null>(null);
  // Indicador de drop zone durante o arrasto da paleta.
  const [paletteDrop, setPaletteDrop] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
    valid: boolean;
  } | null>(null);
  const [dropError, setDropError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resizePreview, setResizePreview] = useState<StoredWidget[] | null>(null);
  // @dnd-kit gera ids de acessibilidade que divergem entre SSR e cliente →
  // só habilitamos o DnD após montar, evitando hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const defById = useMemo(() => new Map(registry.map((d) => [d.id, d])), [registry]);
  const activeWidgetIds = useMemo(() => new Set(widgets.map((w) => w.widgetId)), [widgets]);

  const isPaletteDrag = activeId?.startsWith(PALETTE_DRAG_PREFIX) ?? false;
  const dragging = activeId !== null;

  const resizeRef = useRef<ResizeSession | null>(null);

  const displayWidgets =
    resizePreview ?? (dragging && !isPaletteDrag && preview ? preview : widgets);

  const usedRows = displayWidgets.reduce((max, w) => Math.max(max, w.y + w.h), 0);
  const dropRows = paletteDrop ? paletteDrop.y + paletteDrop.h : 0;
  const rows = clamp(Math.max(initialRows, usedRows, dropRows), 1, maxRows);

  // Projeta o layout (posição de destino + push) a partir do deslocamento do drag.
  function projectLayout(id: string, delta: { x: number; y: number }): StoredWidget[] | null {
    const widget = widgets.find((w) => w.instanceId === id);
    const container = containerRef.current;
    if (!widget || !container) return null;
    const cellWidth = (container.clientWidth - (cols - 1) * GAP_PX) / cols;
    const rowHeight = ROW_HEIGHT + GAP_PX;
    const dxCells = cellWidth > 0 ? Math.round(delta.x / cellWidth) : 0;
    const dyCells = Math.round(delta.y / rowHeight);
    const tx = clamp(widget.x + dxCells, 0, cols - widget.w);
    const ty = Math.max(0, widget.y + dyCells);
    return applyMoveWithPush(widgets, id, tx, ty, maxRows);
  }

  // ─── Drag handlers ──────────────────────────────────────────────────────

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
    setPreview(null);
    setPaletteDrop(null);
    setDropError(false);
  }

  function handleDragMove(event: DragMoveEvent) {
    const id = String(event.active.id);
    if (id.startsWith(PALETTE_DRAG_PREFIX)) {
      const widgetId = id.slice(PALETTE_DRAG_PREFIX.length);
      const variant = defById.get(widgetId)?.sizeVariants[0];
      const cell = parseCellId(event.over?.id ?? null);
      if (!variant || !cell) {
        setPaletteDrop(null);
        return;
      }
      const x = clamp(cell.x, 0, cols - variant.w);
      const candidate: StoredWidget = {
        instanceId: "drop-preview",
        widgetId,
        visible: true,
        x,
        y: cell.y,
        w: variant.w,
        h: variant.h,
        sizeVariantId: variant.id,
      };
      const valid = insertWithPush(widgets, candidate, maxRows) !== null;
      setPaletteDrop({ x, y: cell.y, w: variant.w, h: variant.h, valid });
      return;
    }
    // Reposicionamento de instância existente
    const next = projectLayout(id, event.delta);
    if (next) {
      setPreview(next);
      setDropError(false);
    } else {
      // Destino inválido (ultrapassa maxRows): mantém o último preview válido.
      setDropError(true);
    }
  }

  function resetDrag() {
    setActiveId(null);
    setPreview(null);
    setPaletteDrop(null);
  }

  // Feedback de operação inviável: borda vermelha + snackbar explicando o motivo.
  function flashError(message: string) {
    setDropError(true);
    setTimeout(() => setDropError(false), 600);
    enqueueSnackbar(message, { variant: "warning" });
  }

  function handleDragEnd(event: DragEndEvent) {
    const id = String(event.active.id);

    if (id.startsWith(PALETTE_DRAG_PREFIX)) {
      const widgetId = id.slice(PALETTE_DRAG_PREFIX.length);
      const variant = defById.get(widgetId)?.sizeVariants[0];
      if (!variant) return resetDrag();

      const instanceId = newInstanceId();
      const make = (x: number, y: number): StoredWidget => ({
        instanceId,
        widgetId,
        visible: true,
        x,
        y,
        w: variant.w,
        h: variant.h,
        sizeVariantId: variant.id,
      });

      const cell = parseCellId(event.over?.id ?? null);
      let next: StoredWidget[] | null = null;
      if (cell) {
        next = insertWithPush(widgets, make(clamp(cell.x, 0, cols - variant.w), cell.y), maxRows);
      }
      // Sem célula de destino (ou drop inválido): cai na próxima célula livre.
      if (!next) {
        const free = findFreeCell(widgets, variant.w, variant.h, cols, maxRows);
        if (free) next = insertWithPush(widgets, make(free.x, free.y), maxRows);
      }

      if (next) {
        onLayoutChange(next, { immediate: true });
        setSelectedId(instanceId);
        resetDrag();
      } else {
        resetDrag();
        flashError(m.settings.dashboards.gridFull);
      }
      return;
    }

    // Reposicionamento de instância existente
    if (!dropError && preview && !layoutsEqual(preview, widgets)) {
      onLayoutChange(preview);
      resetDrag();
      setDropError(false);
    } else if (dropError) {
      resetDrag();
      setTimeout(() => setDropError(false), 600);
    } else {
      resetDrag();
      setDropError(false);
    }
  }

  function handleToggleVisible(id: string) {
    onLayoutChange(widgets.map((w) => (w.instanceId === id ? { ...w, visible: !w.visible } : w)));
  }

  // ─── Ações do painel lateral (duplicar / remover / variante) ─────────────

  function handleDuplicate() {
    const inst = widgets.find((w) => w.instanceId === selectedId);
    if (!inst) return;
    const free = findFreeCell(widgets, inst.w, inst.h, cols, maxRows);
    if (!free) {
      flashError(m.settings.dashboards.gridFull);
      return;
    }
    const clone: StoredWidget = { ...inst, instanceId: newInstanceId(), x: free.x, y: free.y };
    onLayoutChange([...widgets, clone], { immediate: true });
    setSelectedId(clone.instanceId);
  }

  function handleRemove() {
    const id = selectedId;
    if (!id) return;
    onLayoutChange(
      widgets.filter((w) => w.instanceId !== id),
      { immediate: true },
    );
    setSelectedId(null);
  }

  function handleSelectVariant(variantId: string) {
    if (!selectedId) return;
    const inst = widgets.find((w) => w.instanceId === selectedId);
    const variant = inst
      ? defById.get(inst.widgetId)?.sizeVariants.find((v) => v.id === variantId)
      : undefined;
    if (!inst || !variant) return;
    const next = applyResizeWithPush(
      widgets,
      selectedId,
      variant.w,
      variant.h,
      variant.id,
      cols,
      maxRows,
    );
    if (next) onLayoutChange(next);
    else flashError(m.settings.dashboards.sizeNoRoom);
  }

  // Config interna (configSchema) — salva na hora (ação deliberada do form).
  function handleSaveConfig(config: unknown) {
    if (!selectedId) return;
    onLayoutChange(
      widgets.map((w) => (w.instanceId === selectedId ? { ...w, config } : w)),
      { immediate: true },
    );
  }

  // ─── Resize por alça (pointer capture; snap para variante mais próxima) ──

  function beginResize(instanceId: string, clientX: number, clientY: number) {
    const inst = widgets.find((w) => w.instanceId === instanceId);
    const def = inst ? defById.get(inst.widgetId) : undefined;
    if (!inst || !def) return;
    resizeRef.current = {
      instanceId,
      startX: clientX,
      startY: clientY,
      startW: inst.w,
      startH: inst.h,
      def,
      resultLayout: null,
    };
    setSelectedId(instanceId);
  }

  function moveResize(clientX: number, clientY: number) {
    const session = resizeRef.current;
    const c = containerRef.current;
    if (!session || !c) return;
    const cellWidth = (c.clientWidth - (cols - 1) * GAP_PX) / cols;
    const rowHeight = ROW_HEIGHT + GAP_PX;
    const dxCells = cellWidth > 0 ? Math.round((clientX - session.startX) / cellWidth) : 0;
    const dyCells = Math.round((clientY - session.startY) / rowHeight);
    const dragW = clamp(session.startW + dxCells, 1, cols);
    const dragH = clamp(session.startH + dyCells, 1, maxRows);
    const variant = snapToNearestVariant(dragW, dragH, session.def.sizeVariants);
    const layout = applyResizeWithPush(
      widgets,
      session.instanceId,
      variant.w,
      variant.h,
      variant.id,
      cols,
      maxRows,
    );
    if (layout) {
      session.resultLayout = layout;
      setResizePreview(layout);
    }
  }

  function endResize() {
    const session = resizeRef.current;
    resizeRef.current = null;
    setResizePreview(null);
    if (session?.resultLayout && !layoutsEqual(session.resultLayout, widgets)) {
      onLayoutChange(session.resultLayout);
    }
  }

  const activeWidget =
    activeId && !isPaletteDrag ? widgets.find((w) => w.instanceId === activeId) : null;

  const selectedWidget = selectedId ? widgets.find((w) => w.instanceId === selectedId) : null;
  const selectedDef = selectedWidget ? defById.get(selectedWidget.widgetId) : undefined;

  // Conteúdo do DragOverlay (instância existente ou preview da paleta).
  let overlay: React.ReactNode = null;
  if (activeWidget) {
    overlay = <WidgetCardBody widget={activeWidget} context={context} elevated />;
  } else if (isPaletteDrag && activeId) {
    const widgetId = activeId.slice(PALETTE_DRAG_PREFIX.length);
    const variant = defById.get(widgetId)?.sizeVariants[0];
    if (variant) {
      const synth: StoredWidget = {
        instanceId: "overlay",
        widgetId,
        visible: true,
        x: 0,
        y: 0,
        w: variant.w,
        h: variant.h,
        sizeVariantId: variant.id,
      };
      overlay = (
        <Box sx={{ width: 240 }}>
          <WidgetCardBody widget={synth} context={context} elevated />
        </Box>
      );
    }
  }

  const gridInner = (
    <Box
      ref={containerRef}
      sx={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, ${ROW_HEIGHT}px)`,
        gap: 2,
        p: 1.5,
        borderRadius: 1.5,
        border: 1,
        borderColor: dropError ? "danger.main" : "border.subtle",
        bgcolor: "background.canvas",
        transition: "border-color 200ms",
      }}
    >
      {/* Células-guia (droppable após montar, para o drop da paleta) */}
      {Array.from({ length: rows * cols }).map((_, i) => (
        <GuideCell key={`guide-${i}`} x={i % cols} y={Math.floor(i / cols)} droppable={mounted} />
      ))}

      {/* Indicador de drop zone durante o arrasto da paleta */}
      {isPaletteDrag && paletteDrop && (
        <Box
          sx={{
            gridColumn: `${paletteDrop.x + 1} / span ${paletteDrop.w}`,
            gridRow: `${paletteDrop.y + 1} / span ${paletteDrop.h}`,
            border: "2px dashed",
            borderColor: paletteDrop.valid ? "primary.main" : "danger.main",
            borderRadius: 1,
            bgcolor: paletteDrop.valid ? "action.hover" : "danger.subtle",
            zIndex: 2,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Widgets posicionados */}
      {displayWidgets.map((w) =>
        mounted ? (
          <DraggableWidget
            key={w.instanceId}
            widget={w}
            context={context}
            dragging={dragging}
            isActive={activeId === w.instanceId}
            selected={selectedId === w.instanceId}
            showResize={!dragging}
            onToggleVisible={() => handleToggleVisible(w.instanceId)}
            onSelect={() => setSelectedId(w.instanceId)}
            onResizeStart={(x, y) => beginResize(w.instanceId, x, y)}
            onResizeMove={moveResize}
            onResizeEnd={endResize}
          />
        ) : (
          <Box
            key={w.instanceId}
            sx={{
              gridColumn: `${w.x + 1} / span ${w.w}`,
              gridRow: `${w.y + 1} / span ${w.h}`,
              minWidth: 0,
              minHeight: 0,
              overflow: "hidden",
            }}
          >
            <WidgetCardBody widget={w} context={context} />
          </Box>
        ),
      )}
    </Box>
  );

  const sidebar =
    selectedWidget && selectedDef ? (
      <WidgetSettingsPanel
        context={context}
        widget={selectedWidget}
        def={selectedDef}
        configOptions={configOptions}
        onSelectVariant={handleSelectVariant}
        onSaveConfig={handleSaveConfig}
        onDuplicate={handleDuplicate}
        onRemove={handleRemove}
        onClose={() => setSelectedId(null)}
      />
    ) : (
      <WidgetPalette
        context={context}
        registry={registry}
        activeWidgetIds={activeWidgetIds}
        interactive={mounted}
      />
    );

  const content = (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column-reverse", md: "row" },
        gap: 2,
        alignItems: "flex-start",
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0, width: "100%" }}>{gridInner}</Box>
      <Box sx={{ width: { xs: "100%", md: 260 }, flexShrink: 0 }}>{sidebar}</Box>
    </Box>
  );

  // Pré-montagem (SSR/primeiro paint): layout estático, sem DnD → sem hydration mismatch.
  if (!mounted) return content;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={resetDrag}
    >
      {content}
      <DragOverlay>{overlay}</DragOverlay>
    </DndContext>
  );
}
