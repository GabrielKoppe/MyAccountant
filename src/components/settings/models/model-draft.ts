// Spec 69 §2.2 / §14 P6 — estado editável de um modelo de tabela (aba "Definição").
//
// Módulo PURO: sem React, sem Prisma. É aqui que moram as duas regras que o
// gerente de página não pode errar — o que conta como "alteração não salva" e o
// que "Ordem dentro da seção" significa de verdade.

/** Os cinco campos que a aba "Definição" edita. `""` = "nenhum" nos selects. */
export type ModelDraft = {
  name: string;
  /** D7 — campo ÚNICO do tipo. `autoTableTypeId` está deprecated e não aparece na UI. */
  tableTypeId: string;
  autoApply: boolean;
  autoSectionId: string;
  /**
   * Posição do modelo ENTRE os modelos automáticos da mesma seção, 0-based.
   * `null` = "no fim" — que é como o banco nasce (a coluna é `Int?`).
   */
  orderInSection: number | null;
};

/** O recorte de um modelo salvo de que este módulo precisa. */
export type ModelDraftSource = {
  id: string;
  name: string;
  tableTypeId: string | null;
  autoApply: boolean;
  autoSectionId: string | null;
  orderInSection: number | null;
};

export function draftFromModel(model: ModelDraftSource): ModelDraft {
  return {
    name: model.name,
    tableTypeId: model.tableTypeId ?? "",
    autoApply: model.autoApply,
    autoSectionId: model.autoSectionId ?? "",
    orderInSection: model.orderInSection,
  };
}

/**
 * Quantos campos divergem do último salvo — é o `dirtyCount` do `SettingsSaveBar`.
 *
 * **Seção e Ordem só contam sob a automação.** Desligar o toggle ESCONDE os dois
 * campos, mas não os apaga do rascunho (critério de aceite da §14/P6: "desligar
 * mantém o resto do formulário intacto"). Se eles continuassem contando escondidos,
 * o rodapé anunciaria "3 alterações não salvas" apontando para dois campos que o
 * usuário não vê — e o `Descartar` pareceria não funcionar.
 */
export function countDirtyFields(draft: ModelDraft, model: ModelDraftSource): number {
  const saved = draftFromModel(model);
  let dirty = 0;

  if (draft.name.trim() !== saved.name.trim()) dirty += 1;
  if (draft.tableTypeId !== saved.tableTypeId) dirty += 1;
  if (draft.autoApply !== saved.autoApply) dirty += 1;

  if (draft.autoApply) {
    if (draft.autoSectionId !== saved.autoSectionId) dirty += 1;
    if (draft.orderInSection !== saved.orderInSection) dirty += 1;
  }

  return dirty;
}

// ─── Ordem dentro da seção ─────────────────────────────────────────────────────

/** Um modelo automático de uma seção, do ponto de vista da ordenação. */
export type AutomationMember = {
  id: string;
  name: string;
  orderInSection: number | null;
};

/**
 * `null` vai para o fim: é o valor de quem nunca foi ordenado, e o frame lê a
 * ordem como uma fila ("1ª de 2"). Empate desempata por nome para a lista não
 * dançar entre renders — dois modelos com o mesmo `orderInSection` acontecem
 * enquanto só o modelo editado é renumerado.
 */
export function sortAutomationMembers<T extends AutomationMember>(members: T[]): T[] {
  return [...members].sort((a, b) => {
    const orderA = a.orderInSection ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.orderInSection ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name, "pt-BR");
  });
}

/**
 * Os OUTROS modelos automáticos da seção — é a lista que decide se o campo
 * "Ordem dentro da seção" aparece. Sem nenhum irmão não há ordem a discutir, e o
 * frame não mostra o campo (§14/P6).
 */
export function automationSiblings<
  T extends AutomationMember & { autoApply: boolean; autoSectionId: string | null },
>(models: T[], selfId: string, sectionId: string): T[] {
  if (!sectionId) return [];
  return sortAutomationMembers(
    models.filter((mm) => mm.id !== selfId && mm.autoApply && mm.autoSectionId === sectionId),
  );
}

/**
 * `orderInSection` do rascunho lido como ÍNDICE DE INSERÇÃO entre os irmãos.
 *
 * Ler o campo como índice (e não como um número solto a ser comparado) é o que
 * torna o stepper previsível com um único campo persistido: o modelo editado
 * sempre pousa exatamente onde o usuário mandou, mesmo que os irmãos ainda
 * carreguem valores antigos ou repetidos vindos do banco.
 */
export function clampInsertionIndex(index: number | null, siblingCount: number): number {
  if (index === null || !Number.isFinite(index)) return siblingCount;
  return Math.min(siblingCount, Math.max(0, Math.trunc(index)));
}

/** A fila final da seção: os irmãos em ordem, com o modelo editado encaixado. */
export function buildSectionOrder(
  siblings: AutomationMember[],
  selfId: string,
  insertionIndex: number | null,
): string[] {
  const ids = siblings.map((s) => s.id);
  ids.splice(clampInsertionIndex(insertionIndex, siblings.length), 0, selfId);
  return ids;
}

/**
 * Renumeração a persistir depois de um movimento: só os modelos cujo
 * `orderInSection` gravado difere da posição final.
 *
 * Sem isto, mover um modelo para o topo o deixaria com `0` enquanto o antigo
 * primeiro continuaria em `0` — e o desempate por nome decidiria a fila, não o
 * usuário.
 */
export function orderPatches(
  order: string[],
  stored: Map<string, number | null>,
): { templateId: string; orderInSection: number }[] {
  return order
    .map((id, index) => ({ templateId: id, orderInSection: index }))
    .filter((patch) => stored.get(patch.templateId) !== patch.orderInSection);
}
