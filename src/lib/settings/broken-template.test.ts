import { describe, expect, it } from "vitest";

import { DEFAULT_MAPPING } from "@/lib/schemas/csv-import";

import { isTemplateBroken, type TemplateReferenceSets } from "./broken-template";

// DEFAULT_MAPPING sozinho NÃO passa no schema: em amountMode "single" o
// superRefine exige `columns.amount`, e `columns.date` tem min(1). O mapeamento
// saudável é o default + as duas colunas obrigatórias preenchidas.
const healthyMapping = {
  ...DEFAULT_MAPPING,
  columns: { ...DEFAULT_MAPPING.columns, date: "Data", amount: "Valor" },
};

// Ids no formato aceito por `cuidSchema` (cuid OU uuid legado). Importante: um
// id com hífen (ex: "cat-morta") seria rejeitado pelo próprio schema e o
// template cairia em B1 (estrutural) em vez de B2 (referência órfã) — os casos
// de órfão abaixo perderiam o sentido.
const ALIVE_CATEGORY = "ccat_alive01";
const ALIVE_INSTITUTION = "cinst_alive01";
const ALIVE_USER = "cuser_alive01";

const refs: TemplateReferenceSets = {
  categoryIds: new Set([ALIVE_CATEGORY]),
  institutionIds: new Set([ALIVE_INSTITUTION]),
  memberUserIds: new Set([ALIVE_USER]),
};

describe("isTemplateBroken", () => {
  it("não sinaliza um mapeamento saudável sem referências", () => {
    expect(isTemplateBroken(healthyMapping, refs)).toBe(false);
  });

  it("não sinaliza um mapeamento saudável cujas referências existem", () => {
    const mapping = {
      ...healthyMapping,
      defaultCategoryId: ALIVE_CATEGORY,
      defaultInstitutionId: ALIVE_INSTITUTION,
      responsibleUserMappings: [{ text: "GABRIEL", userId: ALIVE_USER }],
    };

    expect(isTemplateBroken(mapping, refs)).toBe(false);
  });

  it("aceita id no formato uuid legado como referência válida", () => {
    const legacyId = "3f1a2b4c-5d6e-4f70-8a91-2b3c4d5e6f70";
    const mapping = { ...healthyMapping, defaultCategoryId: legacyId };

    expect(isTemplateBroken(mapping, { ...refs, categoryIds: new Set([legacyId]) })).toBe(false);
  });

  // B1 — estrutural
  it("sinaliza mapeamento que não satisfaz o importMappingSchema", () => {
    // sem `columns.date` (min(1)) → safeParse falha
    const broken = { ...healthyMapping, columns: { ...healthyMapping.columns, date: "" } };

    expect(isTemplateBroken(broken, refs)).toBe(true);
  });

  it("sinaliza mapeamento que não é sequer um objeto de mapeamento", () => {
    expect(isTemplateBroken(null, refs)).toBe(true);
    expect(isTemplateBroken("nada disso", refs)).toBe(true);
    expect(isTemplateBroken({}, refs)).toBe(true);
  });

  // B2 — referência órfã
  it("sinaliza defaultCategoryId que não existe mais na conta", () => {
    const mapping = { ...healthyMapping, defaultCategoryId: "ccat_deleted1" };

    expect(isTemplateBroken(mapping, refs)).toBe(true);
  });

  it("sinaliza defaultInstitutionId que não existe mais na conta", () => {
    const mapping = { ...healthyMapping, defaultInstitutionId: "cinst_deleted1" };

    expect(isTemplateBroken(mapping, refs)).toBe(true);
  });

  it("sinaliza responsibleUserMappings apontando para quem não é mais membro", () => {
    const mapping = {
      ...healthyMapping,
      responsibleUserMappings: [
        { text: "GABRIEL", userId: ALIVE_USER },
        { text: "EX-MEMBRO", userId: "cuser_removed1" },
      ],
    };

    expect(isTemplateBroken(mapping, refs)).toBe(true);
  });

  it("trata null como 'sem padrão', não como referência órfã", () => {
    const mapping = {
      ...healthyMapping,
      defaultCategoryId: null,
      defaultInstitutionId: null,
      responsibleUserMappings: [],
    };

    expect(isTemplateBroken(mapping, refs)).toBe(false);
  });
});
