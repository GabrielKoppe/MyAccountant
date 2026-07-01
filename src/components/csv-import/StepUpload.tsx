"use client";

import { useRef, useState } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import UploadFileIcon from "@mui/icons-material/UploadFile";

import { m } from "@/lib/messages";
import { layout } from "@/lib/design-tokens";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ACCEPT = [".csv", ".xlsx", ".xls"];

type Props = {
  /** Nome do arquivo já selecionado (a tokenização é feita pelo wizard). */
  fileName?: string | null;
  /** True enquanto o wizard tokeniza o arquivo. */
  parsing?: boolean;
  /** Mensagem de erro de parse vinda do wizard. */
  parseError?: string | null;
  onFileSelected: (file: File, fileType: "csv" | "xlsx") => void;
};

export function StepUpload({ fileName, parsing, parseError, onFileSelected }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFile(file: File) {
    setError(null);

    if (!ACCEPT.some((ext) => file.name.toLowerCase().endsWith(ext))) {
      setError(m.csvImport.upload.invalidType);
      return;
    }
    if (file.size > MAX_SIZE) {
      setError(m.csvImport.upload.tooLarge);
      return;
    }

    const isCsv = file.name.toLowerCase().endsWith(".csv");
    onFileSelected(file, isCsv ? "csv" : "xlsx");
  }

  const loading = Boolean(parsing);
  const shownError = error ?? parseError ?? null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: layout.stack }}>
      <Box
        sx={{
          width: "100%",
          border: 2,
          borderStyle: "dashed",
          borderColor: dragging ? "primary.main" : "border.default",
          borderRadius: 2,
          p: 5,
          textAlign: "center",
          cursor: "pointer",
          bgcolor: dragging ? "action.selected" : "background.default",
          transition: "all 0.2s",
          "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
        }}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />

        {loading ? (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
            <CircularProgress size={40} />
            {fileName && (
              <Typography variant="caption" color="text.secondary">
                {fileName}
              </Typography>
            )}
          </Box>
        ) : fileName ? (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
            <CheckCircleOutlineIcon color="success" sx={{ fontSize: 48 }} />
            <Typography fontWeight="medium">{fileName}</Typography>
            <Typography variant="caption" color="text.secondary">
              {m.csvImport.upload.changeFile}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
            <UploadFileIcon sx={{ fontSize: 48, color: "text.disabled" }} />
            <Typography variant="h6" color="text.secondary">
              {dragging ? m.csvImport.upload.dropzoneActive : m.csvImport.upload.dropzone}
            </Typography>
            <Typography variant="caption" color="text.disabled">
              {m.csvImport.upload.accept}
            </Typography>
          </Box>
        )}
      </Box>

      {shownError && (
        <Typography color="error" variant="body2">
          {shownError}
        </Typography>
      )}
    </Box>
  );
}
