"use client";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BlockIcon from "@mui/icons-material/Block";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import RadioButtonCheckedIcon from "@mui/icons-material/RadioButtonChecked";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";

import { WIDGET_ICONS } from "@/components/dashboards/_core/widget-icons";
import type {
  DashboardContext,
  WidgetDef,
  WidgetSizeVariant,
} from "@/components/dashboards/_core/widget-registry";
import {
  currentVizKey,
  vizAvailabilityAt,
  type VizAvailability,
} from "@/components/dashboards/_core/widget-viz";
import { motion } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import type { StoredWidget } from "@/lib/schemas/dashboard-layout";
import type { WidgetConfigOptions } from "@/server/queries/widget-config-options";

import { vizLabel } from "./viz-display";
import { widgetLabel } from "./widget-display";
import { WidgetConfigForm } from "./WidgetConfigForm";

// Painel lateral único para as ações e configurações da instância selecionada.
// Substitui o menu de contexto (⋮) e o modal de config: tudo fica visível na
// lateral (tamanho + config + ações), sem sobreposição nem perda de contexto.
type Props = {
  context: DashboardContext;
  widget: StoredWidget;
  def: WidgetDef;
  configOptions: WidgetConfigOptions;
  onSelectVariant: (variantId: string) => void;
  /** Escolha de visualização (07b) — aplica a variante que a produz. */
  onSelectViz: (vizKey: string) => void;
  onSaveConfig: (config: unknown) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onClose: () => void;
};

const MINI_UNIT = 12; // px por célula na miniatura
const T_FAST = `${motion.duration.fast}ms ${motion.easing.standard}`;

function variantLabel(variant: WidgetSizeVariant): string {
  const labels = m.settings.dashboards.variants as Record<string, string>;
  return labels[variant.labelKey] ?? variant.labelKey;
}

function VariantThumbnail({
  variant,
  selected,
  onSelect,
}: {
  variant: WidgetSizeVariant;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 0.5,
        p: 1,
        borderRadius: 1,
        border: 1,
        // Vocabulário semântico do design system: `accent.primary` /
        // `accent.primarySubtle` no lugar de `primary.main` / `action.selected`.
        // `action.*` é o cinza calculado do MUI, sem variante dark documentada.
        borderColor: selected ? "accent.primary" : "border.default",
        bgcolor: selected ? "accent.primarySubtle" : "background.surface",
        cursor: "pointer",
        outline: "none",
        transition: `border-color ${T_FAST}, background-color ${T_FAST}`,
        "&:hover": { borderColor: "accent.primary" },
        "&:focus-visible": { borderColor: "accent.primary", boxShadow: 2 },
      }}
    >
      {/* Representação proporcional da pegada w×h na grade */}
      <Box
        sx={{
          width: variant.w * MINI_UNIT,
          height: variant.h * MINI_UNIT,
          borderRadius: 0.5,
          // Família `background` (token) no lugar de `action.disabledBackground`.
          // `muted` e não `subtle`: a pegada é um bloco CHEIO sobre
          // `background.surface` — com `subtle` (#F5F4F0 sobre #FFFFFF, 1,05:1)
          // ela some. `muted` é o degrau seguinte da mesma família.
          bgcolor: selected ? "accent.primary" : "background.muted",
          opacity: selected ? 0.85 : 1,
        }}
      />
      <Typography variant="caption" sx={{ fontWeight: selected ? 600 : 400 }}>
        {variantLabel(variant)}
      </Typography>
      <Typography variant="caption" color="text.tertiary" sx={{ fontSize: "0.65rem" }}>
        {variant.w}×{variant.h}
      </Typography>
    </Box>
  );
}

/**
 * Item de visualização (07b) com os três estados: aceita · aceita com dados
 * reduzidos · indisponível **com o motivo visível** — a opção inválida nunca
 * some da lista, senão o usuário não descobre por que ela não está lá (§7.3).
 */
function VizOption({
  availability,
  selected,
  onSelect,
}: {
  availability: VizAvailability;
  selected: boolean;
  onSelect: () => void;
}) {
  const { viz, state, reason } = availability;
  const disabled = state === "unavailable";
  const reasonText =
    reason?.kind === "needsColumns"
      ? m.settings.presentation.dashboards.viz.needsColumns(reason.cols)
      : reason?.kind === "onlyAtSize"
        ? m.settings.presentation.dashboards.viz.onlyAtSize(reason.size)
        : state === "reduced"
          ? m.settings.presentation.dashboards.viz.reducedData
          : null;

  return (
    <Box
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      onClick={disabled ? undefined : onSelect}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1,
        py: 0.75,
        borderRadius: 1,
        border: 1,
        borderColor: selected ? "accent.primary" : "border.default",
        bgcolor: selected ? "accent.primarySubtle" : "transparent",
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? "default" : "pointer",
        outline: "none",
        transition: `border-color ${T_FAST}, background-color ${T_FAST}`,
        ...(!disabled && {
          "&:hover": { borderColor: "accent.primary" },
          "&:focus-visible": { borderColor: "accent.primary", boxShadow: 2 },
        }),
      }}
    >
      {disabled ? (
        <BlockIcon sx={{ fontSize: 15, color: "text.tertiary", flexShrink: 0 }} />
      ) : selected ? (
        <RadioButtonCheckedIcon sx={{ fontSize: 15, color: "accent.primary", flexShrink: 0 }} />
      ) : (
        <RadioButtonUncheckedIcon sx={{ fontSize: 15, color: "text.tertiary", flexShrink: 0 }} />
      )}
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="caption"
          sx={{
            display: "block",
            lineHeight: 1.3,
            fontWeight: selected ? 600 : 400,
            color: disabled ? "text.tertiary" : "text.primary",
          }}
        >
          {vizLabel(viz)}
        </Typography>
        {reasonText && (
          <Typography
            variant="caption"
            sx={{ display: "block", fontSize: "0.65rem", lineHeight: 1.3, color: "text.tertiary" }}
          >
            {reasonText}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export function WidgetSettingsPanel({
  context,
  widget,
  def,
  configOptions,
  onSelectVariant,
  onSelectViz,
  onSaveConfig,
  onDuplicate,
  onRemove,
  onClose,
}: Props) {
  const Icon = WIDGET_ICONS[def.id];
  const label = widgetLabel(context, def.id);
  const vizOptions = vizAvailabilityAt(def, { w: widget.w, h: widget.h });
  const currentViz = currentVizKey(def, widget);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Box>
        {/* Título: "Configurações do widget" + voltar; o nome do widget é o contexto. */}
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <IconButton
            size="small"
            aria-label={m.settings.dashboards.backToPalette}
            onClick={onClose}
            sx={{ flexShrink: 0 }}
          >
            <ArrowBackIcon sx={{ fontSize: 18 }} />
          </IconButton>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
            {m.settings.dashboards.widgetSettingsTitle}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, pl: 0.5, mt: 1 }}>
          {Icon && <Icon sx={{ fontSize: 14, color: "text.tertiary", flexShrink: 0 }} />}
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              lineHeight: 1.3,
              fontSize: "0.79rem",
            }}
          >
            {label}
          </Typography>
        </Box>
      </Box>

      {/* Seção: tamanho */}
      <Box>
        <Typography
          variant="caption"
          sx={{ fontWeight: 500, display: "block", mb: 0.75, color: "text.secondary" }}
        >
          {m.settings.dashboards.sizeSection}
        </Typography>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
            gap: 1,
          }}
        >
          {def.sizeVariants.map((variant) => (
            <VariantThumbnail
              key={variant.id}
              variant={variant}
              selected={variant.id === widget.sizeVariantId}
              onSelect={() => onSelectVariant(variant.id)}
            />
          ))}
        </Box>
      </Box>

      {/* Seção: visualização (07b) — só quando há mais de uma opção real */}
      {vizOptions.length > 1 && (
        <Box>
          <Typography
            variant="caption"
            sx={{ fontWeight: 500, display: "block", mb: 0.75, color: "text.secondary" }}
          >
            {m.settings.presentation.dashboards.inspector.vizTitle}{" "}
            <Box component="span" sx={{ color: "text.tertiary", fontWeight: 400 }}>
              · {m.settings.presentation.dashboards.inspector.vizHint}
            </Box>
          </Typography>
          <Box role="radiogroup" sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
            {vizOptions.map((availability) => (
              <VizOption
                key={availability.viz.key}
                availability={availability}
                selected={availability.viz.key === currentViz}
                onSelect={() => onSelectViz(availability.viz.key)}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Seção: configuração (apenas widgets com configSchema) */}
      {def.configSchema && (
        <>
          <Divider />
          <Box>
            <Typography
              variant="caption"
              sx={{ fontWeight: 500, display: "block", mb: 0.75, color: "text.secondary" }}
            >
              {m.settings.dashboards.configSection}
            </Typography>
            {/*
              key por instanceId + visualização: reseta o form ao trocar de widget
              e também quando o seletor de Visualização grava `config.chartType`
              por fora — sem isso o form seguiria mostrando o tipo de gráfico antigo.
            */}
            <WidgetConfigForm
              key={`${widget.instanceId}:${currentViz ?? ""}`}
              context={context}
              def={def}
              widget={widget}
              options={configOptions}
              onSave={onSaveConfig}
            />
          </Box>
        </>
      )}

      <Divider />

      {/* Seção: ações */}
      <Box>
        <Typography
          variant="caption"
          sx={{ fontWeight: 500, display: "block", mb: 0.75, color: "text.secondary" }}
        >
          {m.settings.dashboards.actionsSection}
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {def.instantiable && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<ContentCopyIcon sx={{ fontSize: 14 }} />}
              onClick={onDuplicate}
              fullWidth
              sx={{ justifyContent: "flex-start", fontSize: "0.8rem", alignItems: "flex-start" }}
            >
              {m.settings.dashboards.duplicate}
            </Button>
          )}
          <Button
            variant="outlined"
            size="small"
            color="error"
            startIcon={<DeleteOutlineIcon sx={{ fontSize: 14 }} />}
            onClick={onRemove}
            fullWidth
            sx={{
              justifyContent: "flex-start",
              fontSize: "0.8rem",
              alignItems: "flex-start",
              color: "error.main",
              borderColor: "error.main",
            }}
          >
            {m.settings.dashboards.remove}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
