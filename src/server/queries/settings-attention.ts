// Spec 67 §2.1 (decisão D9) — sinalizadores do bloco "N itens pedem atenção"
// do hub de Configurações.
//
// REGRA DE OURO (SET-07): nenhuma query aqui toca `Transaction`. Todos os
// sinalizadores são sobre tabelas de configuração — pequenas, limitadas e
// baratas. Qualquer coisa que precise varrer transações é contagem sob
// demanda (§2.4), não sinalizador de hub.
//
// Eram três (Spec 67 §2.1/D9). A Spec 69 §4 acrescentou o quarto — "modelo com
// automação apontando para seção inativa" —, porque é um critério de aceite
// explícito dela: o modelo bloqueado não cria tabela nenhuma no mês novo e o
// usuário só descobriria isso pela ausência.
//
// A ORDEM do array devolvido É a ordem da tabela do §2.1 e é significativa: o
// botão "Revisar" do hub leva ao `href` do PRIMEIRO item.
//
// Envolvido em React.cache: o hub renderiza o banner e o contador na mesma
// render e o Prisma roda uma vez só.

import type { Prisma } from "@prisma/client";
import { cache } from "react";

import { formatMonthLabel, getCurrentFiscalMonth } from "@/lib/dates";
import { m } from "@/lib/messages";
import { isTemplateBroken } from "@/lib/settings/broken-template";
import { prisma } from "@/server/prisma";

export type AttentionSignal = {
  kind: "aliasIncomplete" | "templateBroken" | "templateSectionInactive" | "checklistNotStarted";
  /** frase já pronta para exibir, vinda de m.settings.hub.signals.* */
  label: string;
  /** destino do "Revisar": href relativo a /[accountId]/settings/ , com o filtro pré-aplicado */
  href: string;
  count: number;
};

/**
 * Sinalizador (a) — APELIDO INCOMPLETO.
 *
 * Um `TransactionAlias` que não preenche NENHUM campo de destino: casa com a
 * transação e não faz nada com ela. Os 17 campos abaixo são o payload inteiro
 * do model, mais a relação `tags` — um apelido que só aplica tags é um uso
 * legítimo e NÃO é incompleto.
 *
 * Deliberadamente FORA do filtro:
 * - `trigger` / `triggerNormalized` / `triggerMode` / `priority` → identidade
 *   do apelido, não destino;
 * - `conditionInstitutionId` / `minCents` / `maxCents` → condições de
 *   correspondência. Um apelido que só tem condição continua não definindo
 *   nada, logo continua incompleto.
 *
 * `archivedAt: null` porque apelido arquivado não pede atenção.
 *
 * EXPORTADA para a página de Apelidos reusar em `?filter=incomplete` — a regra
 * não pode existir em dois lugares. O chamador acrescenta o `accountId`.
 */
export const INCOMPLETE_ALIAS_WHERE = {
  archivedAt: null,
  description: null,
  notes: null,
  amountCents: null,
  categoryId: null,
  subcategoryId: null,
  institutionId: null,
  institutionText: null,
  responsiblePartyId: null,
  expenseType: null,
  paymentMethod: null,
  investmentType: null,
  cardInstallment: null,
  isPending: null,
  isFavorite: null,
  originalCurrency: null,
  originalAmountCents: null,
  exchangeRate: null,
  tags: { none: {} },
} satisfies Prisma.TransactionAliasWhereInput;

/**
 * @param accountId conta corrente — multi-tenancy: todo `where` filtra por ela.
 *   A autorização é do chamador (o hub já roda sob `requireAccountAccess`).
 */
export const getSettingsAttention = cache(async function getSettingsAttention(
  accountId: string,
): Promise<AttentionSignal[]> {
  const [
    incompleteAliasCount,
    templates,
    categories,
    institutions,
    members,
    settingsRow,
    firstChecklistItem,
    autoTemplates,
    inactiveSections,
  ] = await Promise.all([
    prisma.transactionAlias.count({ where: { accountId, ...INCOMPLETE_ALIAS_WHERE } }),
    // Sinalizador (b): `mapping` é Json puro, sem FK — a decisão é em memória,
    // então trazemos os templates e os 3 conjuntos de ids de uma vez só.
    prisma.csvTemplate.findMany({ where: { accountId }, select: { id: true, mapping: true } }),
    prisma.category.findMany({ where: { accountId }, select: { id: true } }),
    prisma.institution.findMany({ where: { accountId }, select: { id: true } }),
    prisma.accountMember.findMany({ where: { accountId }, select: { userId: true } }),
    // Sinalizador (c): "mês corrente" respeita o dia de virada da conta.
    prisma.accountSettings.findUnique({ where: { accountId }, select: { monthStartDay: true } }),
    // GUARDA do sinalizador (c): só faz sentido cobrar "checklist não iniciado"
    // de quem TEM checklist. Sem isto, toda conta que nunca criou um item fica
    // pedindo atenção para sempre. `findFirst` porque a pergunta é "existe ao
    // menos um?", não "quantos?".
    prisma.checklistItem.findFirst({ where: { accountId }, select: { id: true } }),
    // Sinalizador (d): `TableTemplate.autoSectionId` NÃO tem relação Prisma com
    // `Section` (é um id solto), então não dá para perguntar
    // `section: { isActive: false }` num `where`. Trazemos os dois conjuntos —
    // ambos minúsculos e de configuração — e cruzamos em memória, exatamente
    // como o sinalizador (b) faz com o `mapping` Json.
    //
    // Só `autoApply: true`: modelo sem automação não cria nada num mês novo,
    // logo uma seção inativa nele não bloqueia coisa alguma. O filtro é o MESMO
    // de `month-service.applyAutoTemplates`, para o sinal contar exatamente o
    // que a criação de mês vai pular.
    prisma.tableTemplate.findMany({
      where: { accountId, autoApply: true, autoSectionId: { not: null } },
      select: { id: true, autoSectionId: true },
    }),
    prisma.section.findMany({ where: { accountId, isActive: false }, select: { id: true } }),
  ]);

  const signals: AttentionSignal[] = [];

  if (incompleteAliasCount > 0) {
    signals.push({
      kind: "aliasIncomplete",
      label: m.settings.hub.signals.aliasIncomplete(incompleteAliasCount),
      href: "aliases?filter=incomplete",
      count: incompleteAliasCount,
    });
  }

  const refs = {
    categoryIds: new Set(categories.map((c) => c.id)),
    institutionIds: new Set(institutions.map((i) => i.id)),
    memberUserIds: new Set(members.map((mb) => mb.userId)),
  };
  const brokenTemplateCount = templates.filter((t) => isTemplateBroken(t.mapping, refs)).length;

  if (brokenTemplateCount > 0) {
    signals.push({
      kind: "templateBroken",
      label: m.settings.hub.signals.templateBroken(brokenTemplateCount),
      href: "templates?filter=broken",
      count: brokenTemplateCount,
    });
  }

  // Sinalizador (d) — MODELO COM SEÇÃO DE DESTINO INATIVA (Spec 69 §4).
  //
  // Vem depois do template quebrado e antes do checklist porque é da mesma
  // natureza dos dois primeiros — configuração que deixou de funcionar — e o
  // checklist é lembrete, não defeito. A ordem decide o destino do "Revisar".
  const inactiveSectionIds = new Set(inactiveSections.map((s) => s.id));
  const templatesWithInactiveSection = autoTemplates.filter(
    (t) => t.autoSectionId !== null && inactiveSectionIds.has(t.autoSectionId),
  ).length;

  if (templatesWithInactiveSection > 0) {
    signals.push({
      kind: "templateSectionInactive",
      label: m.settings.hub.signals.templateSectionInactive(templatesWithInactiveSection),
      // Sem `?filter=`: a página de Modelos ainda não tem esse filtro (chega com
      // o master-detail da Spec 69 §2.2). Prometer um filtro que não existe é
      // pior que levar à página inteira.
      href: "models",
      count: templatesWithInactiveSection,
    });
  }

  if (firstChecklistItem) {
    const fiscal = getCurrentFiscalMonth(new Date(), settingsRow?.monthStartDay ?? 1);
    // Conclusão é por (item, mês); a ausência TOTAL no mês corrente é "não
    // iniciado". Filtra pelo par ano/mês da relação — se o Month sequer existe
    // ainda, não há conclusão e o sinal vale igual.
    const firstCompletion = await prisma.checklistCompletion.findFirst({
      where: { accountId, month: { accountId, year: fiscal.year, month: fiscal.month } },
      select: { id: true },
    });

    if (!firstCompletion) {
      signals.push({
        kind: "checklistNotStarted",
        label: m.settings.hub.signals.checklistNotStarted(
          formatMonthLabel(fiscal.year, fiscal.month),
        ),
        href: "checklist",
        // Sinal booleano: ou o mês está iniciado, ou não está.
        count: 1,
      });
    }
  }

  return signals;
});
