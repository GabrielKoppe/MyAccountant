import { describe, expect, it } from "vitest";

import {
  ALL_DETAIL_FIELDS,
  DETAIL_FIELDS,
  detailFieldsFor,
  stripInapplicableDetails,
} from "./institution-details";

// Spec 68 §8 — o mapa tipo → campos é a fonte única do vínculo. Estes testes existem
// para que acrescentar um `InstitutionKind` novo sem declarar seus campos quebre aqui,
// e não em produção com uma célula vazia.

describe("DETAIL_FIELDS", () => {
  it("cobre os cinco tipos de instituição", () => {
    expect(Object.keys(DETAIL_FIELDS).sort()).toEqual([
      "bank",
      "broker",
      "card",
      "company",
      "wallet",
    ]);
  });

  it("não tem campo órfão: todo campo declarado existe em ALL_DETAIL_FIELDS", () => {
    const declared = new Set(Object.values(DETAIL_FIELDS).flat());
    for (const field of declared) {
      expect(ALL_DETAIL_FIELDS).toContain(field);
    }
    // E o inverso: nenhum campo de ALL_ fica sem dono, o que significaria uma coluna
    // no banco que nenhuma tela consegue preencher.
    for (const field of ALL_DETAIL_FIELDS) {
      expect(declared.has(field)).toBe(true);
    }
  });

  it("carteira e corretora não têm detalhe nenhum", () => {
    expect(DETAIL_FIELDS.wallet).toEqual([]);
    expect(DETAIL_FIELDS.broker).toEqual([]);
  });
});

describe("detailFieldsFor", () => {
  it("tipo nulo (instituição não classificada) não tem campo", () => {
    expect(detailFieldsFor(null)).toEqual([]);
    expect(detailFieldsFor(undefined)).toEqual([]);
  });

  it("cartão pede final, fechamento e vencimento", () => {
    expect(detailFieldsFor("card")).toEqual(["last4", "closingDay", "dueDay"]);
  });
});

describe("stripInapplicableDetails", () => {
  const full = {
    last4: "4471",
    closingDay: 8,
    dueDay: 15,
    branch: "0192",
    accountNo: "34567-8",
    taxId: "12.345.678/0001-90",
  };

  it("cartão mantém só os campos de cartão", () => {
    expect(stripInapplicableDetails("card", full)).toEqual({
      last4: "4471",
      closingDay: 8,
      dueDay: 15,
      branch: null,
      accountNo: null,
      taxId: null,
    });
  });

  it("banco mantém só agência e conta", () => {
    expect(stripInapplicableDetails("bank", full)).toEqual({
      last4: null,
      closingDay: null,
      dueDay: null,
      branch: "0192",
      accountNo: "34567-8",
      taxId: null,
    });
  });

  it("empresa mantém só o CNPJ", () => {
    expect(stripInapplicableDetails("company", full)).toEqual({
      last4: null,
      closingDay: null,
      dueDay: null,
      branch: null,
      accountNo: null,
      taxId: "12.345.678/0001-90",
    });
  });

  it("cartão -> corretora descarta fechamento e vencimento (critério da §4)", () => {
    // É o caso do e2e: o usuário troca o tipo e os campos somem da tela. Se o valor
    // sobrevivesse no banco, voltar o tipo para Cartão o traria de volta — mostrando
    // um dado que a tela já tinha declarado descartado.
    expect(stripInapplicableDetails("broker", full)).toEqual({
      last4: null,
      closingDay: null,
      dueDay: null,
      branch: null,
      accountNo: null,
      taxId: null,
    });
  });

  it("tipo nulo zera tudo — sem tipo não há detalhe que se aplique", () => {
    expect(stripInapplicableDetails(null, full)).toEqual({
      last4: null,
      closingDay: null,
      dueDay: null,
      branch: null,
      accountNo: null,
      taxId: null,
    });
  });

  it("preserva `undefined` dos campos aplicáveis (= 'não mencionei', o Prisma ignora)", () => {
    const partial = { last4: undefined, closingDay: 8, dueDay: undefined };
    const out = stripInapplicableDetails("card", partial);

    expect(out.last4).toBeUndefined();
    expect(out.closingDay).toBe(8);
    expect(out.dueDay).toBeUndefined();
    // Já os inaplicáveis viram `null` de verdade — esses precisam ser apagados.
    expect(out.branch).toBeNull();
  });

  it("não vaza propriedades extras do objeto recebido (bug real: 'trocar o tipo não grava')", () => {
    // `InstitutionsManager.handleKindChange` chama esta função passando o `Draft`
    // INTEIRO da linha (que tem `name` e `kind`, além dos seis campos de detalhe), não
    // um `InstitutionDetails` limpo. Antes do conserto, `{ ...values }` copiava esse
    // `kind` ANTIGO para dentro do retorno; como o chamador monta o próximo draft com
    // `{ ...prev, kind: nextKind, ...stripped }`, o `kind` vazado em `stripped`
    // reaplicava por cima e desfazia a escolha do usuário — o tipo nunca gravava.
    const draftLike = {
      name: "Nubank",
      kind: null as string | null,
      ...full,
    };

    const out = stripInapplicableDetails("card", draftLike);

    expect(out).not.toHaveProperty("name");
    expect(out).not.toHaveProperty("kind");
    expect(out).toEqual({
      last4: "4471",
      closingDay: 8,
      dueDay: 15,
      branch: null,
      accountNo: null,
      taxId: null,
    });
  });
});
