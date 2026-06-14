"use client";

import { useState } from "react";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import MoreVertIcon from "@mui/icons-material/MoreVert";

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
      <IconButton
        size="small"
        onClick={(e) => setAnchor(e.currentTarget)}
        disabled={loading}
        aria-label="Mais opções"
      >
        {loading ? (
          <CircularProgress size={16} color="inherit" />
        ) : (
          <MoreVertIcon fontSize="small" />
        )}
      </IconButton>
      <Menu
        anchorEl={anchor}
        open={!!anchor}
        onClose={() => setAnchor(null)}
        slotProps={{ paper: { sx: { minWidth: 180 } } }}
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
