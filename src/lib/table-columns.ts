import { m } from "@/lib/messages";

/**
 * Spec 69 §2.1 (D3) — fonte ÚNICA da ordem canônica das colunas da linha de
 * transação.
 *
 * A ordem desta lista é a do frame (tela 05) e é a mesma usada pelo backfill de
 * `visible_columns` na migração
 * `20260811215017_spec69_apresentacao_density_columns_dayrule_provenance`.
 * Se uma coluna entrar, sair ou trocar de posição aqui, o SQL do backfill e o
 * `hiddenColumnsBaseSchema` (`src/lib/schemas/settings.ts`) mudam junto.
 *
 * `locked`: a coluna é estrutural (data, descrição, valor) — não pode ser
 * removida nem reordenada para fora; `normalizeVisibleColumns` a reinsere sempre.
 */
export const TABLE_COLUMNS = [
  { key: "occurredOn", label: m.transactions.fields.occurredOn, locked: true },
  { key: "description", label: m.transactions.fields.description, locked: true },
  { key: "category", label: m.transactions.fields.category, locked: false },
  { key: "subcategory", label: m.transactions.fields.subcategory, locked: false },
  { key: "institution", label: m.transactions.fields.institution, locked: false },
  { key: "paymentMethod", label: m.transactions.fields.paymentMethod, locked: false },
  { key: "responsibleUser", label: m.transactions.fields.responsibleUser, locked: false },
  { key: "isPending", label: m.transactions.fields.isPending, locked: false },
  { key: "cardInstallment", label: m.transactions.fields.cardInstallment, locked: false },
  { key: "investmentType", label: m.transactions.fields.investmentType, locked: false },
  { key: "expenseType", label: m.transactions.fields.expenseType, locked: false },
  { key: "tags", label: m.transactions.fields.tags, locked: false },
  { key: "notes", label: m.transactions.fields.notes, locked: false },
  { key: "amount", label: m.transactions.fields.amount, locked: true },
] as const;

export type TableColumn = (typeof TABLE_COLUMNS)[number];
export type TableColumnKey = TableColumn["key"];

/**
 * Todas as chaves, na ordem canônica. Tipada como tupla não-vazia porque é o que
 * `z.enum()` exige — `TABLE_COLUMNS` é `as const` e nunca está vazio, então o
 * cast é seguro e evita repetir a lista num segundo lugar.
 */
export const TABLE_COLUMN_KEYS = TABLE_COLUMNS.map((c) => c.key) as unknown as readonly [
  TableColumnKey,
  ...TableColumnKey[],
];

/** Chaves estruturais — sempre visíveis. */
export const LOCKED_COLUMN_KEYS: readonly TableColumnKey[] = TABLE_COLUMNS.filter(
  (c) => c.locked,
).map((c) => c.key);

/**
 * Chaves que o usuário pode esconder — exatamente as que `hiddenColumns` conhece.
 * É o domínio de `hiddenColumnsFromVisible`.
 */
export const TOGGLEABLE_COLUMN_KEYS: readonly TableColumnKey[] = TABLE_COLUMNS.filter(
  (c) => !c.locked,
).map((c) => c.key);

/**
 * Spec 69 §16 — colunas que podem ser FIXADAS à esquerda (`pinnedColumns`).
 *
 * Só as duas colunas de **identificação**, e o recorte não é estético: elas são
 * o PREFIXO da linha (vêm logo depois da coluna de seleção), então o `left`
 * acumulado de cada uma é a soma de larguras **fixas e conhecidas** — nenhuma
 * medição em JS, que é o anti-padrão que a §7.2 rejeita. Fixar uma coluna do
 * meio obrigaria a medir todas as anteriores e a re-medir a cada mudança de
 * densidade (`--row-fs` muda a largura do texto), de colunas visíveis ou de
 * tamanho do contêiner — foi por isso que o campo ficou inerte até aqui.
 *
 * A ORDEM desta lista não manda em nada: as presas efetivas saem na ordem das
 * colunas visíveis (`resolvePinnedColumns`).
 */
export const PINNABLE_COLUMNS = [
  "occurredOn",
  "description",
] as const satisfies readonly TableColumnKey[];

export type PinnableColumnKey = (typeof PINNABLE_COLUMNS)[number];

const KEY_SET: ReadonlySet<string> = new Set<string>(TABLE_COLUMN_KEYS);
const LOCKED_SET: ReadonlySet<string> = new Set<string>(LOCKED_COLUMN_KEYS);
const PINNABLE_SET: ReadonlySet<string> = new Set<string>(PINNABLE_COLUMNS);

export function isPinnableColumnKey(value: unknown): value is PinnableColumnKey {
  return typeof value === "string" && PINNABLE_SET.has(value);
}

/**
 * As colunas EFETIVAMENTE fixadas na tela: gravado ∩ `PINNABLE_COLUMNS` ∩
 * visíveis, **na ordem das visíveis**.
 *
 * Tolerante de propósito: `raw` vem do banco (`Json`) e a tela de Configurações
 * pode, num intervalo de deploys, ter gravado uma coluna que não é fixável.
 * O renderer não confia no que está gravado — filtra aqui e segue.
 */
export function resolvePinnedColumns(
  raw: unknown,
  visible: readonly TableColumnKey[],
): PinnableColumnKey[] {
  const stored = new Set<string>((Array.isArray(raw) ? raw : []).filter(isPinnableColumnKey));
  if (stored.size === 0) return [];
  return visible.filter(isPinnableColumnKey).filter((key) => stored.has(key));
}

export function isTableColumnKey(value: unknown): value is TableColumnKey {
  return typeof value === "string" && KEY_SET.has(value);
}

export function getTableColumn(key: TableColumnKey): TableColumn {
  // A busca é segura: `key` só existe se veio de TABLE_COLUMNS.
  return TABLE_COLUMNS.find((c) => c.key === key)!;
}

export function tableColumnLabel(key: TableColumnKey): string {
  return getTableColumn(key).label;
}

/**
 * Deriva a lista ORDENADA de colunas visíveis a partir do mapa legado
 * `hiddenColumns`. Usado (a) como espelho do backfill SQL e (b) como fallback de
 * leitura para tipos que ainda não têm `visibleColumns` gravado.
 */
export function visibleColumnsFromHidden(
  hidden: Record<string, boolean | undefined> | null | undefined,
): TableColumnKey[] {
  const map = hidden ?? {};
  return TABLE_COLUMN_KEYS.filter((key) => LOCKED_SET.has(key) || map[key] !== true);
}

/**
 * Deriva o mapa legado `hiddenColumns` a partir da lista de visíveis — a ESCRITA
 * DUPLA da Spec 69 P0: enquanto o renderer atual do mês consumir `hiddenColumns`,
 * quem grava `visibleColumns` grava este junto. Só as chaves ocultas entram
 * (mesma forma compacta que o serviço já gravava), e coluna `locked` nunca é
 * marcada como oculta.
 */
export function hiddenColumnsFromVisible(
  visible: readonly TableColumnKey[],
): Record<string, boolean> {
  const visibleSet = new Set<string>(visible);
  const hidden: Record<string, boolean> = {};
  for (const key of TOGGLEABLE_COLUMN_KEYS) {
    if (!visibleSet.has(key)) hidden[key] = true;
  }
  return hidden;
}

/**
 * Normaliza uma lista de chaves vinda do usuário ou do banco:
 * - descarta o que não é chave conhecida (inclusive não-strings);
 * - remove duplicatas mantendo a PRIMEIRA ocorrência;
 * - preserva a ordem escolhida pelo usuário;
 * - reinsere as `locked` que faltarem, cada uma na sua posição canônica relativa.
 *
 * Só normaliza: `[]` continua sendo "nenhuma coluna opcional" (com as três
 * estruturais reinseridas), NÃO "não configurado". Quem precisa do fallback de
 * leitura usa `parseVisibleColumns`.
 */
export function normalizeVisibleColumns(input: unknown): TableColumnKey[] {
  const raw = Array.isArray(input) ? input : [];
  const seen = new Set<TableColumnKey>();
  const picked: TableColumnKey[] = [];
  for (const value of raw) {
    if (!isTableColumnKey(value) || seen.has(value)) continue;
    seen.add(value);
    picked.push(value);
  }

  const missingLocked = LOCKED_COLUMN_KEYS.filter((key) => !seen.has(key));
  if (missingLocked.length === 0) return picked;

  // Reinserção: percorre a ordem canônica e encaixa cada `locked` faltante logo
  // antes da primeira coluna escolhida que vem depois dela no canônico. Assim
  // `["amount", "category"]` vira `["occurredOn", "description", "amount", "category"]`
  // — a ordem do usuário entre as escolhidas é preservada.
  const result = [...picked];
  for (const key of missingLocked) {
    const canonicalIndex = TABLE_COLUMN_KEYS.indexOf(key);
    const at = result.findIndex((other) => TABLE_COLUMN_KEYS.indexOf(other) > canonicalIndex);
    if (at === -1) result.push(key);
    else result.splice(at, 0, key);
  }
  return result;
}

/**
 * Leitura tolerante do campo `visibleColumns` do banco. `null`/não-array/array
 * vazio significam "nunca configurado" (tipo criado antes do backfill ou pelo
 * default `[]` do Prisma) e caem no derivado de `hiddenColumns`.
 */
export function parseVisibleColumns(
  raw: unknown,
  hiddenFallback?: Record<string, boolean | undefined> | null,
): TableColumnKey[] {
  if (Array.isArray(raw) && raw.length > 0) return normalizeVisibleColumns(raw);
  return visibleColumnsFromHidden(hiddenFallback);
}
