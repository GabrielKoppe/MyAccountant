"use client";

import { type ReactNode, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SectionCountType } from "@prisma/client";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddLinkIcon from "@mui/icons-material/AddLink";
import FlashOnOutlinedIcon from "@mui/icons-material/FlashOnOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import StarIcon from "@mui/icons-material/Star";
import WavesOutlinedIcon from "@mui/icons-material/WavesOutlined";

import { DialogShell } from "@/components/ui/DialogShell";
import { TagDetailEditor } from "@/components/tags/TagDetailEditor";
import { LinkTransactionDialog } from "./LinkTransactionDialog";
import { PartyAvatar } from "./PartyAvatar";
import { m } from "@/lib/messages";
import { layout } from "@/lib/design-tokens";
import { formatCentsToBrl } from "@/lib/money";
import { formatDateBr, formatDateTimeInTz } from "@/lib/dates";
import {
  deleteTransactionLinkAction,
  listLinksForTransactionAction,
} from "@/actions/transaction-links";
import type { TransactionLinkItem } from "@/server/services/transaction-link-service";
import type {
  CategoryOption,
  HiddenColumns,
  InstitutionOption,
  MemberOption,
  ResponsiblePartyOption,
  TransactionRow as TxRow,
} from "./types";

type Props = {
  open: boolean;
  onClose: () => void;
  tx: TxRow;
  accountId: string;
  sectionCountType: SectionCountType;
  hiddenColumns: HiddenColumns;
  categories: CategoryOption[];
  institutions: InstitutionOption[];
  members: MemberOption[];
  parties: ResponsiblePartyOption[];
  timezone: string;
  canEdit: boolean;
  onEdit: () => void;
  onTagsChange?: (tags: TxRow["tags"]) => void;
  onLinkCountChanged?: (newCount: number) => void;
  onViewLinkedTransaction?: (txId: string) => void;
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

/** Avatar (foto/ícone colorido) + nome de uma party responsável (Spec 60). */
function PartyInline({ party }: { party: ResponsiblePartyOption }) {
  return (
    <Stack direction="row" spacing={layout.inline} alignItems="center">
      <PartyAvatar
        kind={party.kind}
        icon={party.icon}
        color={party.color}
        imageUrl={party.imageUrl}
        name={party.name}
        size={24}
      />
      <Typography variant="body2">{party.name}</Typography>
    </Stack>
  );
}

export function TransactionDetailDialog({
  open,
  onClose,
  tx,
  accountId,
  sectionCountType,
  hiddenColumns,
  categories,
  institutions,
  members,
  parties,
  timezone,
  canEdit,
  onEdit,
  onTagsChange,
  onLinkCountChanged,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [links, setLinks] = useState<TransactionLinkItem[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [removingLinkId, setRemovingLinkId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoadingLinks(true);
    startTransition(async () => {
      const res = await listLinksForTransactionAction(accountId, { transactionId: tx.id });
      setLoadingLinks(false);
      if (res.ok) setLinks(res.data);
    });
  }, [open, accountId, tx.id]);

  function handleLinkCreated() {
    startTransition(async () => {
      const res = await listLinksForTransactionAction(accountId, { transactionId: tx.id });
      if (res.ok) {
        setLinks(res.data);
        onLinkCountChanged?.(res.data.length);
      }
    });
  }

  async function handleRemoveLink(linkId: string) {
    setRemovingLinkId(linkId);
    const res = await deleteTransactionLinkAction(accountId, { linkId });
    setRemovingLinkId(null);
    if (!res.ok) return;
    const updated = links.filter((l) => l.id !== linkId);
    setLinks(updated);
    onLinkCountChanged?.(updated.length);
  }
  const show = (key: string) => !hiddenColumns[key];
  const findMember = (id: string | null) => members.find((mem) => mem.id === id) ?? null;

  const amount = BigInt(tx.amountCents);
  // subtract: positivo = despesa (vermelho), negativo = estorno (verde) — mesma regra da TransactionRow
  const isPositive = sectionCountType === "subtract" ? amount < 0n : amount >= 0n;

  const category = categories.find((c) => c.id === tx.categoryId);
  const subcategory = category?.subcategories.find((s) => s.id === tx.subcategoryId);
  const institutionName =
    institutions.find((i) => i.id === tx.institutionId)?.name ?? tx.institutionText;
  const responsibleParty = tx.responsiblePartyId
    ? (parties.find((p) => p.id === tx.responsiblePartyId) ?? null)
    : null;

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

        {/* Moeda estrangeira */}
        {tx.originalCurrency && (
          <DetailField label={m.transactions.foreignCurrency.label}>
            <Typography
              variant="body2"
              sx={{
                fontFamily: "var(--font-jetbrains-mono), 'JetBrains Mono', monospace",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {tx.originalAmountCents && tx.originalAmountCents !== "0"
                ? `${tx.originalCurrency} ${(Number(BigInt(tx.originalAmountCents)) / 100).toFixed(2)}`
                : tx.originalCurrency}
              {tx.exchangeRate ? (
                <Typography component="span" variant="caption" color="text.tertiary">
                  {` · câmbio R$${tx.exchangeRate.toFixed(4)}`}
                </Typography>
              ) : null}
            </Typography>
          </DetailField>
        )}

        {/* Status: Pendente e/ou Favorito */}
        {(tx.isPending || tx.isFavorite) && (
          <DetailField label={m.transactions.detail.status}>
            <Stack direction="row" spacing={0.75} flexWrap="wrap">
              {tx.isPending && (
                <Chip
                  label={m.transactions.fields.isPending}
                  size="small"
                  color="warning"
                  variant="outlined"
                  sx={{ height: 20, fontSize: 11, "& .MuiChip-label": { px: 1 } }}
                />
              )}
              {tx.isFavorite && (
                <Chip
                  icon={<StarIcon sx={{ fontSize: 12 }} />}
                  label={m.transactions.fields.isFavorite}
                  size="small"
                  color="warning"
                  variant="outlined"
                  sx={{
                    height: 20,
                    fontSize: 11,
                    "& .MuiChip-label": { px: 0.75 },
                    "& .MuiChip-icon": { ml: 0.75, mr: -0.25 },
                  }}
                />
              )}
            </Stack>
          </DetailField>
        )}

        {/* Tipo de transação (expenseType) */}
        {tx.expenseType && (
          <DetailField label={m.transactions.fields.expenseType}>
            <Stack direction="row" spacing={0.75} alignItems="center">
              {tx.expenseType === "fixed" && (
                <LockOutlinedIcon sx={{ fontSize: 14, color: "text.tertiary" }} />
              )}
              {tx.expenseType === "variable" && (
                <WavesOutlinedIcon sx={{ fontSize: 14, color: "text.tertiary" }} />
              )}
              {tx.expenseType === "one_time" && (
                <FlashOnOutlinedIcon sx={{ fontSize: 14, color: "text.tertiary" }} />
              )}
              <Typography variant="body2">{m.transactions.expenseTypes[tx.expenseType]}</Typography>
            </Stack>
          </DetailField>
        )}

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

        {show("responsibleUser") && responsibleParty && (
          <DetailField label={m.transactions.fields.responsibleUser}>
            <PartyInline party={responsibleParty} />
          </DetailField>
        )}

        {show("cardInstallment") && tx.cardInstallment && (
          <DetailField label={m.transactions.fields.cardInstallment}>
            <Typography variant="body2">{tx.cardInstallment}</Typography>
          </DetailField>
        )}

        {/* Parcelamento real (InstallmentGroup) */}
        {tx.installmentGroupId && tx.installmentNumber && tx.installmentGroupCount && (
          <DetailField label={m.transactions.installments.column}>
            <Typography variant="body2">
              {m.transactions.installments.badge(tx.installmentNumber, tx.installmentGroupCount)}
            </Typography>
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

        {/* Tags */}
        <TagDetailEditor
          accountId={accountId}
          transactionId={tx.id}
          currentTags={tx.tags}
          canEdit={canEdit}
          onTagsChange={(tags) => onTagsChange?.(tags)}
        />

        <Divider />

        <Typography variant="overline" color="text.tertiary">
          {m.transactions.detail.history}
        </Typography>

        <DetailField label={m.transactions.fields.source}>
          <Typography variant="body2" color="text.secondary">
            {m.transactions.sources[tx.source] ?? tx.source}
          </Typography>
        </DetailField>

        <DetailField label={m.transactions.detail.createdBy}>
          <MemberInline member={createdBy} />
          <Typography
            variant="caption"
            color="text.tertiary"
            sx={{ display: "block", mt: 0.25, ml: "32px" }}
          >
            {formatDateTimeInTz(tx.createdAt, timezone)}
          </Typography>
        </DetailField>

        {tx.updatedById && (
          <DetailField label={m.transactions.detail.updatedBy}>
            <MemberInline member={updatedBy} />
            <Typography
              variant="caption"
              color="text.tertiary"
              sx={{ display: "block", mt: 0.25, ml: "32px" }}
            >
              {formatDateTimeInTz(tx.updatedAt, timezone)}
            </Typography>
          </DetailField>
        )}

        {/* Vínculos */}
        <Divider />
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="overline" color="text.tertiary">
            {m.transactions.links.title}
          </Typography>
          {canEdit && (
            <IconButton size="small" onClick={() => setLinkDialogOpen(true)} sx={{ p: 0.5 }}>
              <AddLinkIcon sx={{ fontSize: 14 }} />
            </IconButton>
          )}
        </Stack>

        {loadingLinks ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
            <CircularProgress size={20} />
          </Box>
        ) : links.length === 0 ? (
          <Typography variant="body2" color="text.disabled" sx={{ fontSize: 12 }}>
            {m.transactions.links.empty}
          </Typography>
        ) : (
          <Stack spacing={1}>
            {links.map((link) => (
              <Box
                key={link.id}
                sx={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 1,
                  p: 2,
                  bgcolor: "background.subtle",
                  borderRadius: 1,
                  border: 1,
                  borderColor: "border.subtle",
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="caption" color="text.tertiary" display="block">
                    {m.transactions.links.types[link.type]}
                  </Typography>
                  <Typography variant="body2" fontWeight={500} noWrap>
                    {link.linkedTransaction.description ?? "—"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDateBr(link.linkedTransaction.occurredOn)} ·{" "}
                    <Typography
                      component="span"
                      variant="caption"
                      sx={{ fontFamily: "var(--font-jetbrains-mono), monospace" }}
                    >
                      {formatCentsToBrl(BigInt(link.linkedTransaction.amountCents))}
                    </Typography>
                  </Typography>
                  {link.notes && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                      sx={{ mt: 0.25, fontStyle: "italic" }}
                    >
                      {link.notes}
                    </Typography>
                  )}
                </Box>
                {canEdit && (
                  <IconButton
                    size="small"
                    sx={{ p: 0.5, flexShrink: 0 }}
                    onClick={() => handleRemoveLink(link.id)}
                    disabled={removingLinkId === link.id}
                  >
                    {removingLinkId === link.id ? (
                      <CircularProgress size={14} />
                    ) : (
                      <RemoveCircleOutlineIcon sx={{ fontSize: 14, color: "error.main" }} />
                    )}
                  </IconButton>
                )}
                <IconButton
                  size="small"
                  sx={{ p: 0.5, flexShrink: 0 }}
                  title="Ir para o mês e seção desta transação"
                  onClick={() => {
                    onClose();
                    router.push(
                      `/${accountId}/months/${link.linkedTransaction.monthId}?tab=${link.linkedTransaction.sectionId}`,
                    );
                  }}
                >
                  <OpenInNewIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                </IconButton>
              </Box>
            ))}
          </Stack>
        )}
      </Stack>

      <LinkTransactionDialog
        open={linkDialogOpen}
        onClose={() => setLinkDialogOpen(false)}
        accountId={accountId}
        transactionId={tx.id}
        onLinked={handleLinkCreated}
      />
    </DialogShell>
  );
}
