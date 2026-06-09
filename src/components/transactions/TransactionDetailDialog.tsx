"use client";

import type { ReactNode } from "react";
import type { SectionCountType } from "@prisma/client";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { DialogShell } from "@/components/ui/DialogShell";
import { m } from "@/lib/messages";
import { layout } from "@/lib/design-tokens";
import { formatCentsToBrl } from "@/lib/money";
import { formatDateBr, formatDateTimeInTz } from "@/lib/dates";
import type {
  CategoryOption,
  HiddenColumns,
  InstitutionOption,
  MemberOption,
  TransactionRow as TxRow,
} from "./types";

type Props = {
  open: boolean;
  onClose: () => void;
  tx: TxRow;
  sectionCountType: SectionCountType;
  hiddenColumns: HiddenColumns;
  categories: CategoryOption[];
  institutions: InstitutionOption[];
  members: MemberOption[];
  timezone: string;
  canEdit: boolean;
  onEdit: () => void;
};

/** Linha label (esquerda) + valor (direita), alinhada ao topo. */
function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack direction="row" spacing={layout.stack} alignItems="flex-start">
      <Typography
        variant="caption"
        color="text.tertiary"
        sx={{ width: 112, flexShrink: 0, pt: "3px" }}
      >
        {label}
      </Typography>
      <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
    </Stack>
  );
}

/** Avatar + nome de um membro; usa fallback "Usuário removido" quando não encontrado. */
function MemberInline({ member }: { member: MemberOption | null }) {
  const name = member?.name ?? member?.email ?? m.transactions.detail.removedUser;
  return (
    <Stack direction="row" spacing={layout.inline} alignItems="center">
      <Avatar src={member?.image ?? undefined} sx={{ width: 24, height: 24, fontSize: 11 }}>
        {member?.name?.charAt(0)?.toUpperCase() ?? "?"}
      </Avatar>
      <Typography variant="body2">{name}</Typography>
    </Stack>
  );
}

export function TransactionDetailDialog({
  open,
  onClose,
  tx,
  sectionCountType,
  hiddenColumns,
  categories,
  institutions,
  members,
  timezone,
  canEdit,
  onEdit,
}: Props) {
  const show = (key: string) => !hiddenColumns[key];
  const findMember = (id: string | null) => members.find((mem) => mem.id === id) ?? null;

  const amount = BigInt(tx.amountCents);
  // subtract: positivo = despesa (vermelho), negativo = estorno (verde) — mesma regra da TransactionRow
  const isPositive = sectionCountType === "subtract" ? amount < 0n : amount >= 0n;

  const category = categories.find((c) => c.id === tx.categoryId);
  const subcategory = category?.subcategories.find((s) => s.id === tx.subcategoryId);
  const institutionName = institutions.find((i) => i.id === tx.institutionId)?.name ?? tx.institutionText;
  const responsible = findMember(tx.responsibleUserId);

  const createdBy = findMember(tx.createdById);
  const updatedBy = tx.updatedById ? findMember(tx.updatedById) : null;

  return (
    <DialogShell
      open={open}
      onClose={onClose}
      title={m.transactions.detail.title}
      maxWidth="sm"
      actions={
        <>
          <Button variant="text" onClick={onClose}>
            {m.transactions.detail.close}
          </Button>
          {canEdit && (
            <Button variant="contained" onClick={onEdit}>
              {m.transactions.actions.edit}
            </Button>
          )}
        </>
      }
    >
      <Stack spacing={layout.stack} sx={{ pt: layout.micro }}>
        <DetailField label={m.transactions.fields.occurredOn}>
          <Typography variant="body2">{formatDateBr(tx.occurredOn)}</Typography>
        </DetailField>

        <DetailField label={m.transactions.fields.description}>
          {tx.description ? (
            <Typography variant="body2">{tx.description}</Typography>
          ) : (
            <Typography variant="body2" color="text.disabled">
              —
            </Typography>
          )}
        </DetailField>

        <DetailField label={m.transactions.fields.amount}>
          <Typography
            variant="body2"
            sx={{
              fontFamily: "var(--font-jetbrains-mono), 'JetBrains Mono', monospace",
              fontWeight: 500,
              fontVariantNumeric: "tabular-nums",
              color: isPositive ? "success.main" : "danger.main",
            }}
          >
            {formatCentsToBrl(amount)}
          </Typography>
        </DetailField>

        {show("category") && category && (
          <DetailField label={m.transactions.fields.category}>
            <Typography variant="body2">{category.name}</Typography>
          </DetailField>
        )}

        {show("subcategory") && subcategory && (
          <DetailField label={m.transactions.fields.subcategory}>
            <Typography variant="body2">{subcategory.name}</Typography>
          </DetailField>
        )}

        {show("institution") && institutionName && (
          <DetailField label={m.transactions.fields.institution}>
            <Typography variant="body2">{institutionName}</Typography>
          </DetailField>
        )}

        {show("responsibleUser") && responsible && (
          <DetailField label={m.transactions.fields.responsibleUser}>
            <MemberInline member={responsible} />
          </DetailField>
        )}

        {show("cardInstallment") && tx.cardInstallment && (
          <DetailField label={m.transactions.fields.cardInstallment}>
            <Typography variant="body2">{tx.cardInstallment}</Typography>
          </DetailField>
        )}

        {show("investmentType") && tx.investmentType && (
          <DetailField label={m.transactions.fields.investmentType}>
            <Typography variant="body2">{tx.investmentType}</Typography>
          </DetailField>
        )}

        {show("notes") && tx.notes && (
          <DetailField label={m.transactions.fields.notes}>
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
              {tx.notes}
            </Typography>
          </DetailField>
        )}

        <Divider />

        <Typography variant="overline" color="text.tertiary">
          {m.transactions.detail.history}
        </Typography>

        <DetailField label={m.transactions.detail.createdBy}>
          <MemberInline member={createdBy} />
          <Typography variant="caption" color="text.tertiary" sx={{ display: "block", mt: 0.25, ml: "32px" }}>
            {formatDateTimeInTz(tx.createdAt, timezone)}
          </Typography>
        </DetailField>

        {tx.updatedById && (
          <DetailField label={m.transactions.detail.updatedBy}>
            <MemberInline member={updatedBy} />
            <Typography variant="caption" color="text.tertiary" sx={{ display: "block", mt: 0.25, ml: "32px" }}>
              {formatDateTimeInTz(tx.updatedAt, timezone)}
            </Typography>
          </DetailField>
        )}
      </Stack>
    </DialogShell>
  );
}
