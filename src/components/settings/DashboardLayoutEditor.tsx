"use client";

import type { ComponentType } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import type { SvgIconProps } from "@mui/material/SvgIcon";

import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { updateDashboardLayoutAction } from "@/actions/dashboard-layout";
import { m } from "@/lib/messages";
import { layout } from "@/lib/design-tokens";
import { WidgetCard } from "@/components/settings/WidgetCard";
import { WIDGET_ICONS } from "@/components/settings/widget-icons";
import {
  buildSegments,
  resolveLayout,
  type DashboardContext,
  type WidgetDef,
} from "@/components/dashboards/widget-registry";

const DEBOUNCE_REORDER_MS = 600;

type WidgetMeta = { label: string; description: string };

type Props = {
  accountId: string;
  context: DashboardContext;
  initialActive: WidgetDef[];
  initialAvailable: WidgetDef[];
  widgetMeta: Record<string, WidgetMeta>;
};

function SortableCanvasCard({
  widget,
  meta,
  onRemove,
}: {
  widget: WidgetDef;
  meta: WidgetMeta;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.id,
  });
  const icon = WIDGET_ICONS[widget.id] as ComponentType<SvgIconProps> | undefined;

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <WidgetCard
        mode="active"
        widget={widget}
        label={meta.label}
        description={meta.description}
        icon={icon}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
        onRemove={onRemove}
      />
    </div>
  );
}

export function DashboardLayoutEditor({
  accountId,
  context,
  initialActive,
  initialAvailable,
  widgetMeta,
}: Props) {
  const [active, setActive] = useState<WidgetDef[]>(initialActive);
  const [available, setAvailable] = useState<WidgetDef[]>(initialAvailable);
  const [snackbar, setSnackbar] = useState<{ open: boolean; error?: boolean }>({ open: false });
  const [dragActiveId, setDragActiveId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dragWidget = dragActiveId ? active.find((w) => w.id === dragActiveId) : null;

  const saveLayout = useCallback(
    async (widgetIds: string[]) => {
      const result = await updateDashboardLayoutAction(accountId, {
        accountId,
        context,
        widgets: widgetIds,
      });
      if (!result.ok) {
        setSnackbar({ open: true, error: true });
      } else {
        setSnackbar({ open: true, error: false });
      }
    },
    [accountId, context],
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setDragActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setDragActiveId(null);
      const { active: dragActive, over } = event;
      if (!over || dragActive.id === over.id) return;

      const oldIndex = active.findIndex((w) => w.id === dragActive.id);
      const newIndex = active.findIndex((w) => w.id === over.id);
      const reordered = arrayMove(active, oldIndex, newIndex);
      setActive(reordered);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void saveLayout(reordered.map((w) => w.id));
      }, DEBOUNCE_REORDER_MS);
    },
    [active, saveLayout],
  );

  const handleDragCancel = useCallback(() => {
    setDragActiveId(null);
  }, []);

  const handleRemove = useCallback(
    (widget: WidgetDef) => {
      const newActive = active.filter((w) => w.id !== widget.id);
      setActive(newActive);
      setAvailable((prev) => [...prev, widget]);
      void saveLayout(newActive.map((w) => w.id));
    },
    [active, saveLayout],
  );

  const handleAdd = useCallback(
    (widget: WidgetDef) => {
      const newActive = [...active, widget];
      setActive(newActive);
      setAvailable((prev) => prev.filter((w) => w.id !== widget.id));
      void saveLayout(newActive.map((w) => w.id));
    },
    [active, saveLayout],
  );

  const handleAddAll = useCallback(() => {
    const newActive = [...active, ...available];
    setActive(newActive);
    setAvailable([]);
    void saveLayout(newActive.map((w) => w.id));
  }, [active, available, saveLayout]);

  const handleResetToDefault = useCallback(() => {
    const defaultLayout = resolveLayout(context, null);
    setActive(defaultLayout.active);
    setAvailable(defaultLayout.available);
    void saveLayout(defaultLayout.active.map((w) => w.id));
  }, [context, saveLayout]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const availableKpis = available.filter((w) => w.kind === "kpi");
  const availablePanels = available.filter((w) => w.kind === "panel");

  const segments = buildSegments(active);

  return (
    <Box>
      {/* ── Canvas ativo ── */}
      <Box sx={{ mb: layout.cluster }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: layout.stack }}>
          <Typography variant="subtitle2" color="text.secondary">
            {m.settings.dashboards.activeWidgets}
          </Typography>
          <Button
            size="small"
            variant="text"
            startIcon={<RestartAltIcon fontSize="small" />}
            onClick={handleResetToDefault}
            sx={{ color: "text.secondary", fontSize: "0.75rem" }}
          >
            {m.settings.dashboards.resetToDefault}
          </Button>
        </Box>

        {active.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            {m.settings.dashboards.noActiveWidgets}
          </Typography>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext items={active.map((w) => w.id)} strategy={verticalListSortingStrategy}>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                {segments.map((seg, idx) => {
                  if (seg.type === "kpis") {
                    return (
                      <Box
                        key={`kpis-${idx}`}
                        sx={{
                          display: "grid",
                          gridTemplateColumns: {
                            xs: "1fr 1fr",
                            sm: `repeat(${Math.min(seg.widgets.length, 3)}, 1fr)`,
                          },
                          gap: 1,
                        }}
                      >
                        {seg.widgets.map((w) => (
                          <SortableCanvasCard
                            key={w.id}
                            widget={w}
                            meta={widgetMeta[w.id] ?? { label: w.id, description: "" }}
                            onRemove={() => handleRemove(w)}
                          />
                        ))}
                      </Box>
                    );
                  }

                  if (seg.type === "halves") {
                    return (
                      <Box
                        key={`halves-${idx}`}
                        sx={{
                          display: "grid",
                          gridTemplateColumns: {
                            xs: "1fr",
                            md: seg.widgets.length === 2 ? "1fr 1fr" : "1fr",
                          },
                          gap: 1,
                        }}
                      >
                        {seg.widgets.map((w) => (
                          <SortableCanvasCard
                            key={w.id}
                            widget={w}
                            meta={widgetMeta[w.id] ?? { label: w.id, description: "" }}
                            onRemove={() => handleRemove(w)}
                          />
                        ))}
                      </Box>
                    );
                  }

                  // full
                  return (
                    <SortableCanvasCard
                      key={seg.widget.id}
                      widget={seg.widget}
                      meta={widgetMeta[seg.widget.id] ?? { label: seg.widget.id, description: "" }}
                      onRemove={() => handleRemove(seg.widget)}
                    />
                  );
                })}
              </Box>
            </SortableContext>

            <DragOverlay adjustScale={false} dropAnimation={null}>
              {dragWidget ? (
                <WidgetCard
                  mode="active"
                  widget={dragWidget}
                  label={widgetMeta[dragWidget.id]?.label ?? dragWidget.id}
                  description={widgetMeta[dragWidget.id]?.description}
                  icon={WIDGET_ICONS[dragWidget.id] as ComponentType<SvgIconProps> | undefined}
                  isDragging={false}
                  dragHandleProps={{}}
                  onRemove={() => {}}
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </Box>

      {/* ── Tray de disponíveis ── */}
      {available.length > 0 && (
        <>
          <Divider sx={{ my: layout.stack }} />
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: layout.stack }}>
            <Typography variant="subtitle2" color="text.secondary">
              {m.settings.dashboards.availableWidgets}
            </Typography>
            <Button
              size="small"
              variant="text"
              startIcon={<PlaylistAddIcon fontSize="small" />}
              onClick={handleAddAll}
              sx={{ color: "text.secondary", fontSize: "0.75rem" }}
            >
              {m.settings.dashboards.addAll}
            </Button>
          </Box>

          {availableKpis.length > 0 && (
            <Box sx={{ mb: availablePanels.length > 0 ? layout.stack : 0 }}>
              <Typography
                variant="caption"
                color="text.disabled"
                sx={{
                  display: "block",
                  mb: 1,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  fontWeight: 600,
                  fontSize: "0.6rem",
                }}
              >
                {m.settings.dashboards.kpisGroup}
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                  gap: 1,
                }}
              >
                {availableKpis.map((widget) => (
                  <WidgetCard
                    key={widget.id}
                    mode="available"
                    widget={widget}
                    label={widgetMeta[widget.id]?.label ?? widget.id}
                    description={widgetMeta[widget.id]?.description}
                    icon={WIDGET_ICONS[widget.id] as ComponentType<SvgIconProps> | undefined}
                    onAdd={() => handleAdd(widget)}
                  />
                ))}
              </Box>
            </Box>
          )}

          {availablePanels.length > 0 && (
            <Box>
              <Typography
                variant="caption"
                color="text.disabled"
                sx={{
                  display: "block",
                  mb: 1,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  fontWeight: 600,
                  fontSize: "0.6rem",
                }}
              >
                {m.settings.dashboards.panelsGroup}
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {availablePanels.map((widget) => (
                  <WidgetCard
                    key={widget.id}
                    mode="available"
                    widget={widget}
                    label={widgetMeta[widget.id]?.label ?? widget.id}
                    description={widgetMeta[widget.id]?.description}
                    icon={WIDGET_ICONS[widget.id] as ComponentType<SvgIconProps> | undefined}
                    onAdd={() => handleAdd(widget)}
                  />
                ))}
              </Box>
            </Box>
          )}
        </>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={2500}
        onClose={() => setSnackbar({ open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snackbar.error ? "error" : "success"}
          variant="filled"
          onClose={() => setSnackbar({ open: false })}
          sx={{ width: "100%" }}
        >
          {snackbar.error ? m.settings.dashboards.saveError : m.settings.dashboards.saved}
        </Alert>
      </Snackbar>
    </Box>
  );
}
