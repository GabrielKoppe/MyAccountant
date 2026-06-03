"use client";

import { useState } from "react";
import { NumericFormat } from "react-number-format";
import Checkbox from "@mui/material/Checkbox";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import { useSnackbar } from "notistack";

import { createTransactionAction } from "@/actions/transactions";
import { reaisToCents } from "@/lib/money";
import { INVESTMENT_TYPES } from "@/lib/schemas/transaction";
import type { InvestmentType } from "@/lib/schemas/transaction";
import type { CategoryOption, HiddenColumns, InstitutionOption, MemberOption, TransactionRow } from "./types";

type Props = {
  tableId: string;
  accountId: string;
  hiddenColumns: HiddenColumns;
  categories: CategoryOption[];
  institutions: InstitutionOption[];
  members: MemberOption[];
  defaultResponsibleUserId: string | null;
  onCreated: (tx: TransactionRow) => void;
  onCancel: () => void;
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function NewTransactionRow({
  tableId,
  accountId,
  hiddenColumns,
  categories,
  institutions,
  members,
  defaultResponsibleUserId,
  onCreated,
  onCancel,
}: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [saving, setSaving] = useState(false);
  const [occurredOn, setOccurredOn] = useState(todayISO());
  const [amountCents, setAmountCents] = useState("0");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [responsibleUserId, setResponsibleUserId] = useState<string | null>(defaultResponsibleUserId);
  const [isPending, setIsPending] = useState(false);
  const [investmentType, setInvestmentType] = useState<InvestmentType | null>(null);

  const subcatsForCategory = categories.find((c) => c.id === categoryId)?.subcategories ?? [];
  const sharedInputProps = { size: "small" as const, variant: "standard" as const };

  async function handleSave() {
    if (saving) return;
    setSaving(true);

    const result = await createTransactionAction(accountId, {
      tableId,
      occurredOn: new Date(occurredOn),
      amountCents: BigInt(amountCents),
      description: description || null,
      isPending,
      isFavorite: false,
      categoryId,
      subcategoryId,
      institutionId,
      responsibleUserId,
      investmentType,
    });

    setSaving(false);

    if (!result.ok) {
      enqueueSnackbar(result.error.message, { variant: "error" });
      return;
    }

    onCreated({
      id: result.data.transactionId,
      occurredOn,
      amountCents,
      description: description || null,
      notes: null,
      isPending,
      isFavorite: false,
      categoryId,
      subcategoryId,
      institutionId,
      institutionText: null,
      responsibleUserId,
      cardInstallment: null,
      investmentType,
      createdById: "",
    });
  }

  return (
    <TableRow
      sx={{ bgcolor: "action.hover" }}
      onKeyDown={(e) => {
        if (e.key === "Enter") handleSave();
        if (e.key === "Escape") onCancel();
      }}
    >
      <TableCell padding="checkbox">
        <Checkbox size="small" disabled />
      </TableCell>

      <TableCell>
        <TextField
          {...sharedInputProps}
          type="date"
          value={occurredOn}
          onChange={(e) => setOccurredOn(e.target.value)}
          inputProps={{ style: { fontSize: 13 } }}
          sx={{ width: 120 }}
          autoFocus
        />
      </TableCell>

      <TableCell>
        <TextField
          {...sharedInputProps}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descrição"
          fullWidth
        />
      </TableCell>

      {!hiddenColumns.category && (
        <TableCell>
          <Select
            {...sharedInputProps}
            value={categoryId ?? ""}
            onChange={(e) => { setCategoryId(e.target.value || null); setSubcategoryId(null); }}
            sx={{ minWidth: 110, fontSize: 13 }}
          >
            <MenuItem value=""><em>Nenhuma</em></MenuItem>
            {categories.map((c) => <MenuItem key={c.id} value={c.id} sx={{ fontSize: 13 }}>{c.name}</MenuItem>)}
          </Select>
        </TableCell>
      )}

      {!hiddenColumns.subcategory && (
        <TableCell>
          <Select
            {...sharedInputProps}
            value={subcategoryId ?? ""}
            onChange={(e) => setSubcategoryId(e.target.value || null)}
            sx={{ minWidth: 110, fontSize: 13 }}
            disabled={!categoryId}
          >
            <MenuItem value=""><em>Nenhuma</em></MenuItem>
            {subcatsForCategory.map((s) => <MenuItem key={s.id} value={s.id} sx={{ fontSize: 13 }}>{s.name}</MenuItem>)}
          </Select>
        </TableCell>
      )}

      {!hiddenColumns.institution && (
        <TableCell>
          <Select
            {...sharedInputProps}
            value={institutionId ?? ""}
            onChange={(e) => setInstitutionId(e.target.value || null)}
            sx={{ minWidth: 110, fontSize: 13 }}
          >
            <MenuItem value=""><em>Nenhuma</em></MenuItem>
            {institutions.map((i) => <MenuItem key={i.id} value={i.id} sx={{ fontSize: 13 }}>{i.name}</MenuItem>)}
          </Select>
        </TableCell>
      )}

      <TableCell align="right">
        <NumericFormat
          customInput={TextField}
          {...sharedInputProps}
          value={0}
          thousandSeparator="."
          decimalSeparator=","
          decimalScale={2}
          fixedDecimalScale
          allowNegative
          onValueChange={({ floatValue }) => setAmountCents(reaisToCents(floatValue ?? 0).toString())}
          inputProps={{ style: { textAlign: "right", width: 100, fontSize: 13 } }}
        />
      </TableCell>

      {!hiddenColumns.responsibleUser && (
        <TableCell>
          <Select
            {...sharedInputProps}
            value={responsibleUserId ?? ""}
            onChange={(e) => setResponsibleUserId(e.target.value || null)}
            sx={{ minWidth: 90, fontSize: 13 }}
          >
            <MenuItem value=""><em>Nenhum</em></MenuItem>
            {members.map((m) => <MenuItem key={m.id} value={m.id} sx={{ fontSize: 13 }}>{m.name ?? m.email}</MenuItem>)}
          </Select>
        </TableCell>
      )}

      {!hiddenColumns.isPending && (
        <TableCell padding="checkbox">
          <Checkbox size="small" checked={isPending} onChange={(e) => setIsPending(e.target.checked)} />
        </TableCell>
      )}

      {!hiddenColumns.investmentType && (
        <TableCell>
          <Select
            {...sharedInputProps}
            value={investmentType ?? ""}
            onChange={(e) => setInvestmentType((e.target.value || null) as InvestmentType | null)}
            sx={{ minWidth: 120, fontSize: 13 }}
          >
            <MenuItem value=""><em>Nenhum</em></MenuItem>
            {INVESTMENT_TYPES.map((t) => (
              <MenuItem key={t} value={t} sx={{ fontSize: 13 }}>{t}</MenuItem>
            ))}
          </Select>
        </TableCell>
      )}

      <TableCell align="right">
        <IconButton size="small" onClick={handleSave} disabled={saving} color="primary" title="Salvar (Enter)">
          ✓
        </IconButton>
        <IconButton size="small" onClick={onCancel} title="Cancelar (Esc)">
          ✕
        </IconButton>
      </TableCell>
    </TableRow>
  );
}
