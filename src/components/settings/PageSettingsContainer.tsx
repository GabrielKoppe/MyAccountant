import { Box, Typography } from "@mui/material";
import React from "react";
import { containers, layout } from "@/lib/design-tokens";

interface PageSettingsContainerProps {
  title?: string;
  secondary?: React.ReactNode;
  /** Largura máxima do conteúdo. Padrão `md`; o editor de visualização usa `lg`. */
  maxWidth?: number | string;
  children?: React.ReactNode;
}

const PageSettingsContainer: React.FC<PageSettingsContainerProps> = ({
  title,
  secondary,
  maxWidth = containers.md,
  children,
}) => {
  return (
    <Box
      sx={{
        p: layout.page,
        maxWidth,
        display: "flex",
        justifyContent: "flex-start",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {title ? (
          <Typography variant="h3" margin={0} gutterBottom>
            {title}
          </Typography>
        ) : null}
        {secondary ? secondary : null}
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column" }}>{children}</Box>
    </Box>
  );
};

export default PageSettingsContainer;
