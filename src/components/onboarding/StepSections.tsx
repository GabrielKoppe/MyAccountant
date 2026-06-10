"use client";

import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import { useSnackbar } from "notistack";

import { createSectionAction, deleteSectionAction } from "@/actions/account-settings";
import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";

type SectionCountType = "add" | "subtract" | "ignore" | "neutral";

export type OnboardingSection = {
  id: string;
  name: string;
  countType: SectionCountType;
};

type Props = {
  accountId: string;
  sections: OnboardingSection[];
  onSectionAdded: (section: OnboardingSection) => void;
  onSectionRemoved: (id: string) => void;
  onNext: () => void;
};

const COUNT_TYPE_COLORS: Record<SectionCountType, string> = {
  add: "success.main",
  subtract: "danger.main",
  ignore: "text.secondary",
  neutral: "warning.main",
};

const SUGGESTIONS: { name: string; countType: SectionCountType }[] = [
  { name: "Renda", countType: "add" },
  { name: "Gastos Fixos", countType: "subtract" },
  { name: "Gastos Variáveis", countType: "subtract" },
  { name: "Investimentos", countType: "ignore" },
  { name: "Poupança", countType: "ignore" },
];

export function StepSections({
  accountId,
  sections,
  onSectionAdded,
  onSectionRemoved,
  onNext,
}: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [name, setName] = useState("");
  const [countType, setCountType] = useState<SectionCountType>("subtract");
  const [isAdding, setIsAdding] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const addedNames = new Set(sections.map((s) => s.name.toLowerCase()));
  const canAdd = name.trim().length > 0;

  function fillFromSuggestion(suggestion: { name: string; countType: SectionCountType }) {
    setName(suggestion.name);
    setCountType(suggestion.countType);
  }

  async function handleAdd() {
    if (!canAdd) return;
    setIsAdding(true);
    const result = await createSectionAction(accountId, {
      name: name.trim(),
      countType,
      isActive: true,
    });
    setIsAdding(false);
    if (!result.ok) {
      enqueueSnackbar(result.error.message, { variant: "error" });
      return;
    }
    onSectionAdded({ id: result.data.sectionId, name: name.trim(), countType });
    enqueueSnackbar(m.setup.sections.added, { variant: "success" });
    setName("");
    setCountType("subtract");
  }

  async function handleDelete(id: string) {
    setIsDeleting(id);
    const result = await deleteSectionAction(accountId, { sectionId: id });
    setIsDeleting(null);
    if (!result.ok) {
      enqueueSnackbar(result.error.message, { variant: "error" });
      return;
    }
    onSectionRemoved(id);
    enqueueSnackbar(m.setup.sections.deleted, { variant: "success" });
  }

  return (
    <Stack spacing={layout.card}>
      {/* Explicação e tabelas financeiras */}
      <Stack spacing={layout.stack}>
        <Typography variant="body1" color="text.secondary" sx={{ fontSize: "0.9rem" }}>
          {m.setup.sections.description}
        </Typography>
        <Alert
          icon={<TableChartOutlinedIcon fontSize="small" />}
          severity="info"
          sx={{ "& .MuiAlert-message": { display: "flex", flexDirection: "column", gap: 0.5 } }}
        >
          <Typography variant="body2" fontWeight="medium">
            {m.setup.sections.financeTablesTitle}
          </Typography>
          <Typography variant="body2">{m.setup.sections.financeTablesDesc}</Typography>
        </Alert>
      </Stack>

      {/* Sugestões */}
      <Stack spacing={layout.inline}>
        <Stack direction="row" spacing={layout.inline} alignItems="center">
          <InfoOutlinedIcon fontSize="small" sx={{ color: "text.tertiary" }} />
          <Typography variant="body2" color="text.secondary">
            <strong>{m.setup.sections.suggestionsLabel}</strong> —{" "}
            {m.setup.sections.suggestionsHint}
          </Typography>
        </Stack>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: layout.inline }}>
          {SUGGESTIONS.map((s) => {
            const isAdded = addedNames.has(s.name.toLowerCase());
            return (
              <Chip
                key={s.name}
                label={`${s.name} · ${m.settings.sections.countTypes[s.countType]}`}
                onClick={isAdded ? undefined : () => fillFromSuggestion(s)}
                disabled={isAdded}
                color={isAdded ? "default" : "default"}
                variant={isAdded ? "filled" : "outlined"}
                size="small"
                sx={{
                  cursor: isAdded ? "default" : "pointer",
                  opacity: isAdded ? 0.5 : 1,
                  "& .MuiChip-label": { fontWeight: isAdded ? "medium" : "regular" },
                }}
              />
            );
          })}
        </Box>
      </Stack>

      {/* Formulário de adição */}
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={layout.stack}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={layout.inline}>
              <TextField
                label={m.setup.sections.nameLabel}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
                size="small"
                fullWidth
                autoComplete="off"
              />
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>{m.setup.sections.countTypeLabel}</InputLabel>
                <Select
                  value={countType}
                  label={m.setup.sections.countTypeLabel}
                  onChange={(e) => setCountType(e.target.value as SectionCountType)}
                >
                  {(["add", "subtract", "ignore", "neutral"] as const).map((ct) => (
                    <MenuItem key={ct} value={ct}>
                      <Stack direction="row" spacing={layout.inline} alignItems="center">
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            bgcolor: COUNT_TYPE_COLORS[ct],
                            flexShrink: 0,
                          }}
                        />
                        <span>{m.settings.sections.countTypes[ct]}</span>
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAdd}
                disabled={!canAdd || isAdding}
                sx={{ flexShrink: 0, whiteSpace: "nowrap" }}
              >
                {m.setup.sections.addButton}
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* Lista de seções adicionadas */}
      {sections.length > 0 ? (
        <Stack spacing={layout.micro}>
          <Typography variant="body2" color="text.secondary" fontWeight="medium">
            {m.setup.sections.addedTitle}
          </Typography>
          <Card variant="outlined">
            <Stack divider={<Divider />}>
              {sections.map((section) => (
                <Box
                  key={section.id}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    px: 2,
                    py: 1.5,
                  }}
                >
                  <Stack direction="row" spacing={layout.inline} alignItems="center">
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        bgcolor: COUNT_TYPE_COLORS[section.countType],
                        flexShrink: 0,
                      }}
                    />
                    <Typography variant="body2" fontWeight="medium">
                      {section.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {m.settings.sections.countTypes[section.countType]}
                    </Typography>
                  </Stack>
                  <IconButton
                    size="small"
                    aria-label={`Remover ${section.name}`}
                    onClick={() => handleDelete(section.id)}
                    disabled={isDeleting === section.id}
                    sx={{ color: "text.tertiary" }}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </Stack>
          </Card>
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
          {m.setup.sections.emptyHint}
        </Typography>
      )}

      {/* Navegação */}
      <Stack direction="row" justifyContent="flex-end" spacing={layout.inline}>
        <Button variant="text" onClick={onNext}>
          {m.setup.skip}
        </Button>
        <Button variant="contained" onClick={onNext}>
          {m.setup.next}
        </Button>
      </Stack>
    </Stack>
  );
}
