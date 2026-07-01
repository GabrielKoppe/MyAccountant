"use client";

import Alert from "@mui/material/Alert";
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
import { layout } from "@/lib/design-tokens";
import { FieldGroup } from "@/components/ui/FieldGroup";

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

  const sectionName = sections.find((s) => s.id === config.sectionId)?.name;

  return (
    <Stack
      spacing={layout.stack}
      sx={{ maxWidth: 640, mx: "auto", width: "100%", py: layout.inline }}
    >
      {/* Resumo do que será importado */}
      <Alert severity={errorCount > 0 ? "warning" : "success"}>
        <Typography variant="body2">
          <strong>{m.csvImport.config.readySummary(okCount)}</strong>
          {errorCount > 0 && (
            <>
              {" — "}
              {errorCount} linha(s) com erro serão ignoradas.
            </>
          )}
        </Typography>
      </Alert>

      {/* Destino */}
      <FieldGroup title={m.csvImport.config.destinationTitle}>
        <Stack spacing={layout.stack}>
          <TextField
            label={m.csvImport.config.tableNameLabel}
            value={config.tableName}
            onChange={(e) => patch({ tableName: e.target.value })}
            fullWidth
            size="small"
            autoFocus
            required
          />

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: layout.stack,
            }}
          >
            <FormControl fullWidth size="small" required>
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

            <FormControl fullWidth size="small">
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
          </Box>

          {/* Preview do destino */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: layout.inline,
              px: layout.inline,
              py: layout.micro,
              borderRadius: 1,
              bgcolor: "background.subtle",
              border: 1,
              borderColor: "border.subtle",
            }}
          >
            <Typography variant="caption" color="text.tertiary" sx={{ textTransform: "uppercase" }}>
              {m.csvImport.config.destinationPreview}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontWeight: "medium",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {sectionName ?? "—"}
              <Box component="span" sx={{ color: "text.disabled", mx: 0.5 }}>
                ›
              </Box>
              <Box
                component="span"
                sx={{ color: config.tableName ? "text.primary" : "text.disabled" }}
              >
                {config.tableName || m.csvImport.config.tableNameLabel}
              </Box>
            </Typography>
          </Box>

          <Box>
            <FormControlLabel
              sx={{ ml: 0 }}
              control={
                <Checkbox
                  size="small"
                  checked={config.countInMonth}
                  onChange={(e) => patch({ countInMonth: e.target.checked })}
                />
              }
              label={
                <Typography variant="body2">{m.csvImport.config.countInMonthLabel}</Typography>
              }
            />
            <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4 }}>
              {m.csvImport.config.countInMonthHint}
            </Typography>
          </Box>
        </Stack>
      </FieldGroup>

      {/* Salvar template */}
      <FieldGroup
        title={m.csvImport.config.templateTitle}
        hint={m.csvImport.config.saveTemplateHint}
      >
        <FormControlLabel
          sx={{ ml: 0 }}
          control={
            <Checkbox
              size="small"
              checked={config.saveTemplate}
              onChange={(e) => patch({ saveTemplate: e.target.checked })}
            />
          }
          label={<Typography variant="body2">{m.csvImport.config.saveTemplateLabel}</Typography>}
        />
        <Collapse in={config.saveTemplate}>
          <TextField
            label={m.csvImport.config.templateNameLabel}
            value={config.templateName}
            onChange={(e) => patch({ templateName: e.target.value })}
            fullWidth
            size="small"
            sx={{ mt: layout.inline }}
          />
        </Collapse>
      </FieldGroup>
    </Stack>
  );
}
