"use client";

import { useState, useTransition } from "react";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useSnackbar } from "notistack";

import {
  createCategoryAction,
  createSubcategoryAction,
  deleteCategoryAction,
  deleteSubcategoryAction,
  updateCategoryAction,
  updateSubcategoryAction,
} from "@/actions/account-settings";
import { DialogShell } from "@/components/ui/DialogShell";
import { m } from "@/lib/messages";
import PageSettingsContainer from "@/components/settings/PageSettingsContainer";

type Subcategory = { id: string; name: string };
type Category = { id: string; name: string; subcategories: Subcategory[] };

type Props = {
  accountId: string;
  initialCategories: Category[];
  title?: string;
};

type DialogState =
  | { type: "createCategory" }
  | { type: "editCategory"; category: Category }
  | { type: "deleteCategory"; category: Category }
  | { type: "createSub"; categoryId: string }
  | { type: "editSub"; categoryId: string; sub: Subcategory }
  | { type: "deleteSub"; categoryId: string; sub: Subcategory }
  | null;

export function CategoriesManager({ accountId, initialCategories, title }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [categories, setCategories] = useState(initialCategories);
  const [isPending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [nameInput, setNameInput] = useState("");
  const [nameError, setNameError] = useState("");

  function openDialog(d: DialogState, initialName = "") {
    setDialog(d);
    setNameInput(initialName);
    setNameError("");
  }

  function closeDialog() {
    setDialog(null);
    setNameInput("");
    setNameError("");
  }

  function handleSave() {
    if (!nameInput.trim()) {
      setNameError("Nome obrigatório");
      return;
    }
    setNameError("");
    startTransition(async () => {
      if (dialog?.type === "createCategory") {
        const result = await createCategoryAction(accountId, { name: nameInput.trim() });
        if (!result.ok) {
          enqueueSnackbar(result.error.message, { variant: "error" });
          return;
        }
        setCategories((prev) => [
          ...prev,
          { id: result.data.categoryId, name: nameInput.trim(), subcategories: [] },
        ]);
        enqueueSnackbar(m.settings.categories.created, { variant: "success" });
      } else if (dialog?.type === "editCategory") {
        const result = await updateCategoryAction(accountId, {
          categoryId: dialog.category.id,
          name: nameInput.trim(),
        });
        if (!result.ok) {
          enqueueSnackbar(result.error.message, { variant: "error" });
          return;
        }
        setCategories((prev) =>
          prev.map((c) => (c.id === dialog.category.id ? { ...c, name: nameInput.trim() } : c)),
        );
        enqueueSnackbar(m.settings.categories.updated, { variant: "success" });
      } else if (dialog?.type === "createSub") {
        const result = await createSubcategoryAction(accountId, {
          categoryId: dialog.categoryId,
          name: nameInput.trim(),
        });
        if (!result.ok) {
          enqueueSnackbar(result.error.message, { variant: "error" });
          return;
        }
        setCategories((prev) =>
          prev.map((c) =>
            c.id === dialog.categoryId
              ? {
                  ...c,
                  subcategories: [
                    ...c.subcategories,
                    { id: result.data.subcategoryId, name: nameInput.trim() },
                  ],
                }
              : c,
          ),
        );
        enqueueSnackbar(m.settings.categories.subCreated, { variant: "success" });
      } else if (dialog?.type === "editSub") {
        const result = await updateSubcategoryAction(accountId, {
          subcategoryId: dialog.sub.id,
          name: nameInput.trim(),
        });
        if (!result.ok) {
          enqueueSnackbar(result.error.message, { variant: "error" });
          return;
        }
        setCategories((prev) =>
          prev.map((c) =>
            c.id === dialog.categoryId
              ? {
                  ...c,
                  subcategories: c.subcategories.map((s) =>
                    s.id === dialog.sub.id ? { ...s, name: nameInput.trim() } : s,
                  ),
                }
              : c,
          ),
        );
        enqueueSnackbar(m.settings.categories.subUpdated, { variant: "success" });
      }
      closeDialog();
    });
  }

  function handleDelete() {
    if (!dialog) return;
    if (dialog.type === "deleteCategory") {
      const categoryId = dialog.category.id;
      closeDialog();
      startTransition(async () => {
        const result = await deleteCategoryAction(accountId, { categoryId });
        if (!result.ok) {
          enqueueSnackbar(result.error.message, { variant: "error" });
          return;
        }
        setCategories((prev) => prev.filter((c) => c.id !== categoryId));
        enqueueSnackbar(m.settings.categories.deleted, { variant: "success" });
      });
    } else if (dialog.type === "deleteSub") {
      const { categoryId, sub } = dialog;
      closeDialog();
      startTransition(async () => {
        const result = await deleteSubcategoryAction(accountId, { subcategoryId: sub.id });
        if (!result.ok) {
          enqueueSnackbar(result.error.message, { variant: "error" });
          return;
        }
        setCategories((prev) =>
          prev.map((c) =>
            c.id === categoryId
              ? { ...c, subcategories: c.subcategories.filter((s) => s.id !== sub.id) }
              : c,
          ),
        );
        enqueueSnackbar(m.settings.categories.subDeleted, { variant: "success" });
      });
    }
  }

  const isDeleteDialog = dialog?.type === "deleteCategory" || dialog?.type === "deleteSub";
  const isNameDialog = !isDeleteDialog && dialog !== null;

  return (
    <PageSettingsContainer
      title={title}
      secondary={
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => openDialog({ type: "createCategory" })}
        >
          {m.settings.categories.createButton}
        </Button>
      }
    >
      {categories.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          {m.settings.categories.noCategories}
        </Typography>
      )}

      {categories.map((category) => (
        <Accordion key={category.id} disableGutters variant="outlined" sx={{ mb: 1 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />}>
            <Typography variant="body2" fontWeight="medium">
              {category.name}
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            {/* Ações da categoria ficam aqui para evitar <button> aninhado no AccordionSummary */}
            <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
              <Button
                size="small"
                startIcon={<EditIcon />}
                onClick={() => openDialog({ type: "editCategory", category }, category.name)}
              >
                {m.common.edit}
              </Button>
              <Button
                size="small"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => openDialog({ type: "deleteCategory", category })}
              >
                {m.common.delete}
              </Button>
            </Box>
            <Divider sx={{ mb: 1 }} />
            <List dense disablePadding>
              {category.subcategories.map((sub) => (
                <ListItem
                  key={sub.id}
                  secondaryAction={
                    <Box sx={{ display: "flex", gap: 0.25 }}>
                      <Tooltip title={m.common.edit}>
                        <IconButton
                          size="small"
                          onClick={() =>
                            openDialog({ type: "editSub", categoryId: category.id, sub }, sub.name)
                          }
                        >
                          <EditIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={m.common.delete}>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() =>
                            openDialog({ type: "deleteSub", categoryId: category.id, sub })
                          }
                        >
                          <DeleteIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  }
                >
                  <ListItemText
                    primary={sub.name}
                    primaryTypographyProps={{ variant: "body2" }}
                    sx={{ pl: 2 }}
                  />
                </ListItem>
              ))}
            </List>
            <Divider sx={{ my: 1 }} />
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() => openDialog({ type: "createSub", categoryId: category.id })}
            >
              {m.settings.categories.createSubButton}
            </Button>
          </AccordionDetails>
        </Accordion>
      ))}

      {/* Name input dialog */}
      <DialogShell
        open={isNameDialog}
        onClose={closeDialog}
        maxWidth="xs"
        title={
          (dialog?.type === "createCategory" && m.settings.categories.createButton) ||
          (dialog?.type === "editCategory" && m.settings.categories.editTitle) ||
          (dialog?.type === "createSub" && m.settings.categories.createSubButton) ||
          (dialog?.type === "editSub" && m.settings.categories.editTitle) ||
          ""
        }
        loading={isPending}
        actions={
          <>
            <Button size="small" onClick={closeDialog}>
              {m.common.cancel}
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={handleSave}
              endIcon={isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {m.common.save}
            </Button>
          </>
        }
      >
        <TextField
          label={m.settings.categories.nameLabel}
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          error={!!nameError}
          helperText={nameError}
          fullWidth
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSave();
            }
          }}
        />
      </DialogShell>

      {/* Delete dialog */}
      <DialogShell
        open={isDeleteDialog}
        onClose={closeDialog}
        maxWidth="xs"
        title={m.settings.categories.deleteTitle}
        description={
          dialog?.type === "deleteCategory"
            ? m.settings.categories.deleteConfirm
            : m.settings.categories.deleteSubConfirm
        }
        actions={
          <>
            <Button size="small" onClick={closeDialog}>
              {m.common.cancel}
            </Button>
            <Button size="small" color="error" variant="contained" onClick={handleDelete}>
              {m.common.delete}
            </Button>
          </>
        }
      />
    </PageSettingsContainer>
  );
}
