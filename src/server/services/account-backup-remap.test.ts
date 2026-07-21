import { describe, expect, it } from "vitest";
import type { z } from "zod";

import { WIDGET_REGISTRY } from "@/components/dashboards/_core/widget-registry";

import {
  type EntityMapKey,
  type IdMaps,
  remapCsvMapping,
  remapTransactionMetadata,
  remapWidgetConfig,
  WIDGET_ID_FIELDS,
} from "./account-backup-remap";

// ─── helpers de teste ─────────────────────────────────────────────────────

function emptyMaps(): IdMaps {
  const keys: EntityMapKey[] = [
    "section",
    "category",
    "subcategory",
    "institution",
    "tag",
    "responsibleParty",
    "month",
    "transactionAlias",
  ];
  return Object.fromEntries(keys.map((k) => [k, new Map<string, string>()])) as IdMaps;
}

function mapsWith(overrides: Partial<Record<EntityMapKey, Record<string, string>>>): IdMaps {
  const maps = emptyMaps();
  for (const [entity, entries] of Object.entries(overrides) as [
    EntityMapKey,
    Record<string, string>,
  ][]) {
    for (const [oldId, newId] of Object.entries(entries)) {
      maps[entity].set(oldId, newId);
    }
  }
  return maps;
}

// ─── remapWidgetConfig ────────────────────────────────────────────────────

describe("remapWidgetConfig", () => {
  it("remaps analysis (sandbox) config: monthIds + filterSectionIds remapped, unmapped dropped", () => {
    const maps = mapsWith({
      month: { m1: "m1-new", m2: "m2-new" },
      section: { s1: "s1-new" },
    });
    const config = {
      periodType: "months",
      monthIds: ["m1", "m2", "m-unknown"],
      groupBy: "category",
      seriesBy: "none",
      metric: "total",
      chartType: "bar_grouped",
      filterSectionIds: ["s1", "s-unknown"],
    };

    const result = remapWidgetConfig("analysis", config, maps) as typeof config;

    expect(result.monthIds).toEqual(["m1-new", "m2-new"]);
    expect(result.filterSectionIds).toEqual(["s1-new"]);
    // campos não-id preservados intactos
    expect(result.periodType).toBe("months");
    expect(result.groupBy).toBe("category");
  });

  it("remaps kpi-custom filterSectionIds", () => {
    const maps = mapsWith({ section: { s1: "s1-new" }, category: { c1: "c1-new" } });
    const config = {
      metric: "total",
      filterSectionIds: ["s1", "s-gone"],
      filterCategoryIds: ["c1"],
    };

    const result = remapWidgetConfig("kpi-custom", config, maps) as typeof config;

    expect(result.filterSectionIds).toEqual(["s1-new"]);
    expect(result.filterCategoryIds).toEqual(["c1-new"]);
  });

  it("remaps filtered-transactions categories + responsible (drops unmapped legacy userId)", () => {
    const maps = mapsWith({
      category: { c1: "c1-new" },
      responsibleParty: { party1: "party1-new" },
    });
    const config = {
      categories: ["c1", "c-gone"],
      institutions: [],
      responsible: ["party1", "legacy-user-id"],
      pending: false,
      favorite: false,
      expenseTypes: [],
      sources: [],
      paymentMethods: [],
      tags: [],
      limit: 10,
    };

    const result = remapWidgetConfig("filtered-transactions", config, maps) as typeof config;

    expect(result.categories).toEqual(["c1-new"]);
    // "legacy-user-id" não existe no mapa de responsibleParty -> dropado
    expect(result.responsible).toEqual(["party1-new"]);
  });

  it("leaves config untouched (cloned) for a widget without registered id fields", () => {
    const maps = emptyMaps();
    const config = { chartType: "pie" };

    const result = remapWidgetConfig("section-breakdown", config, maps);

    expect(result).toEqual(config);
    expect(result).not.toBe(config); // clonado, não a mesma referência
  });

  it("is defensive with null/undefined/garbage config", () => {
    const maps = emptyMaps();

    expect(remapWidgetConfig("kpi-custom", null, maps)).toBeNull();
    expect(remapWidgetConfig("kpi-custom", undefined, maps)).toBeUndefined();
    expect(remapWidgetConfig("kpi-custom", "not-an-object", maps)).toBe("not-an-object");
    expect(() => remapWidgetConfig("unknown-widget-id", { foo: "bar" }, maps)).not.toThrow();
  });

  it("does not throw when an id-array field holds a wrong-shaped value", () => {
    const maps = mapsWith({ section: { s1: "s1-new" } });
    const config = { filterSectionIds: "not-an-array" };

    expect(() => remapWidgetConfig("kpi-custom", config, maps)).not.toThrow();
  });
});

// ─── remapCsvMapping ──────────────────────────────────────────────────────

describe("remapCsvMapping", () => {
  it("remaps defaultCategoryId and strips responsibleUserMappings", () => {
    const maps = mapsWith({ category: { c1: "c1-new" }, institution: { i1: "i1-new" } });
    const mapping = {
      columns: { date: "Data", amount: "Valor", notes: [] },
      defaultCategoryId: "c1",
      defaultInstitutionId: "i-unknown",
      responsibleUserMappings: [{ text: "GABRIEL", userId: "user1" }],
    };

    const result = remapCsvMapping(mapping, maps) as typeof mapping;

    expect(result.defaultCategoryId).toBe("c1-new");
    expect(result.defaultInstitutionId).toBeNull(); // não encontrado -> null
    expect(result).not.toHaveProperty("responsibleUserMappings");
    expect(result.columns).toEqual(mapping.columns); // demais campos preservados
  });

  it("is defensive with null/garbage mapping", () => {
    const maps = emptyMaps();
    expect(remapCsvMapping(null, maps)).toBeNull();
    expect(remapCsvMapping(42, maps)).toBe(42);
  });
});

// ─── remapTransactionMetadata ─────────────────────────────────────────────

describe("remapTransactionMetadata", () => {
  it("remaps appliedAliasId to the new alias id", () => {
    const maps = mapsWith({ transactionAlias: { alias1: "alias1-new" } });
    const metadata = { appliedAliasId: "alias1", someOtherKey: "kept" };

    const result = remapTransactionMetadata(metadata, maps) as typeof metadata;

    expect(result.appliedAliasId).toBe("alias1-new");
    expect(result.someOtherKey).toBe("kept");
  });

  it("removes appliedAliasId when unmapped, keeps other keys", () => {
    const maps = emptyMaps();
    const metadata = { appliedAliasId: "gone", someOtherKey: "kept" };

    const result = remapTransactionMetadata(metadata, maps) as Record<string, unknown>;

    expect(result).not.toHaveProperty("appliedAliasId");
    expect(result.someOtherKey).toBe("kept");
  });

  it("is defensive with null/undefined metadata", () => {
    const maps = emptyMaps();
    expect(remapTransactionMetadata(null, maps)).toBeNull();
    expect(remapTransactionMetadata(undefined, maps)).toBeUndefined();
  });
});

// ─── Guard-rail (DD-16) ───────────────────────────────────────────────────
// Percorre os configSchemas reais do widget registry e falha se algum campo
// array-de-string (a "forma" de todo campo-id nos configs de widget hoje) não
// estiver registrado em WIDGET_ID_FIELDS. Protege contra um widget novo (ou um
// campo-id novo num widget existente) ficar sem remap na hora do import.

function unwrapSchema(schema: z.ZodTypeAny): z.ZodTypeAny {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const def = (schema as any)._def;
  switch (def?.typeName) {
    case "ZodOptional":
    case "ZodNullable":
    case "ZodDefault":
      return unwrapSchema(def.innerType);
    case "ZodEffects":
      return unwrapSchema(def.schema);
    default:
      return schema;
  }
}

function isStringArraySchema(schema: z.ZodTypeAny): boolean {
  const unwrapped = unwrapSchema(schema);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const def = (unwrapped as any)._def;
  if (def?.typeName !== "ZodArray") return false;
  const element = unwrapSchema(def.type);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (element as any)._def?.typeName === "ZodString";
}

function objectShapeOf(schema: z.ZodTypeAny): Record<string, z.ZodTypeAny> | null {
  const unwrapped = unwrapSchema(schema);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const def = (unwrapped as any)._def;
  if (def?.typeName !== "ZodObject") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (unwrapped as any).shape;
}

describe("WIDGET_ID_FIELDS guard-rail (DD-16)", () => {
  it("registers every widget whose configSchema has a string[] (id-shaped) field", () => {
    const missing: string[] = [];

    for (const defs of Object.values(WIDGET_REGISTRY)) {
      for (const def of defs) {
        if (!def.configSchema) continue;
        const shape = objectShapeOf(def.configSchema);
        if (!shape) continue;

        const idShapedFields = Object.keys(shape).filter((key) => isStringArraySchema(shape[key]));
        if (idShapedFields.length === 0) continue;

        const registered = new Set((WIDGET_ID_FIELDS[def.id] ?? []).map((f) => f.field));
        for (const field of idShapedFields) {
          if (!registered.has(field)) missing.push(`${def.id}.${field}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it("covers exactly the widgets/fields documented in spec 64 §7", () => {
    expect(WIDGET_ID_FIELDS["kpi-custom"]?.map((f) => f.field).sort()).toEqual(
      ["filterCategoryIds", "filterMemberIds", "filterSectionIds"].sort(),
    );
    expect(WIDGET_ID_FIELDS["top-transactions"]?.map((f) => f.field)).toEqual([
      "excludeSectionIds",
    ]);
    expect(WIDGET_ID_FIELDS["filtered-transactions"]?.map((f) => f.field).sort()).toEqual(
      ["categories", "institutions", "responsible", "tags"].sort(),
    );
    expect(WIDGET_ID_FIELDS["category-breakdown"]?.map((f) => f.field)).toEqual(["filterTagIds"]);
    expect(WIDGET_ID_FIELDS["analysis"]?.map((f) => f.field).sort()).toEqual(
      [
        "monthIds",
        "filterSectionIds",
        "filterCategoryIds",
        "filterMemberIds",
        "filterInstitutionIds",
        "filterTagIds",
      ].sort(),
    );
  });
});
