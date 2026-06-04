"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormLabel from "@mui/material/FormLabel";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import { useSnackbar } from "notistack";

import { useEffect, useState as useStateModal } from "react";
import { createFinanceTableAction } from "@/actions/finance-tables";
import { applyTemplateAction, listTemplatesAction } from "@/actions/table-templates";
import { createFinanceTableSchema, type CreateFinanceTableInput } from "@/lib/schemas/finance-table";
import { formatMonthLabel } from "@/lib/dates";
import { m } from "@/lib/messages";
import { DialogShell } from "@/components/ui/DialogShell";

type Section = { id: string; name: string };
type TableTypeOption = { id: string; name: string; isDefault: boolean };
type SourceTableOption = {
  id: string;
  name: string;
  sectionName: string;
  monthYear: string;
};

type Props = {
  accountId: string;
  monthId: string;
  sections: Section[];
  tableTypes: TableTypeOption[];
  preSelectedSectionId?: string;
  sourceTables: SourceTableOption[];
  trigger?: "button" | "icon";
  onCreated?: (tableId: string) => void;
};

export function CreateTableModal({
  accountId,
  monthId,
  sections,
  tableTypes,
  preSelectedSectionId,
  sourceTables,
  trigger = "button",
  onCreated,
}: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [open, setOpen] = useState(false);
  const [useTemplate, setUseTemplate] = useStateModal(false);
  const [selectedTemplateId, setSelectedTemplateId] = useStateModal("");
  const [templateList, setTemplateList] = useStateModal<{ id: string; name: string; _count: { items: number } }[]>([]);

  // Load templates lazily when "template" option is first selected
  useEffect(() => {
    if (useTemplate && templateList.length === 0) {
      listTemplatesAction(accountId, {}).then((res) => {
        if (res.ok) setTemplateList(res.data.map((t) => ({ id: t.id, name: t.name, _count: t._count })));
      });
    }
  }, [useTemplate, accountId, templateList.length]);

  const defaultTableType = tableTypes.find((t) => t.isDefault) ?? tableTypes[0];

  const form = useForm<CreateFinanceTableInput>({
    resolver: zodResolver(createFinanceTableSchema),
    defaultValues: {
      monthId,
      sectionId: preSelectedSectionId ?? sections[0]?.id ?? "",
      name: "",
      tableTypeId: defaultTableType?.id ?? "",
      sourceMethod: "empty",
      countInMonth: true,
      copyOptions: {
        includeTransactions: true,
        updateDates: true,
        markAsPending: false,
      },
    },
  });

  const sourceMethod = form.watch("sourceMethod");

  function openModal() {
    form.reset({
      monthId,
      sectionId: preSelectedSectionId ?? sections[0]?.id ?? "",
      name: "",
      tableTypeId: defaultTableType?.id ?? "",
      sourceMethod: "empty",
      countInMonth: true,
      copyOptions: { includeTransactions: true, updateDates: true, markAsPending: false },
    });
    setUseTemplate(false);
    setSelectedTemplateId("");
    setOpen(true);
  }

  async function onSubmit(values: CreateFinanceTableInput) {
    // Se "usar modelo" está selecionado, delegar para applyTemplateAction
    if (useTemplate) {
      if (!selectedTemplateId) {
        enqueueSnackbar("Selecione um modelo.", { variant: "warning" });
        return;
      }
      if (!values.name.trim()) {
        enqueueSnackbar("Informe o nome da tabela.", { variant: "warning" });
        return;
      }
      const result = await applyTemplateAction(accountId, {
        templateId: selectedTemplateId,
        monthId: values.monthId,
        sectionId: values.sectionId,
        name: values.name.trim(),
        tableTypeId: values.tableTypeId || undefined,
        countInMonth: values.countInMonth,
      });
      if (!result.ok) { enqueueSnackbar(result.error.message, { variant: "error" }); return; }
      enqueueSnackbar(m.tableModels.applied, { variant: "success" });
      setOpen(false);
      onCreated?.(result.data.tableId);
      return;
    }

    const result = await createFinanceTableAction(accountId, values);
    if (!result.ok) {
      if (result.error.fieldErrors) {
        Object.entries(result.error.fieldErrors).forEach(([field, message]) => {
          form.setError(field as keyof CreateFinanceTableInput, { message });
        });
      } else {
        enqueueSnackbar(result.error.message, { variant: "error" });
      }
      return;
    }
    enqueueSnackbar(m.financeTables.created, { variant: "success" });
    setOpen(false);
    onCreated?.(result.data.tableId);
  }

  return (
    <>
      <Button
        variant={trigger === "button" ? "contained" : "outlined"}
        startIcon={<AddIcon />}
        onClick={openModal}
        size="small"
      >
        {m.financeTables.createButton}
      </Button>

      <Box component="form" onSubmit={form.handleSubmit(onSubmit)}>
        <DialogShell
          open={open}
          onClose={() => setOpen(false)}
          maxWidth="sm"
          title={m.financeTables.createTitle}
          actions={
            <>
              <Button onClick={() => setOpen(false)}>{m.common.cancel}</Button>
              <Button type="submit" variant="contained" disabled={form.formState.isSubmitting}>
                {m.common.create}
              </Button>
            </>
          }
        >
          <Stack spacing={2.5}>
            {/* Seção */}
            {!preSelectedSectionId && (
              <Controller
                name="sectionId"
                control={form.control}
                render={({ field, fieldState }) => (
                  <FormControl error={!!fieldState.error} fullWidth>
                    <InputLabel>{m.financeTables.sectionLabel}</InputLabel>
                    <Select {...field} label={m.financeTables.sectionLabel}>
                      {sections.map((s) => (
                        <MenuItem key={s.id} value={s.id}>
                          {s.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />
            )}

            {/* Nome */}
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label={m.financeTables.nameLabel}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  fullWidth
                  autoFocus
                />
              )}
            />

            {/* Tipo de tabela */}
            <Controller
              name="tableTypeId"
              control={form.control}
              render={({ field, fieldState }) => (
                <FormControl error={!!fieldState.error} fullWidth>
                  <InputLabel>{m.financeTables.tableTypeLabel}</InputLabel>
                  <Select {...field} label={m.financeTables.tableTypeLabel}>
                    {tableTypes.map((t) => (
                      <MenuItem key={t.id} value={t.id}>
                        {t.name}
                        {t.isDefault && (
                          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                            (padrão)
                          </Typography>
                        )}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />

            {/* Contar no mês */}
            <Controller
              name="countInMonth"
              control={form.control}
              render={({ field }) => (
                <FormControlLabel
                  control={<Checkbox checked={field.value} onChange={field.onChange} />}
                  label={m.financeTables.countInMonthLabel}
                />
              )}
            />

            <Divider />

            {/* Source method */}
            <Controller
              name="sourceMethod"
              control={form.control}
              render={({ field }) => (
                <FormControl>
                  <FormLabel>{m.financeTables.sourceMethodLabel}</FormLabel>
                  <RadioGroup {...field} row>
                    <FormControlLabel
                      value="empty"
                      control={<Radio />}
                      label={m.financeTables.sourceMethods.empty}
                      onClick={() => setUseTemplate(false)}
                    />
                    <FormControlLabel
                      value="copy"
                      control={<Radio />}
                      label={m.financeTables.sourceMethods.copy}
                      disabled={sourceTables.length === 0}
                      onClick={() => setUseTemplate(false)}
                    />
                    <FormControlLabel
                      value="empty"
                      control={<Radio checked={useTemplate} onChange={() => { setUseTemplate(true); field.onChange("empty"); }} />}
                      label={m.financeTables.sourceMethods.template}
                    />
                  </RadioGroup>
                </FormControl>
              )}
            />

            {/* Template selector */}
            {useTemplate && (
              <Stack spacing={1.5} sx={{ pl: 1 }}>
                <FormControl fullWidth>
                  <InputLabel>Modelo *</InputLabel>
                  <Select
                    value={selectedTemplateId}
                    label="Modelo *"
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                  >
                    {templateList.length === 0 && (
                      <MenuItem disabled value="">Nenhum modelo salvo. Crie um em Configurações → Modelos.</MenuItem>
                    )}
                    {templateList.map((t) => (
                      <MenuItem key={t.id} value={t.id}>
                        {t.name}
                        <Chip label={`${t._count.items} item(ns)`} size="small" sx={{ ml: 1 }} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
            )}

            {/* Copy options */}
            {sourceMethod === "copy" && (
              <Stack spacing={2} sx={{ pl: 1 }}>
                <Controller
                  name="sourceTableId"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <FormControl error={!!fieldState.error} fullWidth>
                      <InputLabel>{m.financeTables.sourceTableLabel}</InputLabel>
                      <Select
                        {...field}
                        value={field.value ?? ""}
                        label={m.financeTables.sourceTableLabel}
                      >
                        {sourceTables.map((t) => (
                          <MenuItem key={t.id} value={t.id}>
                            <Box>
                              <Typography variant="body2">{t.name}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {t.monthYear} › {t.sectionName}
                              </Typography>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                      {fieldState.error && (
                        <Typography variant="caption" color="error">
                          {fieldState.error.message}
                        </Typography>
                      )}
                    </FormControl>
                  )}
                />

                <Controller
                  name="copyOptions.includeTransactions"
                  control={form.control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Checkbox checked={field.value ?? true} onChange={field.onChange} />
                      }
                      label={m.financeTables.includeTransactions}
                    />
                  )}
                />

                {form.watch("copyOptions.includeTransactions") && (
                  <>
                    <Controller
                      name="copyOptions.updateDates"
                      control={form.control}
                      render={({ field }) => (
                        <FormControlLabel
                          sx={{ pl: 2 }}
                          control={
                            <Checkbox checked={field.value ?? true} onChange={field.onChange} />
                          }
                          label={m.financeTables.updateDates}
                        />
                      )}
                    />
                    <Controller
                      name="copyOptions.markAsPending"
                      control={form.control}
                      render={({ field }) => (
                        <FormControlLabel
                          sx={{ pl: 2 }}
                          control={
                            <Checkbox
                              checked={field.value ?? false}
                              onChange={field.onChange}
                            />
                          }
                          label={m.financeTables.markAsPending}
                        />
                      )}
                    />
                  </>
                )}
              </Stack>
            )}
          </Stack>
        </DialogShell>
      </Box>
    </>
  );
}
