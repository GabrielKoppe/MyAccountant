"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

import { m } from "@/lib/messages";
import type { ImportResult } from "@/server/services/csv-import-service";

type Props = {
  result: ImportResult;
  accountId: string;
  monthId: string;
  onClose: () => void;
  onImportAnother: () => void;
};

export function StepResult({ result, accountId, monthId, onClose, onImportAnother }: Props) {
  const hasErrors = result.errors.length > 0;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, py: 2 }}>
      <CheckCircleIcon color="success" sx={{ fontSize: 72 }} />

      <Box sx={{ textAlign: "center" }}>
        <Typography variant="h6">
          {m.csvImport.result.success}
        </Typography>
        <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
          {m.csvImport.result.importedCount(result.imported)}
        </Typography>
      </Box>

      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", justifyContent: "center" }}>
        <Chip label={m.csvImport.result.importedCount(result.imported)} color="success" />
        {result.skipped > 0 && (
          <Chip label={m.csvImport.result.skippedCount(result.skipped)} variant="outlined" />
        )}
        {hasErrors && (
          <Chip
            icon={<ErrorOutlineIcon />}
            label={m.csvImport.result.errorCount(result.errors.length)}
            color="warning"
          />
        )}
      </Box>

      {hasErrors && (
        <Box sx={{ width: "100%", maxHeight: 200, overflowY: "auto" }}>
          <Typography variant="caption" color="error.main">
            {m.csvImport.result.errorsTitle}
          </Typography>
          <List dense disablePadding>
            {result.errors.slice(0, 20).map((e) => (
              <ListItem key={e.rowIndex} disablePadding>
                <ListItemText
                  primary={`Linha ${e.rowIndex + 1}: ${e.message}`}
                  primaryTypographyProps={{ variant: "caption", color: "error.main" }}
                />
              </ListItem>
            ))}
            {result.errors.length > 20 && (
              <ListItem disablePadding>
                <ListItemText
                  primary={m.csvImport.result.moreErrors(result.errors.length - 20)}
                  primaryTypographyProps={{ variant: "caption", color: "text.secondary" }}
                />
              </ListItem>
            )}
          </List>
        </Box>
      )}

      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "center" }}>
        <Button
          variant="contained"
          endIcon={<OpenInNewIcon />}
          href={`/${accountId}/months/${monthId}`}
          onClick={onClose}
        >
          {m.csvImport.result.viewTable}
        </Button>
        <Button variant="outlined" onClick={onImportAnother}>
          {m.csvImport.result.importAnother}
        </Button>
      </Box>
    </Box>
  );
}
