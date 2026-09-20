// Spec 69 §2.1 / §14 P3-P4 — estado editável de um tipo de tabela.
//
// Módulo PURO: sem React, sem Prisma. Aqui moram as três regras que o gerente de
// página não pode errar — o que conta como "alteração não salva", o que vai no
// payload de um update PARCIAL, e o que acontece com uma coluna fixada quando a
// coluna deixa de ser visível.

import {
  INHERIT_ON_NEW_ROW_FIELDS,
  type Density,
  type DefaultSort,
  type GroupBy,
  type InheritOnNewRowField,
  type RowLayout,
  type UpdateTableTypeInput,
} from "@/lib/schemas/settings";
import {
  LOCKED_COLUMN_KEYS,
  normalizeVisibleColumns,
  TABLE_COLUMNS,
  type TableColumnKey,
} from "@/lib/table-columns";

/** Os 12 campos que as abas 1 e 2 editam. */
export type TableTypeDraft = {
  name: string;
  rowLayout: RowLayout;
  density: Density;
  /** ORDENADO — a ordem é o dado (D3), não um detalhe de exibição. */
  visibleColumns: TableColumnKey[];
  pinnedColumns: TableColumnKey[];
  inheritOnNewRow: InheritOnNewRowField[];
  defaultSort: DefaultSort;
  /** `null` = nenhum agrupamento. */
  groupBy: GroupBy;
  showFooterTotal: boolean;
  showGroupSubtotal: boolean;
  allowBulkEdit: boolean;
  keepGhostRow: boolean;
};

/** O recorte de um tipo salvo de que este módulo precisa. */
export type TableTypeDraftSource = TableTypeDraft;

export function draftFromType(type: TableTypeDraftSource): TableTypeDraft {
  return {
    name: type.name,
    rowLayout: type.rowLayout,
    density: type.density,
    visibleColumns: [...type.visibleColumns],
    pinnedColumns: [...type.pinnedColumns],
    inheritOnNewRow: [...type.inheritOnNewRow],
    defaultSort: { ...type.defaultSort },
    groupBy: type.groupBy,
    showFooterTotal: type.showFooterTotal,
    showGroupSubtotal: type.showGroupSubtotal,
    allowBulkEdit: type.allowBulkEdit,
    keepGhostRow: type.keepGhostRow,
  };
}

/** Comparação SENSÍVEL À ORDEM — mudar só a ordem das colunas é uma alteração (D3). */
function sameOrderedList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/**
 * Quantos campos divergem do último salvo — é o `dirtyCount` do `SettingsSaveBar`.
 *
 * Cada campo conta UMA vez, inclusive as listas: reordenar seis colunas é "1
 * alteração" (a ordem das colunas), não seis. O rodapé fala de campos do
 * formulário, e o usuário fez um gesto só.
 */
export function countDirtyFields(draft: TableTypeDraft, saved: TableTypeDraftSource): number {
  const base = draftFromType(saved);
  let dirty = 0;

  if (draft.name.trim() !== base.name.trim()) dirty += 1;
  if (draft.rowLayout !== base.rowLayout) dirty += 1;
  if (draft.density !== base.density) dirty += 1;
  if (!sameOrderedList(draft.visibleColumns, base.visibleColumns)) dirty += 1;
  if (!sameOrderedList(draft.pinnedColumns, base.pinnedColumns)) dirty += 1;
  if (!sameOrderedList(draft.inheritOnNewRow, base.inheritOnNewRow)) dirty += 1;
  if (draft.defaultSort.key !== base.defaultSort.key) dirty += 1;
  else if (draft.defaultSort.dir !== base.defaultSort.dir) dirty += 1;
  if (draft.groupBy !== base.groupBy) dirty += 1;
  if (draft.showFooterTotal !== base.showFooterTotal) dirty += 1;
  if (draft.showGroupSubtotal !== base.showGroupSubtotal) dirty += 1;
  if (draft.allowBulkEdit !== base.allowBulkEdit) dirty += 1;
  if (draft.keepGhostRow !== base.keepGhostRow) dirty += 1;

  return dirty;
}

/**
 * O payload de `updateTableTypeAction` — **só os campos que mudaram**.
 *
 * É a armadilha do §15 (`undefined` × `null`) resolvida na origem: o serviço
 * monta o `data` campo a campo e trata `undefined` como "não mencionei". Mandar o
 * rascunho inteiro faria toda gravação reescrever os 12 campos, e um `groupBy`
 * que o usuário nunca tocou seria regravado com o valor que a UI *acha* que ele
 * tem — que é como configuração de outra aba some sem ninguém pedir.
 *
 * `groupBy: null` continua sendo enviado quando o usuário TROCA para "nenhum":
 * ali `null` significa "limpar", e é diferente de omitir.
 *
 * `canEditColumns = false` (tipo padrão): o serviço recusa mudar o conjunto de
 * colunas do tipo padrão. Sem esta guarda a UI mandaria a lista, o servidor a
 * ignoraria em silêncio e o rascunho pareceria salvo até a próxima recarga.
 */
export function buildUpdatePayload(
  tableTypeId: string,
  draft: TableTypeDraft,
  saved: TableTypeDraftSource,
  options: { canEditColumns?: boolean } = {},
): UpdateTableTypeInput {
  const { canEditColumns = true } = options;
  const base = draftFromType(saved);
  const payload: UpdateTableTypeInput = { tableTypeId };

  const name = draft.name.trim();
  if (name !== base.name.trim()) payload.name = name;
  if (draft.rowLayout !== base.rowLayout) payload.rowLayout = draft.rowLayout;
  if (draft.density !== base.density) payload.density = draft.density;
  if (canEditColumns && !sameOrderedList(draft.visibleColumns, base.visibleColumns)) {
    payload.visibleColumns = draft.visibleColumns;
  }
  if (!sameOrderedList(draft.pinnedColumns, base.pinnedColumns)) {
    payload.pinnedColumns = draft.pinnedColumns;
  }
  if (!sameOrderedList(draft.inheritOnNewRow, base.inheritOnNewRow)) {
    payload.inheritOnNewRow = draft.inheritOnNewRow;
  }
  if (
    draft.defaultSort.key !== base.defaultSort.key ||
    draft.defaultSort.dir !== base.defaultSort.dir
  ) {
    payload.defaultSort = draft.defaultSort;
  }
  if (draft.groupBy !== base.groupBy) payload.groupBy = draft.groupBy;
  if (draft.showFooterTotal !== base.showFooterTotal)
    payload.showFooterTotal = draft.showFooterTotal;
  if (draft.showGroupSubtotal !== base.showGroupSubtotal) {
    payload.showGroupSubtotal = draft.showGroupSubtotal;
  }
  if (draft.allowBulkEdit !== base.allowBulkEdit) payload.allowBulkEdit = draft.allowBulkEdit;
  if (draft.keepGhostRow !== base.keepGhostRow) payload.keepGhostRow = draft.keepGhostRow;

  return payload;
}

// ─── Colunas ───────────────────────────────────────────────────────────────

const LOCKED_SET: ReadonlySet<string> = new Set<string>(LOCKED_COLUMN_KEYS);

/** Coluna estrutural: o × e a alça não existem para ela (`ColumnChipList` já sabe). */
export function isLockedColumn(key: TableColumnKey): boolean {
  return LOCKED_SET.has(key);
}

/** Adiciona ao FIM (é o que o `+` do frame promete), normalizando em seguida. */
export function addColumn(visible: readonly TableColumnKey[], key: TableColumnKey) {
  if (visible.includes(key)) return [...visible];
  return normalizeVisibleColumns([...visible, key]);
}

/**
 * Remove uma coluna. Coluna travada é devolvida intacta — a UI não oferece o ×
 * nela, mas uma guarda que só existe na UI não existe (§15).
 */
export function removeColumn(visible: readonly TableColumnKey[], key: TableColumnKey) {
  if (isLockedColumn(key)) return [...visible];
  return normalizeVisibleColumns(visible.filter((column) => column !== key));
}

/** As colunas que sobraram, na ordem canônica — é a lista "Disponíveis". */
export function availableColumns(visible: readonly TableColumnKey[]): TableColumnKey[] {
  const inUse = new Set<string>(visible);
  return TABLE_COLUMNS.filter((column) => !inUse.has(column.key)).map((column) => column.key);
}

/**
 * Fixar/desafixar (e herdar/não herdar) — liga e desliga uma chave preservando a
 * ordem de entrada das demais.
 */
export function toggleKey<T extends string>(list: readonly T[], key: T): T[] {
  return list.includes(key) ? list.filter((item) => item !== key) : [...list, key];
}

/**
 * Coluna fixada que deixou de ser visível não pode continuar fixada: ela não
 * existe mais na tabela, e o chip ficaria marcado apontando para o nada. Roda
 * sempre que `visibleColumns` muda.
 *
 * Segue correta com o recorte da §16 (`PINNABLE_COLUMNS` = `occurredOn` +
 * `description`), só que o alvo mudou: as duas fixáveis são `locked` e nunca saem
 * das visíveis, então quem a poda tira hoje é **valor legado** — uma coluna que a
 * tela antiga (que oferecia as 12) deixou gravada e que agora some da tabela. Por
 * isso ela continua tipada em `TableColumnKey`, e não em `PinnableColumnKey`:
 * estreitar o tipo aqui deixaria o legado passar sem poda.
 */
export function prunePinned(
  pinned: readonly TableColumnKey[],
  visible: readonly TableColumnKey[],
): TableColumnKey[] {
  const visibleSet = new Set<string>(visible);
  return pinned.filter((key) => visibleSet.has(key));
}

/** Os quatro campos de "Ao criar linha nova, herdar", na ordem do frame. */
export const INHERIT_FIELDS: readonly InheritOnNewRowField[] = INHERIT_ON_NEW_ROW_FIELDS;
