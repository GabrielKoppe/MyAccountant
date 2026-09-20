"use client";

import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import type { SectionCountType } from "@prisma/client";
import { useSnackbar } from "notistack";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { listTagsAction } from "@/actions/tags";
import { duplicateTransactionAction, updateTransactionAction } from "@/actions/transactions";
import { InstallmentGroupPanel } from "@/components/installments/InstallmentGroupPanel";
import { TagPopover } from "@/components/tags/TagPopover";
import {
  computeSuggestion,
  suggestionPatchToUpdateInput,
  type SuggestionPatch,
} from "@/lib/aliases/apply";
import { matchAlias } from "@/lib/aliases/match";
import { m } from "@/lib/messages";
import type { CreateTransactionAliasInput } from "@/lib/schemas/transaction-alias";
import type { SerializedTransactionAlias } from "@/lib/serializers/transaction-alias";
import type { PinnableColumnKey } from "@/lib/table-columns";

import { SuggestionPopover } from "./aliases/SuggestionPopover";
import { TransactionAliasFormDialog } from "./aliases/TransactionAliasFormDialog";
import { ColumnsRow } from "./ColumnsRow";
import { LinkTransactionDialog } from "./LinkTransactionDialog";
import { useOptions } from "./OptionsContext";
import { PillsRow } from "./PillsRow";
import type { RowLayout } from "./row-layout";
import { TransactionRowDetails } from "./TransactionRowDetails";
import { TransactionRowEditor } from "./TransactionRowEditor";
import type {
  CategoryOption,
  HiddenColumns,
  InstitutionOption,
  MemberOption,
  ResponsiblePartyOption,
  RowMenuItem,
  TransactionRow as TxRow,
} from "./types";

/**
 * Referência estável para o default de `pinnedColumns`: um `[]` literal no
 * default de prop nasceria novo a cada render e derrubaria o `memo` da linha.
 */
const EMPTY_PINNED: readonly PinnableColumnKey[] = [];

/**
 * Campos que a edição em massa inline propaga para TODAS as linhas selecionadas
 * assim que o usuário toca um deles (frame 66 §4 · comportamento). É exatamente
 * o conjunto aceito por `updateTransactionAction`; `tags` e `linkCount` ficam de
 * fora de propósito — são persistidos na hora, por linha, pelos próprios
 * subcomponentes da gaveta (TagPopover / vínculos), então replicá-los daria
 * divergência entre o que a tela mostra e o que o servidor tem.
 */
export const BULK_EDIT_PROPAGATED_FIELDS: readonly (keyof TxRow)[] = [
  "occurredOn",
  "amountCents",
  "description",
  "notes",
  "isPending",
  "isFavorite",
  "categoryId",
  "subcategoryId",
  "institutionId",
  "institutionText",
  "responsiblePartyId",
  "cardInstallment",
  "investmentType",
  "expenseType",
  "paymentMethod",
  "originalCurrency",
  "exchangeRate",
  "originalAmountCents",
];

type Props = {
  tx: TxRow;
  accountId: string;
  currentUserId: string;
  isSelected: boolean;
  isReadOnly: boolean;
  /** Spec 69 §2.1 (`allowBulkEdit`) — repassado à linha (leitura e edição). */
  selectable?: boolean;
  /** Spec 69 §16 — colunas fixadas, já resolvidas pelo `TransactionTable`. */
  pinnedColumns?: readonly PinnableColumnKey[];
  sectionCountType: SectionCountType;
  hiddenColumns: HiddenColumns;
  /** Layout já resolvido pelo TransactionTable (config + degradação por viewport). */
  effectiveLayout: RowLayout;
  categories: CategoryOption[];
  institutions: InstitutionOption[];
  members: MemberOption[];
  parties: ResponsiblePartyOption[];
  aliases: SerializedTransactionAlias[];
  autoEdit: boolean;
  /** Esta linha faz parte do lote em edição em massa inline (frame 66 §4). */
  bulkEditing?: boolean;
  /** Patch compartilhado do lote — campos já tocados em QUALQUER linha selecionada. */
  bulkPatch?: Partial<TxRow>;
  /** Só a primeira linha do lote autofoca a descrição (senão as N brigariam pelo foco). */
  bulkFocus?: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onOptimisticUpdate: (id: string, patch: Partial<TxRow>) => void;
  onDeleteRequested: (id: string) => void;
  onDuplicated: (newTx: TxRow, sourceId: string) => void;
  onViewDetails: (id: string) => void;
  onAutoEditConsumed: () => void;
  onOpenMenu: (e: React.MouseEvent<HTMLButtonElement>, items: RowMenuItem[]) => void;
  onOpenMove: (ids: string[]) => void;
  /** Publica no lote os campos alterados nesta linha (viram valor de todas). */
  onBulkFieldChange?: (delta: Partial<TxRow>) => void;
  /** Salvar/Cancelar são do LOTE (uma barra só) — Enter/Esc caem aqui também. */
  onBulkSave?: () => void;
  onBulkCancel?: () => void;
};

export function TransactionRowBase({
  tx,
  accountId,
  currentUserId,
  isSelected,
  isReadOnly,
  selectable = true,
  pinnedColumns = EMPTY_PINNED,
  sectionCountType,
  hiddenColumns,
  effectiveLayout,
  categories,
  institutions,
  members,
  parties,
  aliases,
  autoEdit,
  bulkEditing = false,
  bulkPatch,
  bulkFocus = false,
  onSelect,
  onOptimisticUpdate,
  onDeleteRequested,
  onDuplicated,
  onViewDetails,
  onAutoEditConsumed,
  onOpenMenu,
  onOpenMove,
  onBulkFieldChange,
  onBulkSave,
  onBulkCancel,
}: Props) {
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const { onCreateCategory, onCreateSubcategory, onCreateInstitution, canManageOptions } =
    useOptions();
  const [editing, setEditing] = useState(false);
  const [focusField, setFocusField] = useState("occurredOn");
  const [editValues, setEditValues] = useState<TxRow>(tx);
  const [_saving, setSaving] = useState(false);
  const [tagAnchor, setTagAnchor] = useState<HTMLElement | null>(null);
  const [localTags, setLocalTags] = useState(tx.tags);
  const [installmentPanelOpen, setInstallmentPanelOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
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
  // Sugestão (apelido + regra) no MODO VISUALIZAÇÃO (DD-23) — anchor do popover na descrição.
  const [suggestionAnchorEl, setSuggestionAnchorEl] = useState<HTMLElement | null>(null);
  // Foco imperativo (TX-03c): garante que "Editar" no modal de detalhe pouse na
  // descrição mesmo competindo com o restore-focus do MUI Dialog (que roda
  // depois do fechamento). Badge de parcela: devolve o foco a si mesmo ao
  // fechar o painel lateral que ele abriu.
  const descriptionInputRef = useRef<HTMLInputElement>(null);
  const installmentBadgeRef = useRef<HTMLDivElement>(null);

  function startEdit(field = "occurredOn") {
    if (isReadOnly) return;
    setEditValues(tx);
    setFocusField(field);
    setEditing(true);
  }

  useEffect(() => {
    if (autoEdit) {
      // "Editar" a partir do modal de detalhe (TX-03c) foca a descrição, não a
      // data — fecha o loop leitura→edição no 1º campo natural da linha.
      startEdit("description");
      onAutoEditConsumed();
      // rAF: roda depois do restore-focus do MUI Dialog (que devolveria o foco
      // ao gatilho que abriu o modal), garantindo que a descrição vença.
      requestAnimationFrame(() => descriptionInputRef.current?.focus());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoEdit]);

  // Sync localTags quando a prop tx.tags muda (ex: bulk tag)
  useEffect(() => {
    setLocalTags(tx.tags);
  }, [tx.tags]);

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

  // ─── Edição em massa inline (frame 66 §4) ───────────────────────────────
  // A linha continua exibindo os PRÓPRIOS valores; o patch compartilhado do
  // lote (campos já tocados em qualquer linha) é sobreposto por cima. Não há
  // estado local aqui: o `setEditValues` entregue ao editor vira um "dispatch
  // de diff" que publica para o lote só o que mudou de fato.
  const bulkEditValues = useMemo<TxRow>(() => ({ ...tx, ...bulkPatch }), [tx, bulkPatch]);
  const bulkValuesRef = useRef(bulkEditValues);
  bulkValuesRef.current = bulkEditValues;

  const setBulkEditValues = useCallback<React.Dispatch<React.SetStateAction<TxRow>>>(
    (action) => {
      const current = bulkValuesRef.current;
      const next = typeof action === "function" ? action(current) : action;

      const delta: Partial<TxRow> = {};
      for (const key of BULK_EDIT_PROPAGATED_FIELDS) {
        if (!Object.is(next[key], current[key])) {
          (delta as Record<string, unknown>)[key] = next[key];
        }
      }
      if (Object.keys(delta).length === 0) return;

      // Avança o ref na hora para que duas chamadas síncronas seguidas (ex.:
      // categoria + subcategoria) não calculem o diff contra um valor velho.
      bulkValuesRef.current = { ...current, ...delta };
      onBulkFieldChange?.(delta);
    },
    [onBulkFieldChange],
  );

  const handleBulkSave = useCallback(() => onBulkSave?.(), [onBulkSave]);
  const handleBulkCancel = useCallback(() => onBulkCancel?.(), [onBulkCancel]);

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

  // Sugestão no MODO VISUALIZAÇÃO (DD-23). Match estático de apelido sobre a
  // transação salva (sem debounce — não há digitação aqui), incluindo as
  // condições avançadas (faixa de valor / instituição). Só para não-viewers.
  const matchedAlias = useMemo(
    () =>
      isReadOnly
        ? null
        : matchAlias(
            {
              description: tx.description,
              amountCents: BigInt(tx.amountCents),
              institutionId: tx.institutionId,
            },
            aliases,
          ),
    [isReadOnly, tx.description, tx.amountCents, tx.institutionId, aliases],
  );
  const suggestion = useMemo(
    () =>
      matchedAlias
        ? computeSuggestion(
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

  // Aplica um patch de sugestão e persiste na hora (não há "Salvar" na
  // visualização); reverte otimista para `revert` se o server recusar. Retorna sucesso.
  async function persistSuggestionPatch(
    patch: SuggestionPatch,
    revert: Partial<TxRow>,
  ): Promise<boolean> {
    onOptimisticUpdate(tx.id, patch as Partial<TxRow>);
    const result = await updateTransactionAction(accountId, {
      transactionId: tx.id,
      ...suggestionPatchToUpdateInput(patch),
    });
    if (!result.ok) {
      onOptimisticUpdate(tx.id, revert);
      enqueueSnackbar(result.error.message, { variant: "error" });
      return false;
    }
    return true;
  }

  async function handleApplySuggestionView() {
    if (!suggestion || suggestion.changes.length === 0) return;
    const { patch, changes } = suggestion;
    setSuggestionAnchorEl(null);

    // Snapshot dos valores antigos só dos campos que mudam (para o undo).
    const revert: Partial<TxRow> = {};
    for (const c of changes) {
      (revert as Record<string, unknown>)[c.field] = tx[c.field];
    }

    if (!(await persistSuggestionPatch(patch, revert))) return;

    enqueueSnackbar(m.transactions.aliasSuggestion.applied(matchedAlias?.trigger ?? "", changes.length), {
      variant: "info",
      action: (snackKey) => (
        <Button
          size="small"
          color="inherit"
          onClick={() => {
            closeSnackbar(snackKey);
            void persistSuggestionPatch(revert as SuggestionPatch, patch as Partial<TxRow>);
          }}
        >
          {m.transactions.aliasSuggestion.undo}
        </Button>
      ),
    });
  }

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
  // No lote (`bulkEditing`) o editor é o mesmo, mas: valores = linha + patch do
  // lote, `setEditValues` publica o diff para todas as selecionadas e
  // Salvar/Cancelar (inclusive Enter/Esc) agem sobre o LOTE inteiro.
  if (editing || bulkEditing) {
    const activeValues = bulkEditing ? bulkEditValues : editValues;
    return (
      <>
        <TransactionRowEditor
          tx={tx}
          editValues={activeValues}
          setEditValues={bulkEditing ? setBulkEditValues : setEditValues}
          isSelected={isSelected}
          selectable={selectable}
          pinnedColumns={pinnedColumns}
          focusField={bulkEditing ? (bulkFocus ? "description" : "") : focusField}
          descriptionInputRef={descriptionInputRef}
          hiddenColumns={hiddenColumns}
          categories={categories}
          institutions={institutions}
          members={members}
          parties={parties}
          accountId={accountId}
          aliases={aliases}
          onSelect={onSelect}
          onSave={bulkEditing ? handleBulkSave : saveEdit}
          onCancel={bulkEditing ? handleBulkCancel : cancelEdit}
          onCreateAlias={() => openCreateAlias(activeValues)}
          hideActions={bulkEditing}
        />
        {aliasDialog}
      </>
    );
  }

  // Modo leitura — delega para o layout do tipo de tabela (Spec 66 P6). O
  // container mantém estado/handlers/effects e os overlays; ColumnsRow/PillsRow
  // apenas desenham a linha. Overlays (SuggestionPopover, TagPopover,
  // InstallmentGroupPanel, LinkTransactionDialog, aliasDialog) e a gaveta ficam
  // aqui — os popovers usam anchors abertos pela linha (onOpenSuggestion/onOpenTags).
  const rowProps = {
    tx,
    isSelected,
    isReadOnly,
    selectable,
    pinnedColumns,
    sectionCountType,
    hiddenColumns,
    categories,
    institutions,
    parties,
    localTags,
    hasSuggestion: !!suggestion,
    installmentBadgeRef,
    onSelect,
    onStartEdit: startEdit,
    onOpenSuggestion: (anchor: HTMLElement) => setSuggestionAnchorEl(anchor),
    onOpenTags: (anchor: HTMLElement) => setTagAnchor(anchor),
    onOpenInstallmentPanel: () => setInstallmentPanelOpen(true),
    onTogglePending: togglePending,
    onToggleFavorite: toggleFavorite,
    onViewDetails: handleViewDetails,
    onDuplicate: handleDuplicate,
    onMove: () => onOpenMove([tx.id]),
    onCreateAlias: () => openCreateAlias(tx),
    onDelete: handleDelete,
    onToggleDrawer: () => setDrawerOpen((o) => !o),
    drawerOpen,
    onOpenMenu,
  };

  return (
    <>
      {effectiveLayout === "pills" ? <PillsRow {...rowProps} /> : <ColumnsRow {...rowProps} />}

      {suggestion && (
        <SuggestionPopover
          anchorEl={suggestionAnchorEl}
          trigger={matchedAlias?.trigger ?? null}
          changes={suggestion.changes}
          onApply={handleApplySuggestionView}
          onClose={() => setSuggestionAnchorEl(null)}
        />
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

      {/* Painel de grupo de parcelamento — Drawer via portal */}
      {tx.installmentGroupId && installmentPanelOpen && (
        <InstallmentGroupPanel
          open={installmentPanelOpen}
          onClose={() => {
            setInstallmentPanelOpen(false);
            // Devolve o foco ao badge que abriu o painel (no-op se, por algum
            // motivo, ele não estiver mais renderizado).
            requestAnimationFrame(() => installmentBadgeRef.current?.focus());
          }}
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

      {drawerOpen && (
        <TableRow>
          <TableCell colSpan={99} sx={{ p: 0, border: 0 }}>
            <Collapse in={drawerOpen} appear unmountOnExit>
              <TransactionRowDetails
                tx={tx}
                isReadOnly={isReadOnly}
                onManageLinks={() => setLinkDialogOpen(true)}
                onViewInstallmentGroup={() => setInstallmentPanelOpen(true)}
              />
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export const TransactionRow = memo(TransactionRowBase);
