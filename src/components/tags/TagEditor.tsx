"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Box from "@mui/material/Box";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import MenuItem from "@mui/material/MenuItem";
import ArrowCircleRightIcon from "@mui/icons-material/ArrowCircleRight";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { styled } from "@mui/material/styles";
import { useSnackbar } from "notistack";

import {
  addTagToTransactionAction,
  listTagsAction,
  removeTagFromTransactionAction,
  updateTagAction,
} from "@/actions/tags";
import { m } from "@/lib/messages";
import { useTagUpdate } from "./TagUpdateContext";

type Tag = { id: string; name: string; color: string | null };
type Mode = { type: "view" } | { type: "edit"; tagId: string } | { type: "add" };

const MAX_TAG_LENGTH = 30;

// ─── Color picker: input[type="color"] estilizado como círculo ─────────────────
const ColorPickerDot = styled("input")(({ theme }) => ({
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
  width: 11,
  height: 11,
  borderRadius: "50%",
  border: `1px solid ${theme.palette.divider}`,
  padding: 0,
  cursor: "pointer",
  flexShrink: 0,
  display: "block",
  "&::-webkit-color-swatch-wrapper": { padding: 0 },
  "&::-webkit-color-swatch": { border: "none", borderRadius: "50%" },
  "&::-moz-color-swatch": { border: "none", borderRadius: "50%" },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────
const chipBase = {
  display: "inline-flex",
  alignItems: "center",
  height: 26,
  borderRadius: "13px",
  border: "1px solid",
  fontSize: "0.75rem",
  lineHeight: 1,
  fontFamily: "inherit",
  px: "8px",
  gap: "5px",
  whiteSpace: "nowrap" as const,
  verticalAlign: "middle",
  boxSizing: "border-box" as const,
};

function chipColors(color: string | null | undefined) {
  if (color) return { bgcolor: `${color}22`, borderColor: color, color: "text.primary" };
  return { bgcolor: "background.subtle", borderColor: "divider", color: "text.secondary" };
}

// ─── State 1: chip de leitura ─────────────────────────────────────────────────
function StaticChip({
  tag,
  onClick,
  canEdit,
}: {
  tag: Tag;
  onClick: () => void;
  canEdit: boolean;
}) {
  return (
    <Box
      component="span"
      onClick={canEdit ? onClick : undefined}
      sx={{
        ...chipBase,
        ...chipColors(tag.color),
        cursor: canEdit ? "pointer" : "default",
        transition: "filter 0.12s",
        "&:hover": canEdit ? { filter: "brightness(0.92)" } : undefined,
      }}
    >
      {tag.name}
    </Box>
  );
}

// ─── State 2: chip editável (clicado) ─────────────────────────────────────────
function EditableChip({
  tag,
  accountId,
  onSave,
  onRemove,
  onClose,
}: {
  tag: Tag;
  accountId: string;
  onSave: (tagId: string, name: string, color: string | null) => void;
  onRemove: (tagId: string) => void;
  onClose: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState(tag.color ?? "#6366f1");
  const colorInputRef = useRef<HTMLInputElement>(null);
  const savedRef = useRef(false);
  const [, startTransition] = useTransition();

  // Refs para evitar closure stale no event listener
  const nameRef = useRef(name);
  nameRef.current = name;
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  // Evento 'change' do DOM dispara UMA VEZ quando o picker nativo fecha
  // (React's onChange dispara em cada pixel arrastado = muitas requisições)
  useEffect(() => {
    const input = colorInputRef.current;
    if (!input) return;
    const handleChange = () => {
      const newColor = input.value;
      setColor(newColor);
      startTransition(async () => {
        await updateTagAction(accountId, { tagId: tag.id, color: newColor });
        onSaveRef.current(tag.id, nameRef.current, newColor);
      });
    };
    input.addEventListener("change", handleChange);
    return () => input.removeEventListener("change", handleChange);
  }, [accountId, tag.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSave() {
    if (savedRef.current) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === tag.name) {
      onClose();
      return;
    }
    savedRef.current = true;
    startTransition(async () => {
      const result = await updateTagAction(accountId, { tagId: tag.id, name: trimmed });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        savedRef.current = false;
        return;
      }
      onSave(tag.id, trimmed, color);
      onClose();
    });
  }

  return (
    <Box
      component="span"
      sx={{
        ...chipBase,
        ...chipColors(color),
        outline: "2px solid",
        outlineColor: color,
        outlineOffset: "1px",
        cursor: "default",
      }}
    >
      {/* Nome editável */}
      <Box
        component="input"
        value={name}
        autoFocus
        maxLength={MAX_TAG_LENGTH}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
          if (e.key === "Escape") {
            onClose();
          }
        }}
        sx={{
          border: "none",
          outline: "none",
          background: "transparent",
          color: "inherit",
          fontSize: "0.75rem",
          fontFamily: "inherit",
          minWidth: "32px",
          width: `${Math.max(32, name.length * 6.5)}px`,
          maxWidth: "100px",
          p: 0,
        }}
      />
      {/* Color picker direto como círculo — salva via evento 'change' do DOM */}
      <Tooltip title="Mudar cor">
        <ColorPickerDot
          ref={colorInputRef}
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          onMouseDown={(e: React.MouseEvent) => e.preventDefault()}
        />
      </Tooltip>
      {/* Remover da transação */}
      <Box
        component="span"
        onMouseDown={(e: React.MouseEvent) => {
          e.preventDefault();
          onRemove(tag.id);
        }}
        sx={{
          display: "flex",
          alignItems: "center",
          cursor: "pointer",
          flexShrink: 0,
          opacity: 0.5,
          fontSize: "0.6rem",
          lineHeight: 1,
          "&:hover": { opacity: 1 },
        }}
      >
        ✕
      </Box>
    </Box>
  );
}

// ─── State 3: chip de adição ──────────────────────────────────────────────────
function AddChip({
  existingTagIds,
  options,
  onAdd,
  onCancel,
}: {
  existingTagIds: Set<string>;
  options: Tag[];
  onAdd: (name: string, color: string | null) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<string | null>(null);

  const suggestions = options.filter(
    (o) =>
      !existingTagIds.has(o.id) &&
      (name === "" || o.name.toLowerCase().includes(name.toLowerCase())),
  );

  function handleConfirm() {
    if (!name.trim()) {
      onCancel();
      return;
    }
    onAdd(name.trim(), color);
  }

  return (
    <ClickAwayListener onClickAway={onCancel} mouseEvent="onMouseDown">
      <Box component="span" sx={{ position: "relative", display: "inline-flex" }}>
        <Box
          component="span"
          sx={{
            ...chipBase,
            bgcolor: color ? `${color}22` : "background.subtle",
            borderColor: color ?? "divider",
            borderStyle: "dashed",
            color: "text.primary",
          }}
        >
          {/* Input de nome */}
          <Box
            component="input"
            value={name}
            autoFocus
            placeholder="nova tag…"
            maxLength={MAX_TAG_LENGTH}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleConfirm();
              }
              if (e.key === "Escape") {
                onCancel();
              }
            }}
            sx={{
              border: "none",
              outline: "none",
              background: "transparent",
              color: "text.primary",
              fontSize: "0.75rem",
              fontFamily: "inherit",
              p: 0,
              minWidth: "58px",
              width: `${Math.max(58, name.length * 6.5)}px`,
              maxWidth: "120px",
              "&::placeholder": { color: "text.disabled", fontSize: "0.72rem", opacity: 1 },
            }}
          />
          {/* Color picker direto como círculo */}
          <Tooltip title="Escolher cor">
            <ColorPickerDot
              type="color"
              value={color ?? "#6366f1"}
              onChange={(e) => setColor(e.target.value)}
              onMouseDown={(e: React.MouseEvent) => e.preventDefault()}
            />
          </Tooltip>
          {/* Confirmar */}
          <Box
            component="span"
            onMouseDown={(e: React.MouseEvent) => {
              e.preventDefault();
              handleConfirm();
            }}
            sx={{
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
              fontSize: "0.8rem",
              lineHeight: 1,
              cursor: name.trim() ? "pointer" : "default",
              opacity: name.trim() ? 0.65 : 0.25,
              "&:hover": name.trim() ? { opacity: 1 } : undefined,
            }}
          >
            <ArrowCircleRightIcon sx={{ fontSize: 16 }} />
          </Box>
        </Box>
        {/* Dropdown de sugestões */}
        {suggestions.length > 0 && (
          <Paper
            variant="outlined"
            sx={{
              position: "absolute",
              top: "100%",
              left: 0,
              mt: 0.5,
              zIndex: 1400,
              minWidth: 160,
              maxHeight: 180,
              overflow: "auto",
            }}
          >
            {suggestions.map((tag) => (
              <MenuItem
                key={tag.id}
                dense
                onMouseDown={(e: React.MouseEvent) => {
                  e.preventDefault();
                  onAdd(tag.name, tag.color);
                }}
                sx={{ gap: 1, py: 0.5 }}
              >
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    bgcolor: tag.color ?? "action.disabled",
                    flexShrink: 0,
                  }}
                />
                <Typography variant="body2" sx={{ fontSize: "0.8rem" }}>
                  {tag.name}
                </Typography>
              </MenuItem>
            ))}
          </Paper>
        )}
      </Box>
    </ClickAwayListener>
  );
}

// ─── TagEditor (componente principal) ─────────────────────────────────────────
export type TagEditorProps = {
  accountId: string;
  transactionId: string;
  currentTags: Tag[];
  canEdit?: boolean;
  onTagsChange: (tags: Tag[]) => void;
};

export function TagEditor({
  accountId,
  transactionId,
  currentTags,
  canEdit = true,
  onTagsChange,
}: TagEditorProps) {
  const { enqueueSnackbar } = useSnackbar();
  const globalTagUpdate = useTagUpdate();
  const [mode, setMode] = useState<Mode>({ type: "view" });
  const [allOptions, setAllOptions] = useState<Tag[]>([]);
  const [, startTransition] = useTransition();

  useEffect(() => {
    listTagsAction(accountId).then(setAllOptions);
  }, [accountId]);

  function handleAdd(tagName: string, color: string | null) {
    if (currentTags.length >= 10) {
      enqueueSnackbar(m.transactions.tags.limitReached, { variant: "warning" });
      return;
    }
    setMode({ type: "view" });
    startTransition(async () => {
      const result = await addTagToTransactionAction(accountId, {
        transactionId,
        tagName: tagName.trim(),
        color: color ?? undefined,
      });
      if (!result.ok) {
        enqueueSnackbar(result.error.fieldErrors?.tagName ?? result.error.message, {
          variant: "error",
        });
        return;
      }
      const { tagId, tagName: name, tagColor } = result.data;
      if (!currentTags.find((t) => t.id === tagId)) {
        onTagsChange([...currentTags, { id: tagId, name, color: tagColor }]);
      }
      listTagsAction(accountId).then(setAllOptions);
    });
  }

  function handleRemove(tagId: string) {
    setMode({ type: "view" });
    startTransition(async () => {
      const result = await removeTagFromTransactionAction(accountId, { transactionId, tagId });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      onTagsChange(currentTags.filter((t) => t.id !== tagId));
    });
  }

  function handleSaveEdit(tagId: string, name: string, color: string | null) {
    onTagsChange(currentTags.map((t) => (t.id === tagId ? { ...t, name, color } : t)));
    setAllOptions((prev) => prev.map((t) => (t.id === tagId ? { ...t, name, color } : t)));
    // Propaga para todas as linhas da tabela + opções de filtro
    globalTagUpdate?.(tagId, name, color);
  }

  const existingTagIds = new Set(currentTags.map((t) => t.id));

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, alignItems: "center" }}>
      {currentTags.map((tag) => {
        if (mode.type === "edit" && mode.tagId === tag.id) {
          return (
            <EditableChip
              key={tag.id}
              tag={tag}
              accountId={accountId}
              onSave={handleSaveEdit}
              onRemove={handleRemove}
              onClose={() => setMode({ type: "view" })}
            />
          );
        }
        return (
          <StaticChip
            key={tag.id}
            tag={tag}
            canEdit={canEdit}
            onClick={() => setMode({ type: "edit", tagId: tag.id })}
          />
        );
      })}

      {mode.type === "add" ? (
        <AddChip
          existingTagIds={existingTagIds}
          options={allOptions}
          onAdd={handleAdd}
          onCancel={() => setMode({ type: "view" })}
        />
      ) : canEdit && currentTags.length < 10 ? (
        <Box
          component="span"
          onClick={() => setMode({ type: "add" })}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 22,
            height: 22,
            borderRadius: "50%",
            border: "1px dashed",
            borderColor: "divider",
            color: "text.disabled",
            cursor: "pointer",
            fontSize: "0.85rem",
            lineHeight: 1,
            transition: "all 0.15s",
            "&:hover": { borderColor: "text.secondary", color: "text.secondary" },
          }}
        >
          +
        </Box>
      ) : null}
    </Box>
  );
}
