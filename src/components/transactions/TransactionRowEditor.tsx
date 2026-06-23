"use client";

import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import NoteIcon from "@mui/icons-material/Note";
import NoteOutlinedIcon from "@mui/icons-material/NoteOutlined";
import { NumericFormat } from "react-number-format";

import { m } from "@/lib/messages";
import { centsToReais, reaisToCents } from "@/lib/money";
import { INVESTMENT_TYPES } from "@/lib/schemas/transaction";
import type { InvestmentType } from "@/lib/schemas/transaction";
import type {
  CategoryOption,
  HiddenColumns,
  InstitutionOption,
  MemberOption,
  TransactionRow as TxRow,
} from "./types";

type Props = {
  tx: TxRow;
  editValues: TxRow;
  setEditValues: React.Dispatch<React.SetStateAction<TxRow>>;
  isSelected: boolean;
  notesOpen: boolean;
  setNotesOpen: React.Dispatch<React.SetStateAction<boolean>>;
  focusField: string;
  hiddenColumns: HiddenColumns;
  categories: CategoryOption[];
  institutions: InstitutionOption[];
  members: MemberOption[];
  onSelect: (id: string, checked: boolean) => void;
  onSave: () => void;
  onCancel: () => void;
};

export function TransactionRowEditor({
  tx,
  editValues,
  setEditValues,
  isSelected,
  notesOpen,
  setNotesOpen,
  focusField,
  hiddenColumns,
  categories,
  institutions,
  members,
  onSelect,
  onSave,
  onCancel,
}: Props) {
  const subcatsForCategory =
    categories.find((c) => c.id === editValues.categoryId)?.subcategories ?? [];

  const sharedInputProps = { size: "small" as const, variant: "standard" as const };

  return (
    <>
      <TableRow
        sx={{ bgcolor: "action.selected" }}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSave();
          if (e.key === "Escape") onCancel();
        }}
      >
        <TableCell padding="checkbox">
          <Checkbox
            checked={isSelected}
            onChange={(e) => onSelect(tx.id, e.target.checked)}
            size="small"
          />
        </TableCell>

        {/* Data */}
        <TableCell>
          <TextField
            {...sharedInputProps}
            type="date"
            value={editValues.occurredOn.slice(0, 10)}
            onChange={(e) => setEditValues((prev) => ({ ...prev, occurredOn: e.target.value }))}
            sx={{ width: 120, "& input": { fontSize: 13 } }}
            autoFocus={focusField === "occurredOn"}
          />
        </TableCell>

        {/* Descrição */}
        <TableCell>
          <TextField
            {...sharedInputProps}
            value={editValues.description ?? ""}
            onChange={(e) => setEditValues((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Descrição"
            fullWidth
            autoFocus={focusField === "description"}
            sx={{ "& input": { fontSize: 13 } }}
          />
        </TableCell>

        {/* Categoria */}
        {!hiddenColumns.category && (
          <TableCell>
            <Select
              {...sharedInputProps}
              value={editValues.categoryId ?? ""}
              onChange={(e) =>
                setEditValues((prev) => ({
                  ...prev,
                  categoryId: e.target.value || null,
                  subcategoryId: null,
                }))
              }
              sx={{ minWidth: 110, fontSize: 13 }}
              autoFocus={focusField === "categoryId"}
            >
              <MenuItem value="">
                <em>Nenhuma</em>
              </MenuItem>
              {categories.map((c) => (
                <MenuItem key={c.id} value={c.id} sx={{ fontSize: 13 }}>
                  {c.name}
                </MenuItem>
              ))}
            </Select>
          </TableCell>
        )}

        {/* Subcategoria */}
        {!hiddenColumns.subcategory && (
          <TableCell>
            <Select
              {...sharedInputProps}
              value={editValues.subcategoryId ?? ""}
              onChange={(e) =>
                setEditValues((prev) => ({ ...prev, subcategoryId: e.target.value || null }))
              }
              sx={{ minWidth: 110, fontSize: 13 }}
              disabled={!editValues.categoryId}
              autoFocus={focusField === "subcategoryId"}
            >
              <MenuItem value="">
                <em>Nenhuma</em>
              </MenuItem>
              {subcatsForCategory.map((s) => (
                <MenuItem key={s.id} value={s.id} sx={{ fontSize: 13 }}>
                  {s.name}
                </MenuItem>
              ))}
            </Select>
          </TableCell>
        )}

        {/* Instituição */}
        {!hiddenColumns.institution && (
          <TableCell>
            <Select
              {...sharedInputProps}
              value={editValues.institutionId ?? ""}
              onChange={(e) =>
                setEditValues((prev) => ({ ...prev, institutionId: e.target.value || null }))
              }
              sx={{ minWidth: 110, fontSize: 13 }}
              autoFocus={focusField === "institutionId"}
            >
              <MenuItem value="">
                <em>Nenhuma</em>
              </MenuItem>
              {institutions.map((i) => (
                <MenuItem key={i.id} value={i.id} sx={{ fontSize: 13 }}>
                  {i.name}
                </MenuItem>
              ))}
            </Select>
          </TableCell>
        )}

        {/* Valor */}
        <TableCell align="right">
          <NumericFormat
            customInput={TextField}
            {...sharedInputProps}
            value={centsToReais(BigInt(editValues.amountCents))}
            thousandSeparator="."
            decimalSeparator=","
            decimalScale={2}
            fixedDecimalScale
            allowNegative
            onValueChange={({ floatValue }) => {
              const cents = reaisToCents(floatValue ?? 0);
              setEditValues((prev) => ({ ...prev, amountCents: cents.toString() }));
            }}
            sx={{ "& input": { textAlign: "right", width: 100, fontSize: 13 } }}
            autoFocus={focusField === "amountCents"}
          />
        </TableCell>

        {/* Responsável */}
        {!hiddenColumns.responsibleUser && (
          <TableCell>
            <Select
              {...sharedInputProps}
              value={editValues.responsibleUserId ?? ""}
              onChange={(e) =>
                setEditValues((prev) => ({ ...prev, responsibleUserId: e.target.value || null }))
              }
              sx={{ minWidth: 90, fontSize: 13 }}
              autoFocus={focusField === "responsibleUserId"}
            >
              <MenuItem value="">
                <em>Nenhum</em>
              </MenuItem>
              {members.map((mem) => (
                <MenuItem key={mem.id} value={mem.id} sx={{ fontSize: 13 }}>
                  {mem.name ?? mem.email}
                </MenuItem>
              ))}
            </Select>
          </TableCell>
        )}

        {/* Tipo de investimento */}
        {!hiddenColumns.investmentType && (
          <TableCell>
            <Select
              {...sharedInputProps}
              value={editValues.investmentType ?? ""}
              onChange={(e) =>
                setEditValues((prev) => ({
                  ...prev,
                  investmentType: (e.target.value || null) as InvestmentType | null,
                }))
              }
              sx={{ minWidth: 120, fontSize: 13 }}
              autoFocus={focusField === "investmentType"}
            >
              <MenuItem value="">
                <em>Nenhum</em>
              </MenuItem>
              {INVESTMENT_TYPES.map((t) => (
                <MenuItem key={t} value={t} sx={{ fontSize: 13 }}>
                  {t}
                </MenuItem>
              ))}
            </Select>
          </TableCell>
        )}

        {/* Ações */}
        <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
          <Tooltip
            title={notesOpen ? m.transactions.actions.hideNotes : m.transactions.actions.addNote}
          >
            <IconButton size="small" onClick={() => setNotesOpen((o) => !o)}>
              {notesOpen || (editValues.notes && editValues.notes.length > 0) ? (
                <NoteIcon fontSize="small" />
              ) : (
                <NoteOutlinedIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
          <Tooltip title={m.transactions.actions.save}>
            <IconButton size="small" onClick={onSave} color="primary">
              <CheckIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={m.transactions.actions.cancel}>
            <IconButton size="small" onClick={onCancel}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </TableCell>
      </TableRow>

      {/* Linha de notas colapsável */}
      <TableRow sx={{ bgcolor: "action.selected" }}>
        <TableCell colSpan={99} sx={{ p: 0, border: 0 }}>
          <Collapse in={notesOpen} unmountOnExit>
            <Box sx={{ px: 2, pb: 1.5, pt: 0.5 }}>
              <TextField
                multiline
                minRows={2}
                maxRows={6}
                fullWidth
                size="small"
                variant="standard"
                label={m.transactions.fields.notes}
                placeholder={m.transactions.fields.notesPlaceholder}
                value={editValues.notes ?? ""}
                onChange={(e) =>
                  setEditValues((prev) => ({ ...prev, notes: e.target.value || null }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Escape") onCancel();
                }}
                sx={{ "& textarea": { fontSize: 13 } }}
                autoFocus={focusField === "notes"}
              />
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}
