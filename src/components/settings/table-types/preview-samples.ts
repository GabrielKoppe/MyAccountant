// Spec 69 §2.1 — as DUAS LINHAS DE EXEMPLO da pré-visualização ao vivo (frame 05).
//
// ⚠️ ÚNICO ponto do pacote P3 com texto que não vem de `m.*`.
//
// O namespace `m.settings.presentation.tableTypes.preview` só tem `title` e
// `hint` — não há chave para o CONTEÚDO das linhas de amostra, e este pacote não
// pode editar `src/lib/messages/pt-BR.ts`. As poucas palavras inventadas (as duas
// descrições, os nomes de categoria/subcategoria/instituição/responsável e a tag)
// ficam concentradas AQUI, num arquivo só, para que a migração para
// `m.settings.presentation.tableTypes.preview.samples` seja uma troca de import.
//
// Tudo o que JÁ existe em `m.*` vem de lá: método de pagamento, tipo de gasto,
// tipo de investimento e o rótulo "Pendente". Valor e data usam os formatadores
// reais do projeto (`formatCentsToBrl`, `formatDateShort`) — a pré-visualização
// mostra a moeda e a data exatamente como a tabela do mês as escreve.

import { formatDateShort } from "@/lib/dates";
import { m } from "@/lib/messages";
import { formatCentsToBrl } from "@/lib/money";

import type { LivePreviewSample } from "./LivePreviewRow";

/** Datas fixas (e não `new Date()`): amostra determinística, teste sem relógio. */
const SAMPLE_DATE_1 = "2026-06-12";
const SAMPLE_DATE_2 = "2026-06-14";

export const PREVIEW_SAMPLES: readonly LivePreviewSample[] = [
  {
    id: "preview-1",
    cells: {
      occurredOn: { content: formatDateShort(SAMPLE_DATE_1) },
      description: { content: "Padaria Real" },
      category: { content: "Alimentação", colorKey: "green" },
      subcategory: { content: "Padaria", colorKey: "green" },
      institution: { content: "Nubank" },
      paymentMethod: { content: m.transactions.paymentMethods.credit_card },
      responsibleUser: { content: "Ana" },
      // O mesmo chip minúsculo que a linha real usa (`isPendingChip`), não o
      // rótulo do formulário.
      isPending: { content: m.transactions.fields.isPendingChip },
      cardInstallment: { content: "2/6", outlined: true },
      investmentType: { content: m.transactions.investmentTypes.ETF },
      expenseType: { content: m.transactions.expenseTypes.variable },
      tags: { content: "mercado" },
      notes: { content: "sem troco" },
      amount: { content: formatCentsToBrl(-8490n, { sign: true }), tone: "negative" },
    },
  },
  {
    id: "preview-2",
    cells: {
      occurredOn: { content: formatDateShort(SAMPLE_DATE_2) },
      description: { content: "Uber" },
      category: { content: "Transporte", colorKey: "amber" },
      institution: { content: "Nubank" },
      paymentMethod: { content: m.transactions.paymentMethods.credit_card },
      responsibleUser: { content: "Bruno" },
      expenseType: { content: m.transactions.expenseTypes.variable },
      amount: { content: formatCentsToBrl(-2340n, { sign: true }), tone: "negative" },
    },
  },
];

/** As descrições das duas linhas — a miniatura de densidade usa só elas. */
export const PREVIEW_SAMPLE_DESCRIPTIONS: readonly string[] = ["Padaria Real", "Uber"];
