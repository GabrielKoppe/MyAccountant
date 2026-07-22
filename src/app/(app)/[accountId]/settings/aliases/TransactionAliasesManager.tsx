"use client";

import AddIcon from "@mui/icons-material/Add";
import ArchiveIcon from "@mui/icons-material/Archive";
import ArrowRightAltRoundedIcon from "@mui/icons-material/ArrowRightAltRounded";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import UnarchiveIcon from "@mui/icons-material/Unarchive";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { AliasPriority } from "@prisma/client";
import { useSnackbar } from "notistack";
import { useEffect, useMemo, useState, useTransition } from "react";

import {
  createCategoryAction,
  createInstitutionAction,
  createSubcategoryAction,
} from "@/actions/account-settings";
import {
  archiveTransactionAliasAction,
  deleteTransactionAliasAction,
} from "@/actions/transaction-aliases";
import PageSettingsContainer from "@/components/settings/PageSettingsContainer";
import { tagChipSx } from "@/components/tags/tagChipSx";
import { TransactionAliasFormDialog } from "@/components/transactions/aliases/TransactionAliasFormDialog";
import type {
  CategoryOption,
  InstitutionOption,
  ResponsiblePartyOption,
} from "@/components/transactions/types";
import { DialogShell } from "@/components/ui/DialogShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { MoneyValue } from "@/components/ui/MoneyValue";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  expenseTypeLabel,
  favoriteLabel,
  foreignCurrencyDisplay,
  paymentMethodLabel,
  pendingLabel,
} from "@/lib/aliases/apply";
import { layout, motion } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import type { CreateTransactionAliasInput } from "@/lib/schemas/transaction-alias";
import type { SerializedTransactionAlias } from "@/lib/serializers/transaction-alias";

type TagOption = { id: string; name: string; color: string | null };

type Props = {
  accountId: string;
  currentUserId: string;
  initialAliases: SerializedTransactionAlias[];
  categories: CategoryOption[];
  institutions: InstitutionOption[];
  parties: ResponsiblePartyOption[];
  tags: TagOption[];
};

const ta = m.settings.transactionAliases;

// Rótulo amigável da prioridade (badge da linha) — a ordem de desempate entre
// apelidos concorrentes (spec 50/61) nunca é exposta como número, só Alta/Média/Baixa.
const PRIORITY_LABEL: Record<AliasPriority, string> = {
  high: ta.priorityHigh,
  medium: ta.priorityMedium,
  low: ta.priorityLow,
};

// Reconstrói o registro exibido a partir do payload do form + listas de opções já
// carregadas na página — evita um round-trip só para atualizar a lista local
// (mesmo padrão de merge otimista das demais Managers de Configurações).
function toDisplayAlias(
  id: string,
  values: CreateTransactionAliasInput,
  meta: { isArchived: boolean; createdById: string; createdAt: string; updatedAt: string },
  categories: CategoryOption[],
  institutions: InstitutionOption[],
  parties: ResponsiblePartyOption[],
  tags: TagOption[],
): SerializedTransactionAlias {
  const category = categories.find((c) => c.id === values.categoryId);
  const subcategory = category?.subcategories.find((s) => s.id === values.subcategoryId);
  const institution = institutions.find((i) => i.id === values.institutionId);
  const conditionInstitution = institutions.find((i) => i.id === values.conditionInstitutionId);
  const party = parties.find((p) => p.id === values.responsiblePartyId);

  return {
    id,
    trigger: values.trigger,
    triggerNormalized: values.trigger.trim().toLowerCase(),
    triggerMode: values.triggerMode,
    priority: values.priority,
    conditionInstitutionId: values.conditionInstitutionId ?? null,
    conditionInstitutionName: conditionInstitution?.name ?? null,
    minCents: values.minCents != null ? values.minCents.toString() : null,
    maxCents: values.maxCents != null ? values.maxCents.toString() : null,
    description: values.description ?? null,
    notes: values.notes ?? null,
    amountCents: values.amountCents != null ? values.amountCents.toString() : null,
    categoryId: values.categoryId ?? null,
    categoryName: category?.name ?? null,
    subcategoryId: values.subcategoryId ?? null,
    subcategoryName: subcategory?.name ?? null,
    institutionId: values.institutionId ?? null,
    institutionName: institution?.name ?? null,
    institutionText: values.institutionText ?? null,
    responsiblePartyId: values.responsiblePartyId ?? null,
    responsiblePartyName: party?.name ?? null,
    expenseType: values.expenseType ?? null,
    paymentMethod: values.paymentMethod ?? null,
    investmentType: values.investmentType ?? null,
    cardInstallment: values.cardInstallment ?? null,
    isPending: values.isPending ?? null,
    isFavorite: values.isFavorite ?? null,
    originalCurrency: values.originalCurrency ?? null,
    originalAmountCents:
      values.originalAmountCents != null ? values.originalAmountCents.toString() : null,
    exchangeRate: values.exchangeRate ?? null,
    isArchived: meta.isArchived,
    createdById: meta.createdById,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    tags: tags.filter((t) => values.tagIds.includes(t.id)).map((t) => ({ id: t.id, name: t.name })),
  };
}

type AliasDetailEntry = { label: string; value: string };

// Tudo que o apelido define além do essencial (gatilho/descrição/valor) —
// fica escondido atrás do colapso da linha (ver render), em vez de jogado
// solto como chips no corpo do Paper.
function aliasDetailEntries(alias: SerializedTransactionAlias): AliasDetailEntry[] {
  const entries: AliasDetailEntry[] = [];
  if (alias.categoryName) {
    entries.push({
      label: m.transactions.fields.category,
      value: alias.subcategoryName
        ? `${alias.categoryName} › ${alias.subcategoryName}`
        : alias.categoryName,
    });
  }
  if (alias.institutionName || alias.institutionText) {
    entries.push({
      label: m.transactions.fields.institution,
      value: alias.institutionName ?? alias.institutionText ?? "",
    });
  }
  if (alias.responsiblePartyName) {
    entries.push({
      label: m.transactions.fields.responsibleUser,
      value: alias.responsiblePartyName,
    });
  }
  if (alias.expenseType) {
    entries.push({
      label: m.transactions.fields.expenseType,
      value: expenseTypeLabel(alias.expenseType),
    });
  }
  if (alias.paymentMethod) {
    entries.push({
      label: m.transactions.fields.paymentMethod,
      value: paymentMethodLabel(alias.paymentMethod),
    });
  }
  if (alias.investmentType) {
    entries.push({ label: m.transactions.fields.investmentType, value: alias.investmentType });
  }
  if (alias.cardInstallment) {
    entries.push({ label: m.transactions.fields.cardInstallment, value: alias.cardInstallment });
  }
  if (alias.isPending !== null) {
    entries.push({ label: m.transactions.fields.isPending, value: pendingLabel(alias.isPending) });
  }
  if (alias.isFavorite !== null) {
    entries.push({
      label: m.transactions.fields.isFavorite,
      value: favoriteLabel(alias.isFavorite),
    });
  }
  const fxDisplay = foreignCurrencyDisplay(alias);
  if (fxDisplay !== null) {
    entries.push({ label: m.transactions.foreignCurrency.label, value: fxDisplay });
  }
  return entries;
}

export function TransactionAliasesManager({
  accountId,
  currentUserId,
  initialAliases,
  categories: initialCategories,
  institutions: initialInstitutions,
  parties,
  tags,
}: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [aliases, setAliases] = useState(initialAliases);
  const [isPending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SerializedTransactionAlias | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<SerializedTransactionAlias | null>(null);

  // Criação inline de opções no modal (DD-26). O dono da lista é a Manager: o
  // callback cria no server e injeta no state local, então a opção nova aparece
  // no seletor e o `toDisplayAlias` resolve o nome após salvar. Mesmo padrão do
  // TransactionTable. Viewer nunca chega aqui (redirect na page), logo criar é ok.
  const [categories, setCategories] = useState(initialCategories);
  const [institutions, setInstitutions] = useState(initialInstitutions);

  // O server continua sendo fonte da verdade — quando a prop mudar (revalidação
  // após a action de criação, ou navegação), realinha o state local. Mesmo padrão
  // de TransactionTable.tsx:163-171.
  useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);
  useEffect(() => {
    setInstitutions(initialInstitutions);
  }, [initialInstitutions]);

  async function onCreateCategory(name: string): Promise<string | null> {
    const res = await createCategoryAction(accountId, { name });
    if (!res.ok) {
      enqueueSnackbar(res.error.message || m.transactions.options.createError, { variant: "error" });
      return null;
    }
    setCategories((prev) =>
      [...prev, { id: res.data.categoryId, name, subcategories: [] }].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    );
    enqueueSnackbar(m.transactions.options.created, { variant: "success" });
    return res.data.categoryId;
  }

  async function onCreateSubcategory(categoryId: string, name: string): Promise<string | null> {
    const res = await createSubcategoryAction(accountId, { categoryId, name });
    if (!res.ok) {
      enqueueSnackbar(res.error.message || m.transactions.options.createError, { variant: "error" });
      return null;
    }
    setCategories((prev) =>
      prev.map((c) =>
        c.id === categoryId
          ? {
              ...c,
              subcategories: [...c.subcategories, { id: res.data.subcategoryId, name }].sort(
                (a, b) => a.name.localeCompare(b.name),
              ),
            }
          : c,
      ),
    );
    enqueueSnackbar(m.transactions.options.created, { variant: "success" });
    return res.data.subcategoryId;
  }

  async function onCreateInstitution(name: string): Promise<string | null> {
    const res = await createInstitutionAction(accountId, { name });
    if (!res.ok) {
      enqueueSnackbar(res.error.message || m.transactions.options.createError, { variant: "error" });
      return null;
    }
    setInstitutions((prev) =>
      [...prev, { id: res.data.institutionId, name }].sort((a, b) => a.name.localeCompare(b.name)),
    );
    enqueueSnackbar(m.transactions.options.created, { variant: "success" });
    return res.data.institutionId;
  }

  const tagColorById = useMemo(() => new Map(tags.map((t) => [t.id, t.color])), [tags]);

  function openCreate() {
    setEditTarget(undefined);
    setFormOpen(true);
  }

  function openEdit(alias: SerializedTransactionAlias) {
    setEditTarget(alias);
    setFormOpen(true);
  }

  function handleFormSuccess(values: CreateTransactionAliasInput, aliasId: string) {
    const now = new Date().toISOString();
    setAliases((prev) => {
      const existing = prev.find((a) => a.id === aliasId);
      const next = toDisplayAlias(
        aliasId,
        values,
        {
          isArchived: existing?.isArchived ?? false,
          createdById: existing?.createdById ?? currentUserId,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        },
        categories,
        institutions,
        parties,
        tags,
      );
      const withoutTarget = prev.filter((a) => a.id !== aliasId);
      return [...withoutTarget, next].sort((a, b) => a.trigger.localeCompare(b.trigger));
    });
  }

  function handleArchive(alias: SerializedTransactionAlias) {
    startTransition(async () => {
      const result = await archiveTransactionAliasAction(accountId, {
        aliasId: alias.id,
        archived: !alias.isArchived,
      });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      setAliases((prev) =>
        prev.map((a) => (a.id === alias.id ? { ...a, isArchived: !a.isArchived } : a)),
      );
      enqueueSnackbar(alias.isArchived ? ta.unarchived : ta.archived, { variant: "success" });
    });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    startTransition(async () => {
      const result = await deleteTransactionAliasAction(accountId, { aliasId: target.id });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      setAliases((prev) => prev.filter((a) => a.id !== target.id));
      enqueueSnackbar(ta.deleted, { variant: "success" });
    });
  }

  return (
    <PageSettingsContainer
      title={ta.title}
      secondary={
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreate}>
          {ta.createButton}
        </Button>
      }
    >
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {ta.subtitle}
      </Typography>

      {aliases.length === 0 ? (
        <EmptyState title={ta.empty} description={ta.emptyHint} />
      ) : (
        <Stack spacing={1}>
          {aliases.map((alias) => (
            <AliasRow
              key={alias.id}
              alias={alias}
              tagColorById={tagColorById}
              isPending={isPending}
              onEdit={() => openEdit(alias)}
              onArchive={() => handleArchive(alias)}
              onDelete={() => setDeleteTarget(alias)}
            />
          ))}
        </Stack>
      )}

      <TransactionAliasFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        accountId={accountId}
        categories={categories}
        institutions={institutions}
        parties={parties}
        tags={tags}
        alias={editTarget}
        onCreateCategory={onCreateCategory}
        onCreateSubcategory={onCreateSubcategory}
        onCreateInstitution={onCreateInstitution}
        canCreateOptions
        onSuccess={handleFormSuccess}
      />

      <DialogShell
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        maxWidth="xs"
        title={ta.deleteTitle}
        description={ta.deleteConfirm}
        actions={
          <>
            <Button size="small" onClick={() => setDeleteTarget(null)}>
              {m.common.cancel}
            </Button>
            <Button size="small" color="error" variant="contained" onClick={confirmDelete}>
              {m.common.delete}
            </Button>
          </>
        }
      />
    </PageSettingsContainer>
  );
}

type AliasRowProps = {
  alias: SerializedTransactionAlias;
  tagColorById: Map<string, string | null>;
  isPending: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
};

// Uma linha = resumo sempre visível (gatilho, status de arquivo, valor,
// ações) + um colapso único com tudo que o apelido define (classificação,
// tags, notas) — em vez de chips/badges soltos competindo por atenção.
function AliasRow({ alias, tagColorById, isPending, onEdit, onArchive, onDelete }: AliasRowProps) {
  const [expanded, setExpanded] = useState(false);
  const details = useMemo(() => aliasDetailEntries(alias), [alias]);
  const hasAmount = alias.amountCents !== null;
  const hiddenCount =
    details.length + (hasAmount ? 1 : 0) + (alias.tags.length > 0 ? 1 : 0) + (alias.notes ? 1 : 0);
  const canExpand = hiddenCount > 0;
  // Nome acessível da regra (gatilho → descrição) — o token/seta visuais são
  // aria-hidden, então este texto é a única forma como o leitor de tela
  // anuncia a identidade do apelido.
  const ruleAria = alias.description
    ? ta.transformAria(alias.trigger, alias.description)
    : alias.trigger;

  return (
    <Paper variant="outlined" sx={{ overflow: "hidden" }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          gap: layout.inline,
          p: layout.inline,
        }}
      >
        <Box
          component={canExpand ? "button" : "div"}
          type={canExpand ? "button" : undefined}
          onClick={canExpand ? () => setExpanded((v) => !v) : undefined}
          aria-expanded={canExpand ? expanded : undefined}
          aria-label={
            canExpand
              ? `${ruleAria}. ${expanded ? ta.hideDetailsAria : ta.showDetailsAria}`
              : undefined
          }
          sx={{
            flex: 1,
            minWidth: 0,
            display: "block",
            textAlign: "left",
            border: 0,
            m: 0,
            p: 0,
            bgcolor: "transparent",
            font: "inherit",
            color: "inherit",
            borderRadius: 1,
            ...(canExpand && {
              cursor: "pointer",
              "&:hover": { bgcolor: "background.subtle" },
              "&:focus-visible": { outline: 2, outlineColor: "border.focus", outlineOffset: 2 },
            }),
          }}
        >
          {/* Regra de transformação: [gatilho] → descrição resultante. O gatilho
              é um token literal (mono, como código) que, ao casar, vira a
              descrição à direita. Sem descrição → seta aponta para "mantém a
              descrição", então toda linha se lê como uma regra. */}
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
            <Box
              component="span"
              sx={{
                flexShrink: 0,
                maxWidth: "60%",
                fontFamily: "var(--font-jetbrains-mono), monospace",
                fontSize: "0.8125rem",
                fontWeight: 500,
                color: "text.primary",
                bgcolor: "background.subtle",
                border: 1,
                borderColor: "border.default",
                borderRadius: 0.5,
                px: 2,
                py: 0.25,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {alias.trigger}
            </Box>
            <ArrowRightAltRoundedIcon
              aria-hidden
              sx={{ fontSize: 18, color: "text.tertiary", flexShrink: 0 }}
            />
            {alias.description ? (
              <Typography
                variant="kpi"
                fontWeight={400}
                fontSize="0.8rem"
                color="text.primary"
                noWrap
                sx={{ minWidth: 0 }}
              >
                {alias.description}
              </Typography>
            ) : (
              <Typography
                variant="caption"
                color="text.tertiary"
                noWrap
                sx={{ minWidth: 0, fontStyle: "italic" }}
              >
                {ta.keepsDescription}
              </Typography>
            )}
            <Box sx={{ flexShrink: 0, display: "inline-flex" }}>
              <StatusBadge variant="neutral">{PRIORITY_LABEL[alias.priority]}</StatusBadge>
            </Box>
            {alias.isArchived && (
              <Box sx={{ flexShrink: 0, display: "inline-flex" }}>
                <StatusBadge variant="neutral">{ta.archivedBadge}</StatusBadge>
              </Box>
            )}
          </Stack>
          {canExpand && (
            <Stack
              direction="row"
              spacing={0.5}
              alignItems="center"
              sx={{ mt: layout.micro, ml: layout.micro }}
            >
              <Typography variant="caption" color="text.secondary">
                {ta.detailsToggle(hiddenCount)}
              </Typography>
              <ExpandMoreIcon
                sx={{
                  fontSize: 14,
                  color: "text.tertiary",
                  transform: expanded ? "rotate(180deg)" : "none",
                  transition: `transform ${motion.duration.normal}ms ${motion.easing.standard}`,
                }}
              />
            </Stack>
          )}
        </Box>

        <Stack direction="row" spacing={0.25} alignItems="center" sx={{ flexShrink: 0 }}>
          <Tooltip title={m.common.edit}>
            <IconButton size="small" aria-label={m.common.edit} onClick={onEdit}>
              <EditIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title={alias.isArchived ? ta.unarchive : ta.archive}>
            <IconButton
              size="small"
              aria-label={alias.isArchived ? ta.unarchive : ta.archive}
              onClick={onArchive}
              disabled={isPending}
            >
              {alias.isArchived ? (
                <UnarchiveIcon sx={{ fontSize: 16 }} />
              ) : (
                <ArchiveIcon sx={{ fontSize: 16 }} />
              )}
            </IconButton>
          </Tooltip>
          <Tooltip title={m.common.delete}>
            <IconButton
              size="small"
              color="error"
              aria-label={m.common.delete}
              onClick={onDelete}
              disabled={isPending}
            >
              <DeleteIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {canExpand && (
        <Collapse
          in={expanded}
          timeout={{ enter: motion.duration.slow, exit: motion.duration.fast }}
          easing={{ enter: motion.easing.entrance, exit: motion.easing.exit }}
        >
          <Box
            sx={{
              px: layout.stack,
              pb: layout.stack,
              opacity: expanded ? 1 : 0,
              transition: expanded
                ? `opacity ${motion.duration.normal}ms ${motion.easing.standard} ${motion.duration.fast}ms`
                : `opacity ${motion.duration.fast}ms ${motion.easing.exit}`,
            }}
          >
            <Divider sx={{ mb: layout.stack }} />

            {alias.amountCents !== null && (
              <Box sx={{ mb: layout.stack }}>
                <Typography variant="caption" color="text.tertiary" component="div">
                  {m.transactions.fields.amount}
                </Typography>
                <MoneyValue cents={BigInt(alias.amountCents)} />
              </Box>
            )}

            {details.length > 0 && (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
                  columnGap: layout.stack,
                  rowGap: layout.inline,
                }}
              >
                {details.map((entry, i) => (
                  <Box
                    key={entry.label}
                    sx={
                      i === details.length - 1 && details.length % 2 !== 0
                        ? { gridColumn: { sm: "span 2" } }
                        : undefined
                    }
                  >
                    <Typography variant="caption" color="text.tertiary" component="div">
                      {entry.label}
                    </Typography>
                    <Typography variant="body2">{entry.value}</Typography>
                  </Box>
                ))}
              </Box>
            )}

            {alias.tags.length > 0 && (
              <Box sx={{ mt: layout.stack }}>
                <Typography
                  variant="caption"
                  color="text.tertiary"
                  component="div"
                  sx={{ mb: 0.5 }}
                >
                  {m.transactions.fields.tags}
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ rowGap: 0.5 }}>
                  {alias.tags.map((tag) => (
                    <Chip
                      key={tag.id}
                      size="small"
                      label={tag.name}
                      sx={tagChipSx(tagColorById.get(tag.id) ?? null)}
                    />
                  ))}
                </Stack>
              </Box>
            )}

            {alias.notes && (
              <Box sx={{ mt: layout.stack }}>
                <Typography variant="caption" color="text.tertiary" component="div">
                  {m.transactions.fields.notes}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                  {alias.notes}
                </Typography>
              </Box>
            )}
          </Box>
        </Collapse>
      )}
    </Paper>
  );
}
