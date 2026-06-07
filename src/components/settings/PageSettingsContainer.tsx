import { Box, Typography, Button } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import React from "react";
import { containers, layout } from "@/lib/design-tokens";

interface PageSettingsContainerProps {
  title?: string;
  secondary?: React.ReactNode;
  children?: React.ReactNode;
}

const PageSettingsContainer: React.FC<PageSettingsContainerProps> = ({
  title,
  secondary,
  children,
}) => {
  return (
    <Box
      sx={{
        p: layout.page,
        maxWidth: containers.md,
        display: "flex",
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
