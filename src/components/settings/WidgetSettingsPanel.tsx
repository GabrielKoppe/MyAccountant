"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

import { m } from "@/lib/messages";
import { WIDGET_ICONS } from "@/components/dashboards/_core/widget-icons";
import type {
  DashboardContext,
  WidgetDef,
  WidgetSizeVariant,
} from "@/components/dashboards/_core/widget-registry";
import type { StoredWidget } from "@/lib/schemas/dashboard-layout";
import type { WidgetConfigOptions } from "@/lib/queries/widget-config-options";
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
  onSaveConfig: (config: unknown) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onClose: () => void;
};

const MINI_UNIT = 12; // px por célula na miniatura

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
        borderColor: selected ? "primary.main" : "border.default",
        bgcolor: selected ? "action.selected" : "background.surface",
        cursor: "pointer",
        outline: "none",
        transition: "border-color 120ms, background-color 120ms",
        "&:hover": { borderColor: "primary.main" },
        "&:focus-visible": { borderColor: "primary.main", boxShadow: 2 },
      }}
    >
      {/* Representação proporcional da pegada w×h na grade */}
      <Box
        sx={{
          width: variant.w * MINI_UNIT,
          height: variant.h * MINI_UNIT,
          borderRadius: 0.5,
          bgcolor: selected ? "primary.main" : "action.disabledBackground",
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

export function WidgetSettingsPanel({
  context,
  widget,
  def,
  configOptions,
  onSelectVariant,
  onSaveConfig,
  onDuplicate,
  onRemove,
  onClose,
}: Props) {
  const Icon = WIDGET_ICONS[def.id];
  const label = widgetLabel(context, def.id);

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
            {/* key por instanceId → reseta o form ao trocar de widget selecionado */}
            <WidgetConfigForm
              key={widget.instanceId}
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
