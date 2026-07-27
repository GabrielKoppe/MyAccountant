import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

/**
 * Guarda de cobertura de campos — Spec 66 §7.1/§7.2 (Pacote P8).
 *
 * O universo auditado é `Prisma.TransactionScalarFieldEnum` (os nomes reais dos
 * campos escalares do model `Transaction`, gerados a partir de `prisma/schema.prisma`).
 * Todo campo escalar precisa estar em exatamente UM dos três baldes abaixo — nunca
 * em zero, nunca em mais de um. Isso garante que nenhum campo de negócio fique "órfão"
 * (sem superfície de UI) e que a spec não fique desatualizada silenciosamente quando o
 * schema ganhar um campo novo (o teste falha e força decidir o balde).
 */

/**
 * Campos de negócio ("de domínio") e a superfície do modal/linha onde aparecem,
 * conforme a tabela definitiva de §7.1 e a estrutura de abas de §7.2.
 *
 * Chave = nome do campo escalar (igual ao `Prisma.TransactionScalarFieldEnum`).
 * Valor = superfície onde o campo é exibido (cabeçalho, aba do modal, etc).
 */
const DOMAIN_FIELD_SURFACES: Record<string, string> = {
  // Cabeçalho do modal de detalhe (§7.1)
  occurredOn: "header",
  description: "header",
  amountCents: "header",
  isPending: "header", // status via StatusBadge
  isFavorite: "header", // status via StatusBadge

  // Aba "Resumo" (§7.2)
  categoryId: "tab:resumo",
  subcategoryId: "tab:resumo",
  institutionId: "tab:resumo",
  institutionText: "tab:resumo",
  responsiblePartyId: "tab:resumo",
  originalCurrency: "tab:resumo",
  originalAmountCents: "tab:resumo",
  exchangeRate: "tab:resumo",
  notes: "tab:resumo", // bloco Nota, read-only

  // Aba "Classificação" (§7.2)
  expenseType: "tab:classificacao",
  paymentMethod: "tab:classificacao",
  investmentType: "tab:classificacao",

  // Aba "Parcelas e vínculos" (§7.2)
  installmentGroupId: "tab:parcelas-vinculos",
  installmentNumber: "tab:parcelas-vinculos",

  // Aba "Histórico" (§7.2)
  source: "tab:historico",
  createdById: "tab:historico",
  createdAt: "tab:historico",
  updatedById: "tab:historico",
  updatedAt: "tab:historico",
};

/**
 * Campos estruturais/roteamento — não são "dado de negócio", são as chaves que
 * amarram a transação ao tenant/mês/tabela/seção. Não têm (nem precisam ter)
 * superfície de UI própria: aparecem implicitamente pelo contexto de onde a
 * transação está sendo exibida.
 */
const STRUCTURAL_FIELDS: string[] = ["id", "accountId", "monthId", "tableId", "sectionId"];

/**
 * Campos explicitamente fora da UI (§7.1):
 * - `cardInstallment`: texto livre legado (TX-02b), nunca preenchido nem exibido —
 *   o conceito vigente de parcelamento é `InstallmentGroup`/`installmentNumber`.
 * - `metadata`: JSON de uso futuro, sem consumidor de UI nesta spec.
 */
const NO_UI_FIELDS: string[] = ["cardInstallment", "metadata"];

describe("field-surface-coverage (Spec 66 §7.1/§7.2)", () => {
  const scalarFieldEnum = Prisma.TransactionScalarFieldEnum as Record<string, string>;
  const enumFields = new Set(Object.keys(scalarFieldEnum));

  const domainFields = Object.keys(DOMAIN_FIELD_SURFACES);

  it("a união dos 3 baldes cobre exatamente o enum escalar de Transaction (sem sobra, sem faltante)", () => {
    const union = new Set<string>([...domainFields, ...STRUCTURAL_FIELDS, ...NO_UI_FIELDS]);

    const missingFromUnion = [...enumFields].filter((field) => !union.has(field));
    const extraInUnion = [...union].filter((field) => !enumFields.has(field));

    expect(missingFromUnion).toEqual([]);
    expect(extraInUnion).toEqual([]);
  });

  it("os 3 baldes são disjuntos entre si (nenhum campo em 2 baldes)", () => {
    const buckets: Array<{ name: string; fields: string[] }> = [
      { name: "DOMAIN_FIELD_SURFACES", fields: domainFields },
      { name: "STRUCTURAL_FIELDS", fields: STRUCTURAL_FIELDS },
      { name: "NO_UI_FIELDS", fields: NO_UI_FIELDS },
    ];

    const seenIn: Record<string, string[]> = {};
    for (const bucket of buckets) {
      for (const field of bucket.fields) {
        seenIn[field] = [...(seenIn[field] ?? []), bucket.name];
      }
    }

    const duplicated = Object.entries(seenIn).filter(([, owners]) => owners.length > 1);

    expect(duplicated).toEqual([]);
  });

  it("toda chave de DOMAIN_FIELD_SURFACES existe no enum real (sem entradas obsoletas/stale)", () => {
    const staleKeys = domainFields.filter((field) => !enumFields.has(field));

    expect(staleKeys).toEqual([]);
  });

  it("cardInstallment (drop legado TX-02b) e metadata (fora da UI) estão em NO_UI_FIELDS", () => {
    expect(NO_UI_FIELDS).toContain("cardInstallment");
    expect(NO_UI_FIELDS).toContain("metadata");
  });
});
