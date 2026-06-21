"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useDraggable } from "@dnd-kit/core";

import { m } from "@/lib/messages";
import type { DashboardContext, WidgetDef } from "@/components/dashboards/_core/widget-registry";
import type { StoredWidget } from "@/lib/schemas/dashboard-layout";
import { WidgetCardBody } from "./WidgetCardBody";

// Prefixo do id de arrasto da paleta — o canvas distingue add (paleta) de
// reposicionamento (instância existente) pelo prefixo do active.id.
export const PALETTE_DRAG_PREFIX = "palette:";

type Props = {
  context: DashboardContext;
  registry: WidgetDef[];
  /** widgetIds já presentes no layout — usados para esconder singletons já instanciados. */
  activeWidgetIds: Set<string>;
  /** Habilita o arrasto (somente após montar — evita hydration mismatch do @dnd-kit). */
  interactive: boolean;
};

// StoredWidget sintético com a variante default — para reusar o mesmo card do grid.
function toStoredWidget(def: WidgetDef): StoredWidget {
  const variant = def.sizeVariants[0];
  return {
    instanceId: def.id,
    widgetId: def.id,
    visible: true,
    x: 0,
    y: 0,
    w: variant.w,
    h: variant.h,
    sizeVariantId: variant.id,
  };
}

function DraggablePaletteItem({ context, def }: { context: DashboardContext; def: WidgetDef }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${PALETTE_DRAG_PREFIX}${def.id}`,
  });

  return (
    <Box
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      sx={{
        cursor: "grab",
        touchAction: "none",
        outline: "none",
        opacity: isDragging ? 0.4 : 1,
        "&:active": { cursor: "grabbing" },
      }}
    >
      <WidgetCardBody widget={toStoredWidget(def)} context={context} hoverable />
    </Box>
  );
}

export function WidgetPalette({ context, registry, activeWidgetIds, interactive }: Props) {
  const available = registry.filter((def) =>
    def.instantiable ? true : !activeWidgetIds.has(def.id),
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
          {m.settings.dashboards.paletteTitle}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", lineHeight: 1.3 }}
        >
          {m.settings.dashboards.paletteHint}
        </Typography>
      </Box>

      {available.length === 0 ? (
        <Typography variant="caption" color="text.tertiary">
          {m.settings.dashboards.paletteEmpty}
        </Typography>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {available.map((def) =>
            interactive ? (
              <DraggablePaletteItem key={def.id} context={context} def={def} />
            ) : (
              <Box key={def.id}>
                <WidgetCardBody widget={toStoredWidget(def)} context={context} />
              </Box>
            ),
          )}
        </Box>
      )}
    </Box>
  );
}
