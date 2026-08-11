import type { InstitutionKind } from "@prisma/client";

/**
 * Spec 68 §2.3 / §7.3 (EST-05) — quais campos de detalhe existem para cada tipo de
 * instituição.
 *
 * **Fonte única do vínculo tipo → campos.** A célula "Detalhes" da lista, o formulário
 * inline e a validação do servidor leem daqui; nenhum dos três reimplementa a regra.
 *
 * Mora em `lib/` (módulo puro, sem React) e não dentro do componente porque o schema
 * Zod precisa dele para **descartar no servidor** o valor dos campos que não se aplicam
 * — e um schema de Server Action não pode importar um componente client.
 */
export const DETAIL_FIELDS = {
  card: ["last4", "closingDay", "dueDay"],
  bank: ["branch", "accountNo"],
  company: ["taxId"],
  wallet: [],
  broker: [],
} as const satisfies Record<InstitutionKind, readonly string[]>;

/** União de todos os campos de detalhe, qualquer que seja o tipo. */
export type InstitutionDetailField = (typeof DETAIL_FIELDS)[InstitutionKind][number];

/**
 * Valores dos campos de detalhe.
 *
 * Os três estados de cada campo importam e são diferentes: `undefined` = "não
 * mencionei" (o Prisma ignora e o valor atual sobrevive), `null` = "apague", e o valor
 * em si. É essa distinção que deixa um toggle de status inline conviver com um cartão
 * que tem final e datas gravados.
 */
export type InstitutionDetails = {
  last4?: string | null;
  closingDay?: number | null;
  dueDay?: number | null;
  branch?: string | null;
  accountNo?: string | null;
  taxId?: string | null;
};

/** Todos os campos de detalhe existentes — usado para zerar os inaplicáveis. */
export const ALL_DETAIL_FIELDS = [
  "last4",
  "closingDay",
  "dueDay",
  "branch",
  "accountNo",
  "taxId",
] as const satisfies readonly (InstitutionDetailField & keyof InstitutionDetails)[];

/**
 * Os campos aplicáveis a um tipo. `null` (instituição ainda não classificada) não tem
 * campo nenhum: a célula mostra "—" até alguém escolher o tipo, e nunca um campo morto.
 */
export function detailFieldsFor(kind: InstitutionKind | null | undefined): readonly string[] {
  return kind ? DETAIL_FIELDS[kind] : [];
}

/**
 * Zera o que não pertence ao tipo.
 *
 * Critério de aceite da §4: trocar Cartão → Corretora **descarta** fechamento e
 * vencimento. Aplicado no servidor, não só na UI — senão um valor órfão sobrevive na
 * linha e reaparece se o usuário voltar o tipo para Cartão, contrariando o que a tela
 * mostrou no momento da troca.
 *
 * ⚠️ Monta `out` campo a campo — nunca `{ ...values }` — porque `values` na tela é o
 * `Draft` inteiro da linha (nome e `kind` inclusos, não só os seis campos de detalhe).
 * Um `{ ...values }` copiaria esse `kind` ANTIGO para dentro do retorno; como o chamador
 * de `InstitutionsManager` monta o próximo draft com `{ ...prev, kind: nextKind,
 * ...stripped }`, o `kind` vazado em `stripped` reaplicava por cima e desfazia a
 * escolha do usuário — o tipo nunca gravava. Reproduzido em teste antes do conserto.
 */
export function stripInapplicableDetails(
  kind: InstitutionKind | null | undefined,
  values: InstitutionDetails,
): InstitutionDetails {
  const applicable = new Set<string>(detailFieldsFor(kind));
  // Campo a campo, e não um laço sobre `ALL_DETAIL_FIELDS` escrevendo num objeto
  // genérico: com uma chave de tipo união, o TypeScript não consegue provar que
  // `values[field]` (string | number | null | undefined) cabe em `out[field]` para
  // TODAS as chaves ao mesmo tempo — só campo a campo o tipo de cada um fica exato.
  return {
    last4: applicable.has("last4") ? values.last4 : null,
    closingDay: applicable.has("closingDay") ? values.closingDay : null,
    dueDay: applicable.has("dueDay") ? values.dueDay : null,
    branch: applicable.has("branch") ? values.branch : null,
    accountNo: applicable.has("accountNo") ? values.accountNo : null,
    taxId: applicable.has("taxId") ? values.taxId : null,
  };
}
