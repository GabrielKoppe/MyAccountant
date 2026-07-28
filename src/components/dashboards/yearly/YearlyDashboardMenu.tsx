"use client";

import FileDownloadIcon from "@mui/icons-material/FileDownload";
import { Button } from "@mui/material";
import CircularProgress from "@mui/material/CircularProgress";
import ListItemIcon from "@mui/material/ListItemIcon";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { useState } from "react";

import { useExportDownload } from "@/lib/hooks/use-export-download";
import { m } from "@/lib/messages";

type Props = {
  csvUrl: string;
};

export function YearlyDashboardMenu({ csvUrl }: Props) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const { download, loading } = useExportDownload();

  async function handleExport(url: string) {
    setAnchor(null);
    await download(url);
  }

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        onClick={(e) => setAnchor(e.currentTarget)}
        disabled={loading}
        startIcon={
          loading ? (
            <CircularProgress size={16} color="inherit" />
          ) : (
            <FileDownloadIcon fontSize="small" />
          )
        }
        sx={{
          color: "text.secondary",
          borderColor: "divider",
          "&:hover": { borderColor: "divider" },
        }}
      >
        {m.export.buttonLabel}
      </Button>
      <Menu
        anchorEl={anchor}
        open={!!anchor}
        onClose={() => setAnchor(null)}
        slotProps={{ paper: { sx: { minWidth: 160 } } }}
      >
        <MenuItem
          onClick={() => handleExport(csvUrl)}
          disabled={loading}
          sx={{ py: 0.75, fontSize: 13 }}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            <FileDownloadIcon sx={{ fontSize: 16 }} />
          </ListItemIcon>
          {m.export.csvYearOption}
        </MenuItem>
      </Menu>
    </>
  );
}
