"use client";

import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import Collapse from "@mui/material/Collapse";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { m } from "@/lib/messages";

type SectionOption = { id: string; name: string };
type TableTypeOption = { id: string; name: string; isDefault: boolean };

export type ImportConfig = {
  tableName: string;
  sectionId: string;
  tableTypeId: string;
  countInMonth: boolean;
  saveTemplate: boolean;
  templateName: string;
};

type Props = {
  config: ImportConfig;
  sections: SectionOption[];
  tableTypes: TableTypeOption[];
  okCount: number;
  errorCount: number;
  onChange: (config: ImportConfig) => void;
};

export function StepConfig({ config, sections, tableTypes, okCount, errorCount, onChange }: Props) {
  function patch(partial: Partial<ImportConfig>) {
    onChange({ ...config, ...partial });
  }

  return (
    <Stack spacing={2.5}>
      <Box
        sx={{
          p: 2,
          bgcolor: "background.subtle",
          borderRadius: 1,
          border: 1,
          borderColor: "border.subtle",
        }}
      >
        <Typography variant="body2">
          <strong>{okCount}</strong> transação(ões) serão importadas.
          {errorCount > 0 && (
            <>
              {" "}
              <strong>{errorCount}</strong> linha(s) com erro serão ignoradas.
            </>
          )}
        </Typography>
      </Box>

      {/* Table name */}
      <TextField
        label={m.csvImport.config.tableNameLabel}
        value={config.tableName}
        onChange={(e) => patch({ tableName: e.target.value })}
        fullWidth
        autoFocus
        required
      />

      {/* Section */}
      <FormControl fullWidth required>
        <InputLabel>{m.csvImport.config.sectionLabel}</InputLabel>
        <Select
          value={config.sectionId}
          label={m.csvImport.config.sectionLabel}
          onChange={(e) => patch({ sectionId: e.target.value })}
        >
          {sections.map((s) => (
            <MenuItem key={s.id} value={s.id}>
              {s.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Table type */}
      <FormControl fullWidth>
        <InputLabel>{m.csvImport.config.tableTypeLabel}</InputLabel>
        <Select
          value={config.tableTypeId}
          label={m.csvImport.config.tableTypeLabel}
          onChange={(e) => patch({ tableTypeId: e.target.value })}
        >
          {tableTypes.map((t) => (
            <MenuItem key={t.id} value={t.id}>
              {t.name}
              {t.isDefault && (
                <Typography
                  component="span"
                  variant="caption"
                  color="text.secondary"
                  sx={{ ml: 1 }}
                >
                  (padrão)
                </Typography>
              )}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Count in month */}
      <FormControlLabel
        control={
          <Checkbox
            checked={config.countInMonth}
            onChange={(e) => patch({ countInMonth: e.target.checked })}
          />
        }
        label={m.csvImport.config.countInMonthLabel}
      />

      {/* Save as template */}
      <Box>
        <FormControlLabel
          control={
            <Checkbox
              checked={config.saveTemplate}
              onChange={(e) => patch({ saveTemplate: e.target.checked })}
            />
          }
          label={m.csvImport.config.saveTemplateLabel}
        />
        <Collapse in={config.saveTemplate}>
          <TextField
            label={m.csvImport.config.templateNameLabel}
            value={config.templateName}
            onChange={(e) => patch({ templateName: e.target.value })}
            fullWidth
            size="small"
            sx={{ mt: 1, ml: 4, width: "calc(100% - 32px)" }}
          />
        </Collapse>
      </Box>
    </Stack>
  );
}
