"use client";

import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import { WIDGET_ICONS } from "@/components/dashboards/_core/widget-icons";
import type { DashboardContext } from "@/components/dashboards/_core/widget-registry";
import { WIDGET_TYPE } from "@/components/dashboards/_core/widget-types";
import { motion, typography } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import type { StoredWidget } from "@/lib/schemas/dashboard-layout";

import { widgetDescription, widgetLabel } from "./widget-display";

const T_FAST = `${motion.duration.fast}ms ${motion.easing.standard}`;

// Card visual compartilhado pelo canvas (instâncias na grade) e pela paleta
// (widgets disponíveis). Sem alça de drag — o arrasto fica no Box que o envolve.
export function WidgetCardBody({
  widget,
  context,
  onToggleVisible,
  selected = false,
  ghost = false,
  hoverable = false,
  elevated = false,
}: {
  widget: StoredWidget;
  context: DashboardContext;
  onToggleVisible?: () => void;
  selected?: boolean;
  /** Placeholder na posição de destino durante o drag. */
  ghost?: boolean;
  /** Realça (borda + leve crescida) no hover. */
  hoverable?: boolean;
  /** Sombra para o card flutuante (DragOverlay). */
  elevated?: boolean;
}) {
  const Icon = WIDGET_ICONS[widget.widgetId];
  const label = widgetLabel(context, widget.widgetId);
  const description = widgetDescription(context, widget.widgetId);
  const typeKey = WIDGET_TYPE[widget.widgetId] ?? "panel";
  const hidden = !widget.visible;

  // Cards de 1 linha (KPIs, variantes compactas) não têm espaço vertical para a
  // descrição inline — ela vai para o tooltip do rótulo. Mesmo padding dos demais.
  const compact = widget.h <= 1;
  const showDescription = !compact && Boolean(description);
  const labelTooltip = !showDescription && description ? description : "";

  const borderColor = ghost || selected ? "primary.main" : "border.default";

  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 0,
        px: 1.5,
        py: 1,
        overflow: "hidden",
        borderColor,
        borderStyle: ghost ? "dashed" : "solid",
        borderWidth: selected && !ghost ? 2 : 1,
        bgcolor: ghost ? "action.hover" : "background.surface",
        opacity: ghost ? 0.6 : hidden ? 0.35 : 1,
        boxShadow: elevated ? 6 : 0,
        userSelect: "none",
        // Tokens de motion no lugar dos 120ms mágicos.
        transition: `transform ${T_FAST}, border-color ${T_FAST}, box-shadow ${T_FAST}`,
        ...(hoverable && {
          "&:hover": {
            borderColor: "primary.main",
            transform: "scale(1.02)",
            boxShadow: 2,
          },
        }),
      }}
    >
      {/* Linha 1: ícone + rótulo + ações (ocultar + menu, agrupadas) */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
        {Icon && <Icon sx={{ fontSize: 14, color: "text.secondary", flexShrink: 0 }} />}
        <Tooltip title={labelTooltip} placement="top">
          <Typography
            variant="caption"
            sx={{
              flex: 1,
              minWidth: 0,
              fontWeight: 500,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </Typography>
        </Tooltip>
        {onToggleVisible && !ghost && (
          <Tooltip
            title={hidden ? m.settings.dashboards.showWidget : m.settings.dashboards.hideWidget}
          >
            <IconButton
              size="small"
              aria-label={
                hidden ? m.settings.dashboards.showWidget : m.settings.dashboards.hideWidget
              }
              // Não inicia o drag do card ao interagir com o botão.
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onToggleVisible();
              }}
              sx={{ flexShrink: 0, color: hidden ? "warning.main" : "text.tertiary" }}
            >
              {hidden ? (
                <VisibilityOffIcon sx={{ fontSize: 14 }} />
              ) : (
                <VisibilityIcon sx={{ fontSize: 14 }} />
              )}
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Linha 2: descrição (oculta em cards de 1 linha — vai para o tooltip) */}
      {showDescription && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            minWidth: 0,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            lineHeight: 1.3,
            fontSize: "0.75rem",
          }}
        >
          {description}
        </Typography>
      )}

      {/* Linha 3: pill de tipo + tamanho */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexShrink: 0 }}>
        <Box
          component="span"
          sx={{
            fontSize: "0.6rem",
            lineHeight: 1.6,
            px: 0.75,
            borderRadius: 0.5,
            bgcolor: "action.selected",
            color: "text.secondary",
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {m.settings.dashboards.widgetTypes[typeKey]}
        </Box>
        {/* Chip de tamanho (frame 07): metadado, não título — borda fina, tom
            terciário, mono. Nunca `text.disabled`: em 10px mede ~2,1:1 (§15). */}
        <Box
          component="span"
          sx={{
            fontFamily: typography.fontFamily.mono,
            fontSize: "0.6rem",
            lineHeight: 1.6,
            px: 0.5,
            // String em px: `borderRadius` numérico é multiplicado por 8 (§15).
            borderRadius: "4px",
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: selected ? "accent.primary" : "border.default",
            color: selected ? "accent.primary" : "text.tertiary",
            bgcolor: selected ? "accent.primarySubtle" : "transparent",
          }}
        >
          {m.settings.presentation.dashboards.sizeChip(widget.w, widget.h)}
        </Box>
      </Box>
    </Card>
  );
}
