"use client";

import AutoFixHighOutlinedIcon from "@mui/icons-material/AutoFixHighOutlined";
import FlashOnOutlinedIcon from "@mui/icons-material/FlashOnOutlined";
import LabelOutlinedIcon from "@mui/icons-material/LabelOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import WavesOutlinedIcon from "@mui/icons-material/WavesOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { SectionCountType } from "@prisma/client";
import { useSnackbar } from "notistack";
import { memo, useEffect, useMemo, useRef, useState } from "react";

import { listTagsAction } from "@/actions/tags";
import { duplicateTransactionAction, updateTransactionAction } from "@/actions/transactions";
import { InstallmentGroupPanel } from "@/components/installments/InstallmentGroupPanel";
import { tagChipSx } from "@/components/tags/tagChipSx";
import { TagPopover } from "@/components/tags/TagPopover";
import {
  aliasPatchToUpdateInput,
  computeAliasApplication,
  type AliasPatch,
} from "@/lib/aliases/apply";
import { matchAlias } from "@/lib/aliases/match";
import { formatDateShort } from "@/lib/dates";
import { m } from "@/lib/messages";
import { formatCentsToBrl } from "@/lib/money";
import type { CreateTransactionAliasInput } from "@/lib/schemas/transaction-alias";
import type { SerializedTransactionAlias } from "@/lib/serializers/transaction-alias";

import { AliasSuggestionPopover } from "./aliases/AliasSuggestionPopover";
import { TransactionAliasFormDialog } from "./aliases/TransactionAliasFormDialog";
import { LinkTransactionDialog } from "./LinkTransactionDialog";
import { useOptions } from "./OptionsContext";
import { PartyAvatar } from "./PartyAvatar";
import { TransactionRowActions } from "./TransactionRowActions";
import { TransactionRowEditor } from "./TransactionRowEditor";
import type {
  CategoryOption,
  HiddenColumns,
  InstitutionOption,
  MemberOption,
  ResponsiblePartyOption,
  TransactionRow as TxRow,
} from "./types";

type Props = {
  tx: TxRow;
  accountId: string;
  currentUserId: string;
  isSelected: boolean;
  isReadOnly: boolean;
  sectionCountType: SectionCountType;
  hiddenColumns: HiddenColumns;
  categories: CategoryOption[];
  institutions: InstitutionOption[];
  members: MemberOption[];
  parties: ResponsiblePartyOption[];
  aliases: SerializedTransactionAlias[];
  autoEdit: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onOptimisticUpdate: (id: string, patch: Partial<TxRow>) => void;
  onDeleteRequested: (id: string) => void;
  onDuplicated: (newTx: TxRow, sourceId: string) => void;
  onViewDetails: (id: string) => void;
  onAutoEditConsumed: () => void;
};

export function TransactionRowBase({
  tx,
  accountId,
  currentUserId,
  isSelected,
  isReadOnly,
  sectionCountType,
  hiddenColumns,
  categories,
  institutions,
  members,
  parties,
  aliases,
  autoEdit,
  onSelect,
  onOptimisticUpdate,
  onDeleteRequested,
  onDuplicated,
  onViewDetails,
  onAutoEditConsumed,
}: Props) {
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const { onCreateCategory, onCreateSubcategory, onCreateInstitution, canManageOptions } =
    useOptions();
  const [editing, setEditing] = useState(false);
  const [focusField, setFocusField] = useState("occurredOn");
  const [editValues, setEditValues] = useState<TxRow>(tx);
  const [_saving, setSaving] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [tagAnchor, setTagAnchor] = useState<HTMLElement | null>(null);
  const [localTags, setLocalTags] = useState(tx.tags);
  const [installmentPanelOpen, setInstallmentPanelOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [aliasDialogOpen, setAliasDialogOpen] = useState(false);
  const [aliasPrefill, setAliasPrefill] = useState<Omit<
    Partial<CreateTransactionAliasInput>,
    "trigger"
  > | null>(null);
  // Inicia com as tags já aplicadas na transação (evita "sumir" chips enquanto
  // a lista completa da Account carrega) — listTagsAction só complementa depois.
  const [aliasTags, setAliasTags] = useState<{ id: string; name: string; color: string | null }[]>(
    tx.tags,
  );
  // Sugestão de apelido no MODO VISUALIZAÇÃO (DD-23) — anchor do popover na descrição.
  const [aliasAnchorEl, setAliasAnchorEl] = useState<HTMLElement | null>(null);
  const tagCellRef = useRef<HTMLTableCellElement>(null);

  const amount = BigInt(tx.amountCents);
  const isPositive = sectionCountType === "subtract" ? amount < 0n : amount >= 0n;

  function startEdit(field = "occurredOn") {
    if (isReadOnly) return;
    setEditValues(tx);
    setFocusField(field);
    setNotesOpen(false);
    setEditing(true);
  }

  useEffect(() => {
    if (autoEdit) {
      startEdit();
      onAutoEditConsumed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoEdit]);

  // Sync localTags quando a prop tx.tags muda (ex: bulk tag)
  useEffect(() => {
    setLocalTags(tx.tags);
  }, [tx.tags]);

  function startEditWithNote(e: React.MouseEvent) {
    e.stopPropagation();
    if (isReadOnly) return;
    setEditValues(tx);
    setFocusField("notes");
    setNotesOpen(true);
    setEditing(true);
  }

  async function saveEdit() {
    if (!editing) return;
    setEditing(false);
    setSaving(true);

    const patch: Partial<TxRow> = {};
    const fields = Object.keys(editValues) as (keyof TxRow)[];
    for (const k of fields) {
      if (editValues[k] !== tx[k]) (patch as Record<string, unknown>)[k] = editValues[k];
    }

    if (Object.keys(patch).length === 0) {
      setSaving(false);
      return;
    }

    onOptimisticUpdate(tx.id, patch);

    const result = await updateTransactionAction(accountId, {
      transactionId: tx.id,
      ...(editValues.occurredOn !== tx.occurredOn && {
        occurredOn: new Date(editValues.occurredOn),
      }),
      ...(editValues.amountCents !== tx.amountCents && {
        amountCents: BigInt(editValues.amountCents),
      }),
      ...(editValues.description !== tx.description && { description: editValues.description }),
      ...(editValues.categoryId !== tx.categoryId && { categoryId: editValues.categoryId }),
      ...(editValues.subcategoryId !== tx.subcategoryId && {
        subcategoryId: editValues.subcategoryId,
      }),
      ...(editValues.institutionId !== tx.institutionId && {
        institutionId: editValues.institutionId,
      }),
      ...(editValues.responsiblePartyId !== tx.responsiblePartyId && {
        responsiblePartyId: editValues.responsiblePartyId,
      }),
      ...(editValues.isPending !== tx.isPending && { isPending: editValues.isPending }),
      ...(editValues.isFavorite !== tx.isFavorite && { isFavorite: editValues.isFavorite }),
      ...(editValues.investmentType !== tx.investmentType && {
        investmentType: editValues.investmentType,
      }),
      ...(editValues.expenseType !== tx.expenseType && {
        expenseType: editValues.expenseType,
      }),
      ...(editValues.paymentMethod !== tx.paymentMethod && {
        paymentMethod: editValues.paymentMethod,
      }),
      ...(editValues.notes !== tx.notes && { notes: editValues.notes }),
      ...(editValues.originalCurrency !== tx.originalCurrency && {
        originalCurrency: editValues.originalCurrency,
      }),
      ...(editValues.exchangeRate !== tx.exchangeRate && {
        exchangeRate: editValues.exchangeRate,
      }),
      ...(editValues.originalAmountCents !== tx.originalAmountCents && {
        originalAmountCents:
          editValues.originalAmountCents !== null ? BigInt(editValues.originalAmountCents) : null,
      }),
    });

    setSaving(false);
    if (!result.ok) {
      onOptimisticUpdate(tx.id, tx);
      enqueueSnackbar(result.error.message, { variant: "error" });
    }
  }

  function cancelEdit() {
    setEditing(false);
    setEditValues(tx);
  }

  async function toggleFavorite(e: React.MouseEvent) {
    e.stopPropagation();
    const newVal = !tx.isFavorite;
    onOptimisticUpdate(tx.id, { isFavorite: newVal });
    const result = await updateTransactionAction(accountId, {
      transactionId: tx.id,
      isFavorite: newVal,
    });
    if (!result.ok) {
      onOptimisticUpdate(tx.id, { isFavorite: tx.isFavorite });
      enqueueSnackbar(result.error.message, { variant: "error" });
    }
  }

  async function togglePending(e: React.MouseEvent) {
    e.stopPropagation();
    const newVal = !tx.isPending;
    onOptimisticUpdate(tx.id, { isPending: newVal });
    const result = await updateTransactionAction(accountId, {
      transactionId: tx.id,
      isPending: newVal,
    });
    if (!result.ok) {
      onOptimisticUpdate(tx.id, { isPending: tx.isPending });
      enqueueSnackbar(result.error.message, { variant: "error" });
    }
  }

  function handleDelete() {
    onDeleteRequested(tx.id);
  }

  function handleViewDetails() {
    onViewDetails(tx.id);
  }

  async function handleDuplicate() {
    const result = await duplicateTransactionAction(accountId, { transactionId: tx.id });
    if (!result.ok) {
      enqueueSnackbar(result.error.message, { variant: "error" });
      return;
    }
    const now = new Date().toISOString();
    onDuplicated(
      {
        ...tx,
        id: result.data.transactionId,
        createdById: currentUserId,
        createdAt: now,
        updatedById: null,
        updatedAt: now,
      },
      tx.id,
    );
    enqueueSnackbar("Transação duplicada.", { variant: "success" });
  }

  // Gatilho vazio (Fase 3/DD-24) — payload vem de `src`: a transação salva (botão
  // no modo visualização) ou os valores em edição (botão no editor). Exceto
  // investmentType/cardInstallment: fora do escopo do form (Fase 2).
  function openCreateAlias(src: TxRow) {
    setAliasPrefill({
      description: src.description,
      notes: src.notes,
      amountCents: BigInt(src.amountCents),
      categoryId: src.categoryId,
      subcategoryId: src.subcategoryId,
      institutionId: src.institutionId,
      institutionText: src.institutionText,
      responsiblePartyId: src.responsiblePartyId,
      expenseType: src.expenseType,
      paymentMethod: src.paymentMethod,
      isPending: src.isPending,
      tagIds: src.tags.map((t) => t.id),
    });
    setAliasTags(src.tags);
    listTagsAction(accountId)
      .then((allTags) => {
        setAliasTags((prev) => {
          const merged = new Map(prev.map((t) => [t.id, t]));
          allTags.forEach((t) => merged.set(t.id, t));
          return Array.from(merged.values());
        });
      })
      .catch(() => enqueueSnackbar(m.transactions.tags.loadError, { variant: "error" }));
    setAliasDialogOpen(true);
  }

  // Sugestão de apelido no MODO VISUALIZAÇÃO (DD-23). Match estático sobre a
  // descrição salva (sem debounce — não há digitação aqui). Só para não-viewers.
  const matchedAlias = useMemo(
    () => (isReadOnly ? null : matchAlias(tx.description, aliases)),
    [isReadOnly, tx.description, aliases],
  );
  const aliasApplication = useMemo(
    () =>
      matchedAlias
        ? computeAliasApplication(
            matchedAlias,
            {
              description: tx.description,
              notes: tx.notes,
              amountCents: tx.amountCents,
              categoryId: tx.categoryId,
              subcategoryId: tx.subcategoryId,
              institutionId: tx.institutionId,
              responsiblePartyId: tx.responsiblePartyId,
              expenseType: tx.expenseType,
              paymentMethod: tx.paymentMethod,
              isPending: tx.isPending,
            },
            { categories, institutions, parties },
          )
        : null,
    [matchedAlias, tx, categories, institutions, parties],
  );

  // Aplica um patch de apelido e persiste na hora (não há "Salvar" na visualização);
  // reverte otimista para `revert` se o server recusar. Retorna sucesso.
  async function persistAliasPatch(patch: AliasPatch, revert: Partial<TxRow>): Promise<boolean> {
    onOptimisticUpdate(tx.id, patch as Partial<TxRow>);
    const result = await updateTransactionAction(accountId, {
      transactionId: tx.id,
      ...aliasPatchToUpdateInput(patch),
    });
    if (!result.ok) {
      onOptimisticUpdate(tx.id, revert);
      enqueueSnackbar(result.error.message, { variant: "error" });
      return false;
    }
    return true;
  }

  async function handleApplyAliasView() {
    if (!matchedAlias || !aliasApplication || aliasApplication.changes.length === 0) return;
    const { patch, changes } = aliasApplication;
    setAliasAnchorEl(null);

    // Snapshot dos valores antigos só dos campos que mudam (para o undo).
    const revert: Partial<TxRow> = {};
    for (const c of changes) {
      (revert as Record<string, unknown>)[c.field] = tx[c.field];
    }

    if (!(await persistAliasPatch(patch, revert))) return;

    enqueueSnackbar(m.transactions.aliasSuggestion.applied(matchedAlias.trigger, changes.length), {
      variant: "info",
      action: (snackKey) => (
        <Button
          size="small"
          color="inherit"
          onClick={() => {
            closeSnackbar(snackKey);
            void persistAliasPatch(revert as AliasPatch, patch as Partial<TxRow>);
          }}
        >
          {m.transactions.aliasSuggestion.undo}
        </Button>
      ),
    });
  }

  const subcatsForCategory = categories.find((c) => c.id === tx.categoryId)?.subcategories ?? [];

  const aliasDialog = aliasDialogOpen && (
    <TransactionAliasFormDialog
      open={aliasDialogOpen}
      onClose={() => setAliasDialogOpen(false)}
      accountId={accountId}
      categories={categories}
      institutions={institutions}
      parties={parties}
      tags={aliasTags}
      prefill={aliasPrefill ?? undefined}
      onCreateCategory={onCreateCategory}
      onCreateSubcategory={onCreateSubcategory}
      onCreateInstitution={onCreateInstitution}
      canCreateOptions={canManageOptions}
      // Dialog já mostra o snackbar de sucesso — nada pra sincronizar aqui (não há lista local).
      onSuccess={() => {}}
    />
  );

  // Modo edição — delega para TransactionRowEditor. Dialog de apelido renderizado
  // junto (DD-24): TransactionRow retorna cedo aqui, então o dialog precisa existir
  // neste branch também para o botão "criar apelido" do editor abrir algo.
  if (editing) {
    return (
      <>
        <TransactionRowEditor
          tx={tx}
          editValues={editValues}
          setEditValues={setEditValues}
          isSelected={isSelected}
          notesOpen={notesOpen}
          setNotesOpen={setNotesOpen}
          tagsOpen={tagsOpen}
          setTagsOpen={setTagsOpen}
          focusField={focusField}
          hiddenColumns={hiddenColumns}
          categories={categories}
          institutions={institutions}
          members={members}
          parties={parties}
          accountId={accountId}
          aliases={aliases}
          onSelect={onSelect}
          onSave={saveEdit}
          onCancel={cancelEdit}
          onCreateAlias={() => openCreateAlias(editValues)}
        />
        {aliasDialog}
      </>
    );
  }

  // Modo leitura
  return (
    <TableRow
      hover
      selected={isSelected}
      sx={{
        opacity: tx.isPending ? 0.65 : 1,
        // Ícones de ação: ocultos por padrão, visíveis no hover
        "& .action-icon": { opacity: 0, transition: "opacity 0.15s" },
        "&:hover .action-icon": { opacity: 1 },
        // Estado ativo (favorito, pendente, nota): sempre levemente visível
        "& .action-icon--active": { opacity: 0.75 },
      }}
    >
      <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={isSelected}
          onChange={(e) => onSelect(tx.id, e.target.checked)}
          size="small"
          disabled={isReadOnly}
        />
      </TableCell>

      <TableCell
        sx={{ fontSize: 13, whiteSpace: "nowrap", cursor: isReadOnly ? "default" : "pointer" }}
        onClick={() => !isReadOnly && startEdit("occurredOn")}
      >
        {formatDateShort(tx.occurredOn)}
      </TableCell>

      <TableCell
        sx={{
          fontSize: 13,
          maxWidth: 200,
          cursor: isReadOnly ? "default" : "pointer",
        }}
        onClick={() => !isReadOnly && startEdit("description")}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
          <Box
            component="span"
            sx={{
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {tx.description || (
              <Typography variant="caption" color="text.disabled">
                —
              </Typography>
            )}
          </Box>
          {matchedAlias && aliasApplication && (
            <Tooltip title={m.transactions.aliasSuggestion.tooltip(matchedAlias.trigger)}>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  setAliasAnchorEl(e.currentTarget);
                }}
                aria-label={m.transactions.aliasSuggestion.tooltip(matchedAlias.trigger)}
                sx={{ p: 0.25, flexShrink: 0 }}
              >
                <AutoFixHighOutlinedIcon sx={{ fontSize: 16, color: "accent.primary" }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
        {matchedAlias && aliasApplication && (
          <AliasSuggestionPopover
            anchorEl={aliasAnchorEl}
            trigger={matchedAlias.trigger}
            changes={aliasApplication.changes}
            onApply={handleApplyAliasView}
            onClose={() => setAliasAnchorEl(null)}
          />
        )}
      </TableCell>

      {!hiddenColumns.category && (
        <TableCell
          sx={{ fontSize: 13, cursor: isReadOnly ? "default" : "pointer" }}
          onClick={() => !isReadOnly && startEdit("categoryId")}
        >
          {categories.find((c) => c.id === tx.categoryId)?.name ?? (
            <Typography variant="caption" color="text.disabled">
              —
            </Typography>
          )}
        </TableCell>
      )}

      {!hiddenColumns.subcategory && (
        <TableCell
          sx={{ fontSize: 13, cursor: isReadOnly ? "default" : "pointer" }}
          onClick={() => !isReadOnly && startEdit("subcategoryId")}
        >
          {subcatsForCategory.find((s) => s.id === tx.subcategoryId)?.name ?? (
            <Typography variant="caption" color="text.disabled">
              —
            </Typography>
          )}
        </TableCell>
      )}

      {!hiddenColumns.institution && (
        <TableCell
          sx={{ fontSize: 13, cursor: isReadOnly ? "default" : "pointer" }}
          onClick={() => !isReadOnly && startEdit("institutionId")}
        >
          {institutions.find((i) => i.id === tx.institutionId)?.name ?? tx.institutionText ?? (
            <Typography variant="caption" color="text.disabled">
              —
            </Typography>
          )}
        </TableCell>
      )}

      {!hiddenColumns.paymentMethod && (
        <TableCell
          sx={{ fontSize: 13, cursor: isReadOnly ? "default" : "pointer" }}
          onClick={() => !isReadOnly && startEdit("paymentMethod")}
        >
          {tx.paymentMethod ? (
            m.transactions.paymentMethods[tx.paymentMethod]
          ) : (
            <Typography variant="caption" color="text.disabled">
              —
            </Typography>
          )}
        </TableCell>
      )}

      <TableCell
        align="right"
        sx={{
          fontWeight: "medium",
          fontSize: 13,
          whiteSpace: "nowrap",
          color: isPositive ? "success.main" : "error.main",
          cursor: isReadOnly ? "default" : "pointer",
        }}
        onClick={() => !isReadOnly && startEdit("amountCents")}
      >
        {tx.originalCurrency ? (
          <Tooltip
            title={[
              "Moeda estrangeira",
              tx.originalAmountCents && tx.originalAmountCents !== "0"
                ? `${tx.originalCurrency} ${(Number(BigInt(tx.originalAmountCents)) / 100).toFixed(2)}`
                : tx.originalCurrency,
              tx.exchangeRate ? `câmbio R$${tx.exchangeRate.toFixed(2)}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
            arrow
          >
            <span>{formatCentsToBrl(amount)}</span>
          </Tooltip>
        ) : (
          formatCentsToBrl(amount)
        )}
      </TableCell>

      {!hiddenColumns.responsibleUser && (
        <TableCell
          sx={{ cursor: isReadOnly ? "default" : "pointer" }}
          onClick={() => !isReadOnly && startEdit("responsibleUserId")}
        >
          {(() => {
            const party = tx.responsiblePartyId
              ? parties.find((p) => p.id === tx.responsiblePartyId)
              : null;
            if (!party) {
              return (
                <Typography variant="caption" color="text.disabled">
                  —
                </Typography>
              );
            }
            return (
              <Tooltip title={party.name}>
                <Box component="span" sx={{ display: "inline-flex" }}>
                  <PartyAvatar
                    kind={party.kind}
                    icon={party.icon}
                    color={party.color}
                    imageUrl={party.imageUrl}
                    name={party.name}
                    size={24}
                  />
                </Box>
              </Tooltip>
            );
          })()}
        </TableCell>
      )}

      {!hiddenColumns.investmentType && (
        <TableCell
          sx={{ fontSize: 13, cursor: isReadOnly ? "default" : "pointer" }}
          onClick={() => !isReadOnly && startEdit("investmentType")}
        >
          {tx.investmentType ?? (
            <Typography variant="caption" color="text.disabled">
              —
            </Typography>
          )}
        </TableCell>
      )}

      {/* Parcela estruturada ou texto legado */}
      {!hiddenColumns.cardInstallment && (
        <TableCell sx={{ px: 1 }}>
          {tx.installmentGroupId && tx.installmentNumber && tx.installmentGroupCount ? (
            <Tooltip
              title={m.transactions.installments.badgeTooltip(
                tx.installmentNumber,
                tx.installmentGroupCount,
                m.transactions.installments.panelTitle,
              )}
            >
              <Chip
                label={m.transactions.installments.badge(
                  tx.installmentNumber,
                  tx.installmentGroupCount,
                )}
                size="small"
                variant="outlined"
                onClick={(e) => {
                  e.stopPropagation();
                  setInstallmentPanelOpen(true);
                }}
                sx={{
                  height: 20,
                  fontSize: 11,
                  cursor: "pointer",
                  "& .MuiChip-label": { px: 0.75 },
                }}
              />
            </Tooltip>
          ) : tx.cardInstallment ? (
            <Typography variant="caption" color="text.secondary">
              {tx.cardInstallment}
            </Typography>
          ) : null}
        </TableCell>
      )}
      {!hiddenColumns.expenseType && tx.expenseType && (
        <TableCell sx={{ px: 0.5, width: 28 }}>
          <Tooltip title={m.transactions.expenseTypeTooltips[tx.expenseType] ?? ""}>
            <span style={{ display: "inline-flex", alignItems: "center" }}>
              {tx.expenseType === "fixed" && (
                <LockOutlinedIcon sx={{ fontSize: 16, color: "text.secondary" }} />
              )}
              {tx.expenseType === "variable" && (
                <WavesOutlinedIcon sx={{ fontSize: 16, color: "text.secondary" }} />
              )}
              {tx.expenseType === "one_time" && (
                <FlashOnOutlinedIcon sx={{ fontSize: 16, color: "text.secondary" }} />
              )}
            </span>
          </Tooltip>
        </TableCell>
      )}
      {!hiddenColumns.expenseType && !tx.expenseType && <TableCell sx={{ px: 0.5, width: 28 }} />}

      {/* Célula de tags */}
      {!hiddenColumns.tags && (
        <TableCell
          ref={tagCellRef}
          sx={{ cursor: "pointer", maxWidth: 160, minWidth: 60, px: 1 }}
          onClick={(e) => setTagAnchor(e.currentTarget)}
        >
          {localTags.length > 0 ? (
            <Box
              sx={{
                display: "flex",
                gap: 0.5,
                flexWrap: "nowrap",
                overflow: "hidden",
                alignItems: "center",
              }}
            >
              {localTags.slice(0, 2).map((tag) => (
                <Tooltip key={tag.id} title={tag.name} disableInteractive>
                  <Chip
                    label={tag.name}
                    size="small"
                    sx={{ ...tagChipSx(tag.color), maxWidth: 72 }}
                  />
                </Tooltip>
              ))}
              {localTags.length > 2 && (
                <Chip
                  label={`+${localTags.length - 2}`}
                  size="small"
                  sx={{ fontSize: 11, height: 20, "& .MuiChip-label": { px: 0.75 } }}
                />
              )}
            </Box>
          ) : (
            <Tooltip title={m.transactions.tags.addTooltip}>
              <LabelOutlinedIcon
                className="action-icon"
                sx={{ fontSize: 14, color: "text.disabled", display: "block" }}
              />
            </Tooltip>
          )}
        </TableCell>
      )}

      {tagAnchor && (
        <TagPopover
          anchorEl={tagAnchor}
          onClose={() => setTagAnchor(null)}
          accountId={accountId}
          transactionId={tx.id}
          currentTags={localTags}
          onTagsChange={(tags) => {
            setLocalTags(tags);
            onOptimisticUpdate(tx.id, { tags });
          }}
        />
      )}

      <TransactionRowActions
        tx={tx}
        isReadOnly={isReadOnly}
        menuAnchor={null}
        setMenuAnchor={() => {}}
        onStartEdit={() => startEdit()}
        onStartEditWithNote={startEditWithNote}
        onTogglePending={togglePending}
        onToggleFavorite={toggleFavorite}
        onViewDetails={handleViewDetails}
        onDuplicate={handleDuplicate}
        onCreateAlias={() => openCreateAlias(tx)}
        onDelete={handleDelete}
        onOpenLinkDialog={() => setLinkDialogOpen(true)}
      />

      {/* Painel de grupo de parcelamento — Drawer via portal */}
      {tx.installmentGroupId && installmentPanelOpen && (
        <InstallmentGroupPanel
          open={installmentPanelOpen}
          onClose={() => setInstallmentPanelOpen(false)}
          accountId={accountId}
          monthId={tx.monthId}
          installmentGroupId={tx.installmentGroupId}
          canEdit={!isReadOnly}
        />
      )}

      <LinkTransactionDialog
        open={linkDialogOpen}
        onClose={() => setLinkDialogOpen(false)}
        accountId={accountId}
        transactionId={tx.id}
        onLinked={() => onOptimisticUpdate(tx.id, { linkCount: tx.linkCount + 1 })}
      />

      {aliasDialog}
    </TableRow>
  );
}

export const TransactionRow = memo(TransactionRowBase);
