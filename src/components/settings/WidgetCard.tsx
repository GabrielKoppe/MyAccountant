"use client";

import type { ComponentType } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import type { SvgIconProps } from "@mui/material/SvgIcon";

import { m } from "@/lib/messages";
import type { WidgetDef } from "@/components/dashboards/widget-registry";
import { layout } from "@/lib/design-tokens";

type CommonProps = {
  widget: WidgetDef;
  label: string;
  description?: string;
  icon?: ComponentType<SvgIconProps>;
};

type ActiveProps = CommonProps & {
  mode: "active";
  dragHandleProps?: Record<string, unknown>;
  isDragging?: boolean;
  onRemove: () => void;
};

type AvailableProps = CommonProps & {
  mode: "available";
  onAdd: () => void;
};

type Props = ActiveProps | AvailableProps;

function TypeBadge({
  kind,
  span,
  sx,
}: {
  kind: WidgetDef["kind"];
  span?: WidgetDef["span"];
  sx?: Record<string, unknown>;
}) {
  let label: string;
  let isKpi: boolean;

  if (kind === "kpi") {
    label = m.settings.dashboards.widgetTypeKpi;
    isKpi = true;
  } else if (span === "half") {
    label = m.settings.dashboards.widgetTypePanelHalf;
    isKpi = false;
  } else {
    label = m.settings.dashboards.widgetTypePanelFull;
    isKpi = false;
  }

  return (
    <Box sx={sx}>
      <Typography
        component="span"
        sx={{
          display: "inline-block",
          fontSize: "0.6rem",
          lineHeight: 1.6,
          px: 0.75,
          borderRadius: 0.5,
          bgcolor: isKpi ? "primary.light" : "action.selected",
          color: isKpi ? "primary.main" : "text.secondary",
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

export function WidgetCard(props: Props) {
  const { widget, label, description, icon: Icon } = props;

  const containerBox = {
    px: layout.stack,
    py: layout.inline,
    display: "flex",
    gap: layout.page,
    alignItems: "center",
  };
  const iconBox = {
    flexShrink: 0,
    width: 18,
    display: "flex",
  };
  const contentBox = {
    flex: 1,
    minWidth: 0,
  };
  const headerTypography = { fontWeight: 500, lineHeight: 1.3, color: "text.primary" };
  const descriptionTypography = { display: "block", lineHeight: 1.3, mt: 0.25 };

  if (props.mode === "active") {
    const { dragHandleProps, isDragging, onRemove } = props;
    return (
      <Card
        {...dragHandleProps}
        sx={{
          height: "100%",
          opacity: isDragging ? 0.35 : 1,
          cursor: isDragging ? "grabbing" : "grab",
          bgcolor: "background.surface",
          border: 1,
          borderColor: isDragging ? "primary.main" : "divider",
          transition: "border-color 150ms, opacity 150ms",
          userSelect: "none",
        }}
      >
        <Box sx={containerBox}>
          <Box sx={iconBox}>{Icon && <Icon sx={{ fontSize: 22, color: "text.secondary" }} />}</Box>
          <Box sx={contentBox}>
            <Typography variant="body2" sx={headerTypography}>
              {label}
            </Typography>
            {description && (
              <Typography variant="caption" color="text.secondary" sx={descriptionTypography}>
                {description}
              </Typography>
            )}
            <TypeBadge kind={widget.kind} span={widget.span} sx={{ mt: 0 }} />
          </Box>
          <Tooltip title={m.settings.dashboards.removeWidget}>
            <IconButton
              size="small"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              sx={{ flexShrink: 0, color: "text.disabled" }}
            >
              <CloseIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Card>
    );
  }

  const { onAdd } = props;
  return (
    <Card sx={{ border: 1, borderColor: "divider", bgcolor: "background.surface" }}>
      <CardActionArea onClick={onAdd}>
        <Box sx={containerBox}>
          <Box sx={iconBox}>
            {Icon && <Box component={Icon} sx={{ fontSize: 22, color: "text.secondary" }} />}
          </Box>
          <Box sx={contentBox}>
            <Typography variant="body2" sx={headerTypography}>
              {label}
            </Typography>
            {description && (
              <Typography variant="caption" color="text.secondary" sx={descriptionTypography}>
                {description}
              </Typography>
            )}
            <TypeBadge kind={widget.kind} span={widget.span} sx={{ mt: layout.inline }} />
          </Box>
          <AddIcon sx={{ fontSize: 22, color: "text.disabled", flexShrink: 0 }} />
        </Box>
      </CardActionArea>
    </Card>
  );
}
