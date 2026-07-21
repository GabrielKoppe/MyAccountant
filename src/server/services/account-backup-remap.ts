// Deep-remap de IDs embutidos em blobs JSON (spec 64 §2.2 item 4 + §7 "Deep-remap de
// JSON — campos por coluna"; DD-11/DD-13/DD-16).
//
// Módulo PURO — sem import de `prisma` nem de nenhum client. O remap de FK "normal"
// (colunas reais) não enxerga ids dentro de colunas `Json` (`DashboardLayout.widgets[].config`,
// `CsvTemplate.mapping`, `Transaction.metadata`) — por isso este passo extra, chamado pelo
// `account-backup-service.ts` (Fase 2b) depois de montar os `IdMaps` por modelo.
//
// Fonte única dos campos-id por widget: `WIDGET_ID_FIELDS` (DD-16). Se um widget novo ganhar
// um campo-id no `configSchema` (`src/lib/schemas/widget-config.ts`), este registro precisa ser
// atualizado — o teste de guard-rail em `account-backup-remap.test.ts` falha se um campo
// string[] não estiver registrado aqui.

/** Uma entrada por modelo cujos ids aparecem dentro de algum blob Json. */
export type EntityMapKey =
  | "section"
  | "category"
  | "subcategory"
  | "institution"
  | "tag"
  | "responsibleParty"
  | "month"
  | "transactionAlias";

/** oldId -> newId por modelo, construído pelo insert topológico do import. */
export type IdMaps = Record<EntityMapKey, Map<string, string>>;

type WidgetIdFieldKind = "array" | "single";

export type WidgetIdField = {
  /** Nome do campo dentro do `config` do widget. */
  field: string;
  /** Qual mapa de `IdMaps` remapeia este campo. */
  entity: EntityMapKey;
  /** "array" = lista de ids (filtrada); "single" = um id (null se não mapeado). */
  kind: WidgetIdFieldKind;
};

// ─────────────────────────────────────────────────────────────────────────────
// Registro central (DD-16) — espelha spec 64 §7 "Deep-remap de JSON — campos por coluna".
// Widgets sem entrada aqui são tratados como opacos (config copiado sem remap).
// ─────────────────────────────────────────────────────────────────────────────
export const WIDGET_ID_FIELDS: Record<string, WidgetIdField[]> = {
  "kpi-custom": [
    { field: "filterSectionIds", entity: "section", kind: "array" },
    { field: "filterCategoryIds", entity: "category", kind: "array" },
    { field: "filterMemberIds", entity: "responsibleParty", kind: "array" },
  ],
  "top-transactions": [{ field: "excludeSectionIds", entity: "section", kind: "array" }],
  "filtered-transactions": [
    { field: "categories", entity: "category", kind: "array" },
    { field: "institutions", entity: "institution", kind: "array" },
    { field: "responsible", entity: "responsibleParty", kind: "array" },
    { field: "tags", entity: "tag", kind: "array" },
  ],
  "category-breakdown": [{ field: "filterTagIds", entity: "tag", kind: "array" }],
  analysis: [
    { field: "monthIds", entity: "month", kind: "array" },
    { field: "filterSectionIds", entity: "section", kind: "array" },
    { field: "filterCategoryIds", entity: "category", kind: "array" },
    { field: "filterMemberIds", entity: "responsibleParty", kind: "array" },
    { field: "filterInstitutionIds", entity: "institution", kind: "array" },
    { field: "filterTagIds", entity: "tag", kind: "array" },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function remapArrayField(raw: unknown, map: Map<string, string>): unknown {
  // Formato inesperado (não-array) — defensivo: mantém como está, não derruba o import.
  if (!Array.isArray(raw)) return raw;
  return raw
    .filter((id): id is string => typeof id === "string")
    .map((id) => map.get(id))
    .filter((id): id is string => id !== undefined);
}

function remapSingleField(raw: unknown, map: Map<string, string>): unknown {
  if (raw === undefined) return raw;
  if (typeof raw !== "string") return raw; // formato inesperado — defensivo
  return map.get(raw) ?? null; // não encontrado no mapa -> null
}

// ─────────────────────────────────────────────────────────────────────────────
// remapWidgetConfig — DashboardLayout.widgets[].config
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Remapeia os campos-id conhecidos do `config` de UMA instância de widget
 * (`StoredWidget.config`), de acordo com `WIDGET_ID_FIELDS[widgetId]`.
 *
 * - `widgetId` sem entrada no registro (ou sem campos-id) -> config clonado sem alteração.
 * - Campo array: ids sem correspondência no mapa são DROPADOS da lista.
 * - Campo single: id sem correspondência no mapa vira `null`.
 * - `config` null/undefined/não-objeto -> retornado como está.
 */
export function remapWidgetConfig(widgetId: string, config: unknown, maps: IdMaps): unknown {
  if (!isPlainObject(config)) return config;

  const fields = WIDGET_ID_FIELDS[widgetId];
  if (!fields || fields.length === 0) return structuredClone(config);

  const clone = structuredClone(config) as Record<string, unknown>;
  for (const { field, entity, kind } of fields) {
    if (!(field in clone)) continue;
    const map = maps[entity];
    clone[field] =
      kind === "array" ? remapArrayField(clone[field], map) : remapSingleField(clone[field], map);
  }
  return clone;
}

// ─────────────────────────────────────────────────────────────────────────────
// remapCsvMapping — CsvTemplate.mapping
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Remapeia `CsvTemplate.mapping`: `defaultCategoryId`/`defaultInstitutionId` para os novos
 * ids (não mapeado -> null); `responsibleUserMappings` é SEMPRE removido — guarda `userId`,
 * que não atravessa contas (DD-13, mesma razão do DD-10 aplicada a blobs JSON).
 */
export function remapCsvMapping(mapping: unknown, maps: IdMaps): unknown {
  if (!isPlainObject(mapping)) return mapping;

  const clone = structuredClone(mapping) as Record<string, unknown>;

  if ("defaultCategoryId" in clone) {
    clone.defaultCategoryId = remapSingleField(clone.defaultCategoryId, maps.category);
  }
  if ("defaultInstitutionId" in clone) {
    clone.defaultInstitutionId = remapSingleField(clone.defaultInstitutionId, maps.institution);
  }
  delete clone.responsibleUserMappings;

  return clone;
}

// ─────────────────────────────────────────────────────────────────────────────
// remapTransactionMetadata — Transaction.metadata
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Remapeia `Transaction.metadata`: `appliedAliasId` -> id remapeado do
 * `TransactionAlias`; se não encontrado no mapa, a CHAVE é removida (em vez de virar
 * `null`) para não deixar rastro de um apelido inexistente. Demais chaves de `metadata`
 * são preservadas intactas (opacas a este remap).
 */
export function remapTransactionMetadata(metadata: unknown, maps: IdMaps): unknown {
  if (!isPlainObject(metadata)) return metadata;

  const clone = structuredClone(metadata) as Record<string, unknown>;
  if ("appliedAliasId" in clone) {
    const raw = clone.appliedAliasId;
    const mapped = typeof raw === "string" ? maps.transactionAlias.get(raw) : undefined;
    if (mapped) {
      clone.appliedAliasId = mapped;
    } else {
      delete clone.appliedAliasId;
    }
  }
  return clone;
}
