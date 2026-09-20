"use client";

import { useDraggable } from "@dnd-kit/core";
import CloseIcon from "@mui/icons-material/Close";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Slide from "@mui/material/Slide";
import Typography from "@mui/material/Typography";
import { useEffect } from "react";

import { WIDGET_ICONS } from "@/components/dashboards/_core/widget-icons";
import type {
  DashboardContext,
  WidgetDef,
  WidgetGroup,
} from "@/components/dashboards/_core/widget-registry";
import { m } from "@/lib/messages";

import { SettingsFieldLabel } from "./SettingsFieldLabel";
import { sizeSummary, vizSummary } from "./viz-display";
import { widgetLabel } from "./widget-display";

// Prefixo do id de arrasto da paleta — o canvas distingue add (paleta) de
// reposicionamento (instância existente) pelo prefixo do active.id.
export const PALETTE_DRAG_PREFIX = "palette:";

/** Largura da gaveta (07c). No mobile ocupa a tela toda. */
const DRAWER_WIDTH = 360;

type Props = {
  context: DashboardContext;
  registry: WidgetDef[];
  /** widgetIds já presentes no layout — singletons aparecem esmaecidos (07c). */
  activeWidgetIds: Set<string>;
  /** Habilita o arrasto (somente após montar — evita hydration mismatch do @dnd-kit). */
  interactive: boolean;
  open: boolean;
  onClose: () => void;
  /** Clique no card: insere no primeiro espaço livre. */
  onInsert: (widgetId: string) => void;
};

const GROUP_ORDER: WidgetGroup[] = ["month", "overTime", "operational"];

const GROUP_LABEL: Record<WidgetGroup, string> = {
  month: m.settings.presentation.dashboards.palette.groupMonth,
  overTime: m.settings.presentation.dashboards.palette.groupOverTime,
  operational: m.settings.presentation.dashboards.palette.groupOperational,
};

function PaletteCard({
  context,
  def,
  disabled,
  draggable,
  onInsert,
}: {
  context: DashboardContext;
  def: WidgetDef;
  /** Já está no layout: some do alcance, mas continua visível e explicado (07c). */
  disabled: boolean;
  draggable: boolean;
  onInsert: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${PALETTE_DRAG_PREFIX}${def.id}`,
    disabled: disabled || !draggable,
  });
  const Icon = WIDGET_ICONS[def.id];
  const label = widgetLabel(context, def.id);
  const supports = disabled
    ? m.settings.presentation.dashboards.palette.alreadyInLayout
    : m.settings.presentation.dashboards.palette.supports(vizSummary(def), sizeSummary(def));

  return (
    <Paper
      ref={setNodeRef}
      {...(disabled ? {} : attributes)}
      {...(disabled ? {} : listeners)}
      variant="outlined"
      component={disabled ? "div" : "button"}
      type={disabled ? undefined : "button"}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onInsert}
      sx={{
        display: "flex",
        alignItems: "flex-start",
        textAlign: "left",
        gap: 1,
        px: 1.5,
        py: 1.25,
        width: "100%",
        // `Paper component="button"`: zera os defaults do agente de usuário para
        // o card ficar idêntico ao da versão em <div>.
        appearance: "none",
        font: "inherit",
        bgcolor: "background.surface",
        opacity: disabled ? 0.55 : isDragging ? 0.4 : 1,
        cursor: disabled ? "default" : "grab",
        touchAction: "none",
        outline: "none",
        transition: "border-color 120ms, box-shadow 120ms",
        ...(!disabled && {
          "&:hover": { borderColor: "primary.main" },
          "&:focus-visible": { borderColor: "primary.main", boxShadow: 2 },
          "&:active": { cursor: "grabbing" },
        }),
      }}
    >
      {Icon && (
        <Icon
          sx={{
            fontSize: 17,
            flexShrink: 0,
            mt: "1px",
            color: disabled ? "text.tertiary" : "accent.primary",
          }}
        />
      )}
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="caption"
          sx={{ display: "block", fontWeight: 500, lineHeight: 1.3, color: "text.primary" }}
        >
          {label}
        </Typography>
        <Typography
          variant="caption"
          sx={{ display: "block", lineHeight: 1.3, fontSize: "0.68rem", color: "text.tertiary" }}
        >
          {supports}
        </Typography>
      </Box>
    </Paper>
  );
}

/**
 * Spec 69 §2.3 (tela 07c) — paleta como gaveta lateral, agrupada.
 *
 * NÃO usa `Drawer`/`Modal` do MUI de propósito: o Modal cobre a página com um
 * container próprio e prende o foco, e o arraste da paleta PARA o grid (que já
 * funciona desde a Spec 36) tem de continuar funcionando com o grid acessível
 * atrás. Um `Paper` fixo dentro do mesmo `DndContext` dá a mesma leitura visual
 * sem tocar no DnD.
 */
export function WidgetPalette({
  context,
  registry,
  activeWidgetIds,
  interactive,
  open,
  onClose,
  onInsert,
}: Props) {
  // Escape fecha a gaveta mesmo sem foco dentro dela — sem `Modal` não há
  // captura de teclado automática (ver comentário acima).
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // Singleton já no layout continua listado, esmaecido e com o motivo — antes
  // ele simplesmente sumia, e o usuário não entendia por quê (07c).
  const byGroup = GROUP_ORDER.map((group) => ({
    group,
    defs: registry.filter((def) => (def.group ?? "operational") === group),
  })).filter((g) => g.defs.length > 0);

  return (
    <Slide direction="left" in={open} mountOnEnter unmountOnExit>
      <Paper
        role="dialog"
        aria-label={m.settings.presentation.dashboards.palette.title}
        elevation={0}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
        sx={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: (theme) => theme.zIndex.drawer,
          width: { xs: "100%", sm: DRAWER_WIDTH },
          display: "flex",
          flexDirection: "column",
          borderRadius: 0,
          // Longhand: o shorthand `borderLeft` dentro de valor responsivo perde
          // a cor para currentColor (§15).
          borderLeftWidth: 1,
          borderLeftStyle: "solid",
          borderLeftColor: "border.default",
          bgcolor: "background.surface",
          boxShadow: 8,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            gap: 1,
            px: 2,
            py: 1.5,
            borderBottomWidth: 1,
            borderBottomStyle: "solid",
            borderBottomColor: "border.subtle",
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
              {m.settings.presentation.dashboards.palette.title}
            </Typography>
            <Typography
              variant="caption"
              sx={{ display: "block", lineHeight: 1.35, color: "text.secondary" }}
            >
              {m.settings.presentation.dashboards.palette.description}
            </Typography>
          </Box>
          <IconButton size="small" aria-label={m.common.close} onClick={onClose}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>

        <Box sx={{ flex: 1, overflowY: "auto", px: 2, py: 1.5 }}>
          {byGroup.map(({ group, defs }) => (
            <Box key={group} sx={{ mb: 2 }}>
              <SettingsFieldLabel>{GROUP_LABEL[group]}</SettingsFieldLabel>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                  gap: 1,
                }}
              >
                {defs.map((def) => (
                  <PaletteCard
                    key={def.id}
                    context={context}
                    def={def}
                    disabled={def.instantiable !== true && activeWidgetIds.has(def.id)}
                    draggable={interactive}
                    onInsert={() => onInsert(def.id)}
                  />
                ))}
              </Box>
            </Box>
          ))}
        </Box>
      </Paper>
    </Slide>
  );
}
