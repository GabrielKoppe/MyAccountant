import { Fragment, type ReactNode } from "react";
import Box from "@mui/material/Box";
import { buildSegments, type WidgetDef } from "./widget-registry";

type Props = {
  active: WidgetDef[];
  nodeMap: Record<string, ReactNode>;
};

export function DashboardWidgetRenderer({ active, nodeMap }: Props) {
  const segments = buildSegments(active);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
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
                  md: `repeat(${Math.min(seg.widgets.length, 6)}, 1fr)`,
                },
                gap: 1.5,
              }}
            >
              {seg.widgets.map((w) => (
                <Fragment key={w.id}>{nodeMap[w.id] ?? null}</Fragment>
              ))}
            </Box>
          );
        }

        if (seg.type === "halves") {
          const count = seg.widgets.length;
          return (
            <Box
              key={`halves-${idx}`}
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: count === 2 ? "1fr 1fr" : "1fr" },
                gap: 3,
              }}
            >
              {seg.widgets.map((w) => (
                <Fragment key={w.id}>{nodeMap[w.id] ?? null}</Fragment>
              ))}
            </Box>
          );
        }

        // full
        return <Box key={`full-${idx}`}>{nodeMap[seg.widget.id] ?? null}</Box>;
      })}
    </Box>
  );
}
