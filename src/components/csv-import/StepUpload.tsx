"use client";

import { useRef, useState } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import UploadFileIcon from "@mui/icons-material/UploadFile";

import { m } from "@/lib/messages";
import { layout } from "@/lib/design-tokens";
import type { FileMatrix } from "@/lib/csv-parser";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ACCEPT = [".csv", ".xlsx", ".xls"];

type Props = {
  onParsed: (matrix: FileMatrix, fileType: "csv" | "xlsx", file: File) => void;
};

export function StepUpload({ onParsed }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<{ name: string; rows: number } | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setFileInfo(null);

    if (!ACCEPT.some((ext) => file.name.toLowerCase().endsWith(ext))) {
      setError(m.csvImport.upload.invalidType);
      return;
    }
    if (file.size > MAX_SIZE) {
      setError(m.csvImport.upload.tooLarge);
      return;
    }

    setLoading(true);
    try {
      const isCsv = file.name.toLowerCase().endsWith(".csv");
      const matrix = isCsv ? await parseCsv(file) : await parseXlsx(file);

      setFileInfo({ name: file.name, rows: matrix.length });
      onParsed(matrix, isCsv ? "csv" : "xlsx", file);
    } catch {
      setError(m.csvImport.upload.parseError);
    } finally {
      setLoading(false);
    }
  }

  // Tokeniza o CSV inteiro em matriz crua (header:false). A interpretação de
  // cabeçalho/skipRows acontece depois, em deriveHeadersAndRows, de forma reativa.
  async function parseCsv(file: File): Promise<FileMatrix> {
    const Papa = (await import("papaparse")).default;
    return new Promise((resolve, reject) => {
      Papa.parse<string[]>(file, {
        header: false,
        skipEmptyLines: false,
        complete: (result) => resolve(result.data.map((r) => r.map((c) => String(c ?? "")))),
        error: reject,
      });
    });
  }

  async function parseXlsx(file: File): Promise<FileMatrix> {
    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array", raw: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw: string[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: "",
      raw: false,
    }) as string[][];

    return raw.map((r) => r.map((c) => String(c ?? "")));
  }

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
          <CircularProgress size={40} />
        ) : fileInfo ? (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
            <CheckCircleOutlineIcon color="success" sx={{ fontSize: 48 }} />
            <Typography fontWeight="medium">{fileInfo.name}</Typography>
            <Chip label={m.csvImport.upload.rowCount(fileInfo.rows)} color="success" size="small" />
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

      {error && (
        <Typography color="error" variant="body2">
          {error}
        </Typography>
      )}
    </Box>
  );
}
