"use client";

import { useRouter } from "next/navigation";
import { useSnackbar } from "notistack";
import { useRef, useState, useTransition } from "react";

import { useActionFeedback } from "@/lib/hooks/use-action-feedback";
import { m } from "@/lib/messages";
import type { SerializedGoal } from "@/lib/serializers/goal";
import type { GoalDetail, GoalSuggestion } from "@/server/queries/goals";

type State = {
  target: SerializedGoal | null;
  detail: GoalDetail | null;
  suggestions: GoalSuggestion[];
  // Nome da seção/categoria da meta (Fase 12, §5.3) — acompanha `suggestions` mas não é
  // repetido por item (sobrevive mesmo com `suggestions: []`, ver goals.ts:GoalSuggestionsResult).
  suggestionsDimensionLabel: string | null;
};

const CLOSED_STATE: State = {
  target: null,
  detail: null,
  suggestions: [],
  suggestionsDimensionLabel: null,
};

/**
 * Estado + fetch sob demanda do drawer de detalhe da meta (spec 47 §5.3/§12 Fase 9).
 *
 * MECANISMO adotado (investigado antes de implementar): a spec 27 (painel de detalhe da
 * transação) NÃO serviu de referência aqui — lá o dialog só lê props já carregadas na
 * página (`TransactionDetailDialog`, sem fetch ao abrir), porque a tabela já tem a
 * transação inteira em memória. O detalhe da meta precisa de dado que a aba Metas NUNCA
 * pré-carrega por card (glide-path + split + histórico + sugestões de TODAS as metas
 * seria caro e majoritariamente descartado). O padrão real do repo pra "buscar o detalhe
 * completo de 1 item, sob demanda, ao abrir um drawer" é o DRILL-DOWN dos dashboards
 * (`DrillDownDrawer` + `getDrawerTransactionsAction`, `MonthlyDashboardClient.tsx`, skill
 * `dashboards-charts` §7): abrir dispara a busca IMPERATIVAMENTE dentro do próprio
 * handler de clique (aqui, `open()`), via `useTransition` — nunca um `useEffect`
 * reagindo à mudança de prop/id. `getGoalDetail`/`getGoalSuggestions` (queries/goals.ts,
 * `React.cache` para uso em RSC) são consumidas por Server Actions finas
 * (`getGoalDetailAction`/`getGoalSuggestionsAction`, actions/goals.ts) que só repassam
 * `ctx.accountId` — nenhum cálculo é duplicado no client.
 *
 * Sugestões (GOAL-05) só são buscadas quando `canEdit`: viewer nunca as vê (§5.2 —
 * "sugestões ocultas"), então evita-se a query à toa.
 */
export function useGoalDetail(accountId: string, canEdit: boolean) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const { handle } = useActionFeedback();
  const [state, setState] = useState<State>(CLOSED_STATE);
  const [loading, startLoadTransition] = useTransition();
  const [mutating, startMutateTransition] = useTransition();

  // Guarda contra corrida: se o usuário abrir outra meta antes desta busca resolver
  // (duplo clique rápido entre cards), só aplica o resultado se ainda for o goalId mais
  // recente pedido — senão uma resposta atrasada da meta A sobrescreveria a B.
  const latestGoalId = useRef<string | null>(null);

  function fetchDetail(goalId: string) {
    startLoadTransition(async () => {
      const { getGoalDetailAction, getGoalSuggestionsAction } = await import("@/actions/goals");
      const [detailResult, suggestionsResult] = await Promise.all([
        getGoalDetailAction(accountId, { goalId }),
        canEdit ? getGoalSuggestionsAction(accountId, { goalId }) : null,
      ]);
      if (latestGoalId.current !== goalId) return; // superado por uma abertura mais nova

      setState((prev) => ({
        ...prev,
        detail: detailResult.ok ? detailResult.data : null,
        suggestions: suggestionsResult?.ok ? suggestionsResult.data.suggestions : [],
        suggestionsDimensionLabel: suggestionsResult?.ok ? suggestionsResult.data.dimensionLabel : null,
      }));
    });
  }

  function open(goal: SerializedGoal) {
    latestGoalId.current = goal.id;
    setState({ target: goal, detail: null, suggestions: [], suggestionsDimensionLabel: null });
    fetchDetail(goal.id);
  }

  function close() {
    latestGoalId.current = null;
    setState(CLOSED_STATE);
  }

  function linkSuggestion(transactionId: string) {
    const goalId = state.target?.id;
    if (!goalId) return;
    startMutateTransition(async () => {
      const { linkSuggestedContributionAction } = await import("@/actions/goals");
      const result = await linkSuggestedContributionAction(accountId, { goalId, transactionId });
      if (!handle(result)) return;
      enqueueSnackbar(m.goals.suggestionLinked, { variant: "success" });
      fetchDetail(goalId); // re-sincroniza glide-path/split/histórico/progresso no drawer
      router.refresh(); // + o card na grid por trás (progressCents/pace mudaram)
    });
  }

  function removeContribution(contributionId: string) {
    const goalId = state.target?.id;
    if (!goalId) return;
    startMutateTransition(async () => {
      const { deleteContributionAction } = await import("@/actions/goals");
      const result = await deleteContributionAction(accountId, { contributionId });
      if (!handle(result)) return;
      enqueueSnackbar(m.goals.contributionDeleted, { variant: "success" });
      fetchDetail(goalId);
      router.refresh();
    });
  }

  return {
    target: state.target,
    detail: state.detail,
    suggestions: state.suggestions,
    suggestionsDimensionLabel: state.suggestionsDimensionLabel,
    loading,
    mutating,
    open,
    close,
    linkSuggestion,
    removeContribution,
  };
}
