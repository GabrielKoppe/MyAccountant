# Spec 50 — Motor de Regras de Auto-categorização

> **Status: superseded (2026-07-22) — FUNDIDA na spec 61 (Apelidos).** Decisão de produto: Apelido e Regra eram quase o mesmo conceito para o usuário (condição → ação), causando confusão. A entidade `CategorizationRule` foi **removida**; seus poderes (match `regex`, condição por instituição, faixa de valor, prioridade Alta/Média/Baixa) foram **absorvidos pelo `TransactionAlias`** sob uma seção "Correspondência avançada". Esta spec fica como registro histórico do motor; a implementação viva está na **spec 61**. Ver a nota de extensão 2026-07-22 na spec 61.
> Status anterior: ready
> Insumo: levantamento estratégico e benchmark de mercado PFM (2026-06-29) — pilar Profundidade Financeira · reescrita V2 (2026-07-21) ancorada em mapeamento de código do pipeline de import/apelidos (âncoras `file:line` re-verificadas em `src/`, `prisma/schema.prisma`) + 3 decisões de produto tomadas com o dev nesta sessão (manual = confirmar, reorder = setas, preview = ícone único com atribuição de fonte)
> Skills: [`server-actions`](../skills/server-actions/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md) · [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md) · [`money-handling`](../skills/money-handling/SKILL.md) · [`design-system`](../skills/design-system/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`ui-feedback`](../skills/ui-feedback/SKILL.md) · [`rsc-client-boundary`](../skills/rsc-client-boundary/SKILL.md) · [`logging`](../skills/logging/SKILL.md) · [`testing`](../skills/testing/SKILL.md)

---

## 1. Problema

- **RULE-01 (categorização repetitiva no import)**: o import CSV/XLSX (spec 10) traz transações sem categoria. Os Apelidos (spec 61) já reduzem isso, mas **só casam por substring da descrição** (`src/lib/aliases/match.ts:14` — `haystack.includes(triggerNormalized)`). Não há como expressar num único gatilho "todo `UBER` **ou** `99APP` **ou** `CABIFY`" (regex), nem casar por **instituição** ou **faixa de valor** — dimensões que o extrato traz mas o apelido ignora.

- **RULE-02 (categorização repetitiva no manual)**: no lançamento manual, o apelido cobre padrões **nomeados** via popover (`src/components/transactions/NewTransactionRow.tsx:366-401`), mas não há memória automática baseada em **valor** ou **instituição** — só descrição. "Todo débito do Nubank cartão acima de R$ 500" não tem como ser sugerido.

- **RULE-03 (não existe motor if-then)**: não há um motor condição→ação com **prioridade**, **parar-ao-casar** e **AND de múltiplas condições** como o de Firefly III / Monarch. O único mecanismo automático hoje (`matchAlias`) é substring simples, sem ordenação, sem acúmulo, sem condições ricas.

- **RULE-04 (precedência apelido↔regra não implementada)**: a spec 61 **reservou** a precedência (DD-11, `specs/61-transaction-aliases.md:181` — "apelido, por ser intencional, tem precedência") mas não implementou nenhum motor de regras. Sem a spec 50, essa decisão fica órfã; com ela, é preciso um ponto único onde a colisão (apelido e regra tocando o mesmo campo na mesma transação) seja resolvida de forma determinística no import **e** no manual.

---

## 2. Solução

Modelo `CategorizationRule` (tenant-scoped, espelhando o slice de `TransactionAlias`) + um **motor puro único** `evaluateRules`, reusado em **três** superfícies (popover manual client, preview de import client, import server autoritativo) — exatamente como `matchAlias` é reusado hoje. As ações da regra reaproveitam o conjunto de campos-alvo dos apelidos e a mesma divisão manual/import.

> **Fronteira com a Spec 61 (crítica).** Apelido é **intencional e nomeado** (o usuário decide "apelidar esta descrição"). Regra é um **filtro automático** (condições → ações) que o usuário configura uma vez e esquece. Elas **coexistem**: no import a regra aplica no server autoritativo; no manual a regra **também** passa pelo popover de confirmação (decisão DD-03 desta spec — revê a AC original que pedia aplicação silenciosa). Quando ambas tocam o mesmo campo, **o apelido vence** (honra DD-11 da 61).

### 2.1 Entidade + join de tags

`CategorizationRule` com **condições em slots fixos** (não lista repetível — DD-01) todas opcionais e combinadas por **AND**, e **ações** como patch parcial (só define; nunca limpa — igual ao apelido, DD-04 da 61). Tags via join próprio `CategorizationRuleTag` (não `Json` — DD-08, permite validar ownership multi-tenant por FK). Responsável via **`ResponsibleParty`** (não `User` — DD-09, corrige o rascunho original). Ver modelo em §7.

- **Condições** (AND entre as preenchidas): `descriptionMode` (`contains`/`regex`) + `descriptionValue`; `conditionInstitutionId`; faixa de valor `minCents`/`maxCents` (`BigInt`).
- **Ações** (patch parcial, `null` = não define). Divididas como no apelido:
  - **Aplicáveis no manual (popover) E no import**: `setDescription`, `setNotes`, `setCategoryId`, `setSubcategoryId`, `setInstitutionId`/`setInstitutionText`, `setResponsiblePartyId`, `setExpenseType`, `setPaymentMethod`, `setIsPending`.
  - **Só no import** (fora do popover manual, mesma razão de escopo de `AliasApplicableFields` em `src/lib/aliases/apply.ts:26-38`): tags (`CategorizationRuleTag`), `setInvestmentType`, `setCardInstallment`, `setIsFavorite`.
- **Controle**: `priority` (menor avaliada primeiro), `isActive`, `stopOnMatch`, `applyToManual`.
- **`setInstitutionId` vs `setInstitutionText`**: mutuamente exclusivos, `setInstitutionId` prioritário (espelha a regra da `Transaction`, Spec 01 §3.9; `.refine` no Zod).
- **Consistência categoria/subcategoria (DD-18 da 61)**: form escopa subcategoria à categoria escolhida (reset ao trocar) + `.refine` backstop; **ao aplicar**, trocar `setCategoryId` limpa a subcategoria vigente que deixa de ser filha.

### 2.2 Motor de avaliação (puro, triplo uso)

Função pura `evaluateRules(input, rules)` em `src/lib/rules/evaluate.ts` — **sem imports de server** (client + server importam), espelhando `src/lib/aliases/match.ts`.

- **Entrada** (`RuleEvalInput`): `{ description, amountCents, institutionId }` — todos disponíveis no estado local da linha manual **e** no `parsed` do import.
- **Avaliação**: percorre regras `isActive` em ordem crescente de `priority`; uma regra casa se **todas** as condições preenchidas casam (AND). `contains`/`regex` sobre a descrição; faixa compara `amountCents` (`BigInt`) com `minCents`/`maxCents` (**nunca `Float`**); instituição compara `institutionId`.
- **`stopOnMatch`**: `true` numa regra que casa → para; `false` → continua acumulando.
- **Acúmulo (DD-05)**: quando várias regras casam (`stopOnMatch=false`), o patch é montado **first-set-wins** — a regra de menor `priority` que define um campo vence; regras seguintes só preenchem campos ainda não definidos.
- **Saída**: `{ appliedRuleIds: string[], patch: RulePatch }` — o patch mesclado + a proveniência (quais regras contribuíram, para tooltip/`metadata`). Determinístico dada a mesma lista (mesmo contrato de dual-run da 61, DD-13).
- **regex**: validada **no salvamento da regra** (Zod), rejeitando padrão inválido; o motor assume padrão válido em runtime.

### 2.3 Precedência apelido ↔ regra (RULE-04)

Pilha de aplicação, tanto no import quanto no manual:

```
valor mapeado do CSV / valor digitado no manual
        │
        ▼  patch da REGRA sobrescreve (exceto amountCents — nunca; DD-06)
      regra
        │
        ▼  patch do APELIDO sobrescreve por cima (DD-11 da 61 — intencional vence)
      apelido
        │
        ▼  transação final
```

Helper puro `computeSuggestion(alias, ruleResult, current, sources)` (manual) e a ordem de merge no service (import) garantem que o apelido é a **última** camada. Nenhuma camada aplica `amountCents` no import (DD-06, generaliza DD-09 da 61); regra nunca tem `amountCents` como ação (é só condição — DD-06).

### 2.4 CRUD em Settings

Rota `src/app/(app)/[accountId]/settings/rules/` (page RSC + manager client) **espelhando `settings/aliases/`**. Link novo em `editorLinks` de `settings/layout.tsx:24-38` (feature de **editor**, não owner).

- **Ordenação por prioridade** via **setas ⬆⬇** (DD-02) — mesmo padrão de `SectionsManager.tsx` / `ChecklistManager.tsx` (`ArrowUpwardIcon`/`ArrowDownwardIcon`, `move(i, ±1)` otimista em `startTransition`). Persistência via action `reorderCategorizationRules({ orderedIds })` que reescreve `priority = índice`. **Sem drag-and-drop.**
- `CategorizationRuleFormDialog` (base `DialogShell`) com **3 blocos `FieldGroup`**: **Regra** (`name`, `priority`, `stopOnMatch`, `isActive`, `applyToManual`), **Condições** (match-mode `Select` + valor, instituição `CreatableEntitySelect`, min/max via `NumericFormat`+`Controller` BRL→cents), **Ações** (reusa o layout de classificação/tags do `TransactionAliasFormDialog` — só os `name` mudam para `set*`).
- Deps por props (nunca `useOptions`): `categories`, `institutions`, `parties`, `tags`, callbacks `onCreate*` + `canCreateOptions`. `EmptyState`, `PageSettingsContainer`, `StatusBadge` (arquivada/ativa). Feedback via `useSnackbar`.

### 2.5 Aplicação no lançamento manual (RULE-02, RULE-04) — via popover de confirmação

**Decisão DD-03**: no manual a regra **não** aplica silenciosamente no server. Ela roda **client, pré-save**, e é apresentada no **mesmo popover de sugestão do apelido**, com confirmação explícita. Isso mantém a filosofia do app ("nada muda sozinho", 61 §2.4) e **elimina** o risco de sobrescrita silenciosa que existiria se a regra rodasse server-pós-save (o create hoje só devolve `transactionId` e a linha otimista é montada do estado local — `NewTransactionRow.tsx:276-307`).

Reaproveitamento (renomeação para generalizar apelido+regra):

| Peça atual (apelido) | Passa a | Mudança |
|---|---|---|
| `useAliasMatch` (`src/components/transactions/aliases/useAliasMatch.ts`) | `useSuggestions` | Debounce da descrição **+ observa `amountCents` e `institutionId`**; roda `matchAlias` **e** `evaluateRules` |
| `AliasSuggestionPopover.tsx` | `SuggestionPopover` | Diff com **coluna de origem** (Apelido / Regra) por campo |
| `computeAliasApplication` (`src/lib/aliases/apply.ts:124-261`) | `computeSuggestion` | Camada regra → camada apelido por cima (§2.3) |

- Só para **não-viewers**. `applyToManual = false` na regra → ela **não** entra no popover (opt-in). `applyToManual` deixa de significar "aplica silencioso" e passa a significar **"esta regra aparece como sugestão no manual"** (DD-03).
- Aplicar grava no **estado local** (nada persiste até Salvar); snackbar "Desfazer" restaura o snapshot — igual ao apelido (`NewTransactionRow.tsx:178-231`). No modo visualização (`TransactionRow.tsx`), aplicar persiste imediatamente via `updateTransactionAction` + undo, como o apelido já faz (61 DD-23).
- `amountCents` **não** é ação de regra; no manual o valor exibido continua o digitado (DD-06).

### 2.6 Integração com import (RULE-01, RULE-04)

Reusa a arquitetura dual-run dos apelidos. A regra entra nas **duas** camadas que já existem:

- **Camada de decisão (parser puro, dual-run)** — `src/lib/csv-parser.ts:242-369`. `applyMappingToRows` ganha um novo parâmetro opcional `rules` (default `[]`, retrocompatível, ao lado de `aliases`) e escreve **apenas** `parsed.appliedRuleIds: string[]` por linha (via `evaluateRules`), somente quando `parsed` existe — análogo a `parsed.appliedAliasId` (`csv-parser.ts:363`). Novo campo no tipo `PreviewRow.parsed` (`csv-parser.ts:68-85`).
- **Camada de aplicação server (autoritativa)** — `src/server/services/csv-import-service.ts`. Recarrega as regras frescas por `accountId` (como faz com apelidos em `:134-140`, DD-13). No loop de montagem do `TxData`, aplica o patch da regra **antes** do bloco de apelido (`:293-358`), respeitando `ruleIgnoreRows` (novo `Set<number>`, mesmo contrato de `aliasIgnoreRows` — `:140`, `:318`), a limpeza de subcategoria órfã (DD-18 da 61) e **nunca** tocando `amountCents` (DD-06). Proveniência em `metadata` (`{ appliedRuleIds }`, ao lado de `appliedAliasId` — `:513-515`). Tags da regra resolvidas e persistidas no mesmo `$transaction` que as do apelido (`:521-526`). Log Pino ao fim (`rulesApplied`).
- **Preview (client display)** — `src/components/csv-import/StepPreview.tsx:173-188`. Projeção display-only (não muta `previewRows`): as colunas visíveis (Categoria/Descrição) mostram o valor final combinado (regra sob apelido); a coluna **Valor mantém o do extrato**.
  - **Sinalização (DD-04)**: **um único ícone** `AutoFixHighOutlinedIcon` (accent) por linha tocada por apelido **e/ou** regra — **sem coluna nova** (DD-08 da 61). O **tooltip atribui cada mudança à sua fonte** ("Regra 'iFood' → categoria Alimentação"; "Apelido 'CEG' → descrição Sistema de Gás"; nota "apelido vence onde ambos tocam"). Os toggles são **separados**: o toggle de apelido existente (`aliasIgnoreRows`) e um novo toggle de regra (`ruleIgnoreRows`), ambos no tooltip/linha.
- **Schema do action** — `src/lib/schemas/csv-import.ts`: novo `ruleIgnoreRows: number[]` (`.default([])`) no input de `executeImport`, análogo a `aliasIgnoreRows`.

---

## 3. User Stories

- Como usuário, quero criar uma regra "se a descrição casa `UBER|99APP|CABIFY` (regex) então categoria = Transporte", para cobrir várias variações num único filtro.
- Como usuário, quero uma regra por **faixa de valor** e **instituição** ("Nubank cartão acima de R$ 2.000 → tag revisar"), para reagir ao quanto e à origem, não só ao texto.
- Como usuário, quero ordenar minhas regras por prioridade com setas, para controlar qual vence quando mais de uma casa.
- Como usuário importando um extrato, quero que linhas casadas por regra recebam os campos ao confirmar (com preview e toggle por linha), para não re-categorizar em massa.
- Como usuário lançando manualmente, quero que uma regra opt-in apareça como **sugestão confirmável** (não uma mudança silenciosa), para revisar antes de aplicar.
- Como usuário, quando um apelido e uma regra tocam o mesmo campo, quero que o **apelido vença**, para que minha decisão nomeada não seja sobrescrita por um filtro genérico.
- Como membro **viewer**, não devo poder criar/editar/aplicar regras que mutem dados.

---

## 4. Critérios de Aceitação

**RULE-03 — CRUD e escopo**
- QUANDO um owner/editor cadastra uma regra (nome, condições, ações, prioridade) em Settings → Regras, ENTÃO ela aparece na lista, é editável, arquivável e reordenável por setas ⬆⬇.
- QUANDO o usuário reordena regras, A ACTION `reorderCategorizationRules({ orderedIds })` DEVE reescrever `priority` = índice e a lista DEVE refletir a nova ordem otimisticamente.
- SE `descriptionMode = regex`, O SALVAMENTO DEVE validar a regex (Zod) e rejeitar padrão inválido com erro de campo claro; SE `contains`, qualquer string não-vazia é aceita.
- QUANDO o usuário define `setInstitutionId` **e** `setInstitutionText` na mesma regra, ENTÃO a validação DEVE rejeitar (mutuamente exclusivos).
- QUANDO o usuário escolhe `setSubcategoryId`, O SELETOR DEVE estar escopado a `setCategoryId` (desabilitado sem categoria; reset ao trocar) e o service DEVE rejeitar (`.refine`) subcategoria cuja categoria-pai difira de `setCategoryId`.
- QUANDO um viewer acessa Settings → Regras, A UI NÃO DEVE oferecer criar/editar/arquivar/reordenar.

**RULE-03 — Motor (`evaluateRules`, puro)**
- QUANDO múltiplas condições estão preenchidas numa regra, TODAS DEVEM casar (AND) para a regra ser aplicada.
- QUANDO a condição é faixa de valor, O MOTOR DEVE comparar `amountCents` (`BigInt`) com `minCents`/`maxCents`; NÃO DEVE converter para `Float`.
- O MOTOR DEVE avaliar apenas regras `isActive` em ordem crescente de `priority`.
- SE `stopOnMatch = true` numa regra que casa, O MOTOR NÃO DEVE avaliar regras de prioridade inferior para aquela transação; SE `false`, DEVE continuar, mesclando ações **first-set-wins** (a regra de menor `priority` que define um campo vence).
- DADA a mesma lista de regras e a mesma entrada, `evaluateRules` DEVE produzir `appliedRuleIds` e `patch` idênticos no client e no server.

**RULE-04 — Precedência**
- QUANDO um apelido e uma regra definem o **mesmo** campo na mesma transação (import ou manual), ENTÃO o valor do **apelido** DEVE prevalecer.
- O `amountCents` NÃO DEVE ser aplicado por regra em nenhum contexto (regra não tem `amountCents` como ação); no import o valor do extrato sempre prevalece.

**RULE-02 — Aplicação manual (popover)**
- QUANDO digito/edito uma linha cuja descrição/valor/instituição casa uma regra com `applyToManual = true`, ENTÃO o ícone de sugestão DEVE acender e o popover DEVE listar as mudanças com a **fonte** (Regra/Apelido) por campo.
- QUANDO clico "Aplicar", OS CAMPOS definidos DEVEM ser sobrescritos no estado local (apelido sobre regra) e um snackbar DEVE oferecer "Desfazer"; nada DEVE persistir até Salvar a linha (no modo visualização, aplicar persiste imediatamente com undo).
- QUANDO `applyToManual = false`, A REGRA NÃO DEVE entrar no popover manual.
- QUANDO um viewer abre uma linha que casa uma regra, O ícone/popover de sugestão NÃO DEVE aparecer.

**RULE-01 — Import**
- QUANDO importo um CSV cujas linhas casam uma regra, ENTÃO cada transação criada DEVE receber os campos definidos pela regra (incl. tags, expenseType, categoria), respeitando a precedência do apelido (§2.3), e a proveniência DEVE ser gravada em `metadata` (`appliedRuleIds`). O `amountCents` NÃO DEVE ser alterado.
- QUANDO reviso o preview, AS colunas visíveis DEVEM mostrar o valor combinado (WYSIWYG); a coluna Valor DEVE manter o valor do extrato; um **único ícone** com tooltip DEVE atribuir cada mudança à sua fonte — **sem colunas novas**.
- QUANDO clico o toggle de regra de uma linha, A REGRA DEVE alternar aplicar/não-aplicar naquela linha (a linha continua sendo importada), e o server DEVE honrar via `ruleIgnoreRows`.
- DADA a mesma lista de regras, `evaluateRules` DEVE casar cada linha de forma idêntica no client (preview) e no server (persistência); SE a lista mudar entre abrir o preview e confirmar, o resultado **persistido** DEVE ser o do servidor (autoritativo).

**Multi-tenancy**
- QUANDO o motor avalia regras ou qualquer query lê `CategorizationRule`, ela DEVE filtrar por `accountId`. Regras de uma account NÃO DEVEM ser aplicadas a transações de outra.
- QUANDO uma regra referencia `setCategoryId`, `setSubcategoryId`, `setInstitutionId`, `conditionInstitutionId`, `setResponsiblePartyId` **ou** qualquer `tagId` de outra Account (id forjado), ENTÃO a criação/edição DEVE ser rejeitada — cada FK valida ownership contra `accountId`.
- QUANDO um usuário da Account A tenta ler/editar/arquivar/reordenar uma regra da Account B, O service DEVE lançar `NotFoundError`/`ForbiddenError`.

**UI**
- A UI (form, lista, ícone/tooltip do preview, popover manual) DEVE ser validada em **light E dark mode** antes de fechar (`skills/dark-mode`).

---

## 5. Fora de Escopo

- **Auto-categorização por ML** — apenas regras determinísticas if-then.
- **Aplicação retroativa em massa** ao histórico já existente — escopo cobre import e novos lançamentos; reprocessar o passado fica para spec futura.
- **Condições compostas com OR** dentro de uma regra — apenas AND entre condições preenchidas; OR se obtém com múltiplas regras (DD-01).
- **Condições como lista repetível arbitrária** (`useFieldArray` de `{campo, operador, valor}`) — slots fixos (descrição, instituição, faixa) são suficientes e mais simples (DD-01).
- **`amountCents` como ação** — valor é entrada de condição, nunca saída; no import o valor do extrato é autoritativo (DD-06).
- **Moeda estrangeira (FX) como ação** — o trio `originalCurrency`/`originalAmountCents`/`exchangeRate` não é ação de regra (diferente do apelido, DD-22 da 61).
- **Aplicação silenciosa no manual** — substituída por confirmação via popover (DD-03). `applyToManual` controla se a regra **aparece como sugestão**, não se aplica sozinha.
- **Drag-and-drop na ordenação** — só setas ⬆⬇ (DD-02).
- **Sugestão automática de regras** a partir de padrões detectados — regras são criadas manualmente.
- **Ações além das listadas** (mover de tabela, criar vínculo, etc.) — restrito aos campos-alvo de §2.1.
- **Histórico/auditoria de sobrescritas** — aplicação destrutiva sem histórico; `metadata.appliedRuleIds` é a única trilha (como no apelido, DD-05 da 61).
- **Condição por instituição no import** — o parser puro tem só o *nome* da instituição do extrato (o id é resolvido depois, no server), então `institutionId` é `null` nos dois lados do dual-run e uma condição `conditionInstitutionId` **não casa no import** (casa normalmente no manual, onde o id está no estado local). Resolver id no parser quebraria a pureza/paridade; fica como follow-up. Condições de descrição e faixa de valor funcionam no import.
- **Cobertura no backup de Account (spec 64)** — `account-backup-service.ts` ainda **não** exporta/importa `CategorizationRule`/`CategorizationRuleTag` (um backup feito agora não recria as regras). Extensão do contrato de backup (row schemas em `account-backup.ts`, coleta/export, restore com remap dos 6 FKs — incl. os 2 de instituição — e `metadata.appliedRuleIds`) fica como **follow-up** na spec 64; é mudança grande e sem round-trip test de rede de segurança.
- **Mitigação robusta de ReDoS** — a guarda no salvamento (DD-14) é heurística; motor RE2 / avaliação com timeout em worker fica como follow-up.

---

## 6. Decisões de Design

| # | Decisão | Escolha | Motivo |
|---|---|---|---|
| DD-01 | Forma das condições | **Slots fixos** (descrição+modo, instituição, faixa de valor), AND entre as preenchidas | Só 3 tipos de condição e AND-only (OR fora de escopo); slots fixos = form simples (sem `useFieldArray`), próximo do form do apelido. |
| DD-02 | Ordenação por prioridade | **Setas ⬆⬇** + action `{ orderedIds }` otimista | Padrão já usado em `SectionsManager`/`ChecklistManager`; zero dep nova (`@dnd-kit/sortable` está instalado mas sem uso e exigiria guard de hidratação SSR). |
| DD-03 | Aplicação no manual | **Popover de confirmação** (mesmo do apelido), roda **client pré-save**; NÃO silencioso no server | Mantém "nada muda sozinho" (61 §2.4); elimina o clobber silencioso (create devolve só `transactionId`, linha otimista é local). `applyToManual` = "aparece como sugestão", opt-in. **Revê a AC original da spec 50** que pedia aplicação server silenciosa. |
| DD-04 | Sinalização no preview de import | **Um ícone**, tooltip **atribui a fonte** por campo, **toggles separados** (apelido / regra) | Sem coluna nova (DD-08 da 61); menos poluição visual que 2 ícones espremidos; reusa a infra de toggle por linha. |
| DD-05 | Acúmulo com `stopOnMatch=false` | **first-set-wins** por campo (menor `priority` vence) | Determinístico; "acumular" = preencher campos ainda não definidos. |
| DD-06 | `amountCents` | **Nunca** ação de regra (só condição); import nunca aplica valor | Valor do extrato é autoritativo; generaliza DD-09 da 61. |
| DD-07 | Motor | Função **pura** `src/lib/rules/evaluate.ts` (sem deps de server), triplo uso (manual client, preview client, import server) | Espelha `matchAlias` (61 DD-06); garante paridade do dual-run (61 DD-13). |
| DD-08 | Tags na ação | **Tabela-ponte `CategorizationRuleTag`** (não `Json`) | FK real → valida ownership multi-tenant da tag; espelha `TransactionAliasTag`. **Corrige** `addTagIds Json` do rascunho original. |
| DD-09 | Responsável na ação | **`ResponsibleParty`** (`setResponsiblePartyId`), não `User` | O domínio usa `ResponsibleParty` (spec 61, `apply.ts`). **Corrige** `setResponsibleUserId` do rascunho original. |
| DD-10 | Precedência apelido↔regra | **Apelido vence** (última camada) no import e no manual | Honra DD-11 da 61 (intencional > automático); resolve RULE-04 num ponto único (`computeSuggestion` + ordem de merge no service). |
| DD-11 | Carregamento das regras | Carga única por Account (query `React.cache()` + `where accountId`), **via prop** para a árvore do `TransactionTable` (manual) e para o `ImportWizard` (import); server recarrega fresco por import | Espelha DD-10 da 61 (`OptionsContext` é callbacks-only; não estender). `@@index([accountId, isActive, priority])`. |
| DD-12 | Escopo das ações manual vs import | Manual (popover) = subset sem tags/investmentType/cardInstallment/isFavorite; import = conjunto completo | Espelha a divisão de `AliasApplicableFields` (`apply.ts:26-38`); mantém `computeSuggestion` trivial ao mesclar com o apelido. |
| DD-13 | Serializer | `SerializedCategorizationRule` (superset com **nomes denormalizados** categoryName/…) para o preview do import sem listas de opções | Espelha `serializeTransactionAlias` (61, P1); `BigInt`→string, datas→ISO UTC (mesmo serializer que o desempate exige). |
| DD-14 | Guarda anti-ReDoS na condição `regex` | **Heurística conservadora no salvamento** (`src/lib/rules/safe-regex.ts` `isLikelyCatastrophicRegex`: rejeita quantificador aninhado/"star height > 1", repetição bounded gigante, padrão > 1000 chars) + **teto de input** no motor (`evaluate.ts`, descrição > 1024 chars não é testada). Motor RE2/worker-timeout como follow-up robusto. | A regex é capacidade nova (o apelido só faz substring). Sem timeout no motor de regex do JS, um padrão catastrófico (`(a+)+$`) do usuário travaria o event loop do Node por linha no import e por tecla no manual, afetando **todas** as accounts do processo. Heurística é interina (não cobre 100%, ex.: alternância sobreposta) mas barra a classe dominante sem nova dependência. |

---

## 7. Referências Técnicas

| Item | Arquivo(s) a tocar |
|---|---|
| Modelo + join + enum + migração | `prisma/schema.prisma` (novos `CategorizationRule`, `CategorizationRuleTag`, enum `CategorizationMatchMode`; back-relations em `Account`, `User`, `Category`, `Subcategory`, `Institution` ×2, `ResponsibleParty`, `Tag`); migração `add_categorization_rules`. Atualizar `specs/01-domain-model.md` **antes** (CLAUDE.md §7) |
| Schema Zod (fonte única, valida regex + institution xor + subcat) | `src/lib/schemas/categorization-rule.ts` (novo) |
| Motor puro | `src/lib/rules/evaluate.ts` (novo) — `evaluateRules`, tipos `RuleEvalInput`/`RulePatch`/`RuleCandidate` |
| Precedência (merge regra→apelido) | `src/lib/rules/compute-suggestion.ts` (novo) ou estender `src/lib/aliases/apply.ts` → `computeSuggestion` |
| Serializer RSC→client | `src/lib/serializers/categorization-rule.ts` (novo, espelha `transaction-alias.ts`) |
| Query de leitura | `src/server/queries/categorization-rules.ts` (novo, `React.cache()`, `where: { accountId, archivedAt: null }`) |
| Serviço | `src/server/services/categorization-rule-service.ts` (novo, espelha `transaction-alias-service.ts`; valida FKs por account; reorder) |
| Actions | `src/actions/categorization-rules.ts` (novo, `defineAction`, `requireRoles: ["owner","editor"]`; create/update/archive/delete/reorder) |
| Revalidate | `src/server/api/revalidate.ts` (`revalidateCategorizationRules`) |
| Settings (page + manager + row) | `src/app/(app)/[accountId]/settings/rules/{page.tsx,RulesManager.tsx}` (novos) |
| Nav settings | `src/app/(app)/[accountId]/settings/layout.tsx` (`editorLinks`, `:24-38`) |
| Form reutilizável | `src/components/transactions/rules/CategorizationRuleFormDialog.tsx` (novo; deps por props; 3 `FieldGroup`) |
| Popover manual (renomear/generalizar) | `useAliasMatch`→`useSuggestions`; `AliasSuggestionPopover`→`SuggestionPopover`; `NewTransactionRow.tsx`, `TransactionRowEditor.tsx`, `TransactionRow.tsx` |
| Import — parser | `src/lib/csv-parser.ts` (`PreviewRow.parsed.appliedRuleIds`, param `rules = []` em `applyMappingToRows`; só marca quando `parsed` existe) |
| Import — service | `src/server/services/csv-import-service.ts` (carregar regras frescas; aplicar patch **antes** do apelido `:293-358`; honrar `ruleIgnoreRows`; limpar subcat órfã; `metadata.appliedRuleIds`; log Pino) |
| Import — schema do action | `src/lib/schemas/csv-import.ts` (`ruleIgnoreRows: number[]` `.default([])`) |
| Import — preview + prop | `src/components/csv-import/StepPreview.tsx` (ícone único + tooltip com fonte + toggle de regra), `ImportWizard.tsx` (receber `rules` por prop; estado `ruleIgnoredRows`; enviar `ruleIgnoreRows`), `SectionView.tsx` (repassar `rules`) |
| Labels | `src/lib/messages/pt-BR.ts` (novo namespace `rules` + `settings.nav.rules`) |
| Domínio | `specs/01-domain-model.md` (nova entidade + diagrama); notas em `specs/09-transactions.md` e `specs/10-csv-xlsx-import.md` |

### Modelo Prisma (referência)

```prisma
enum CategorizationMatchMode {
  contains
  regex

  @@map("categorization_match_mode")
}

model CategorizationRule {
  id            String  @id @default(cuid())
  accountId     String  @map("account_id")
  name          String?
  priority      Int     @default(0)                     // menor = avaliada primeiro
  isActive      Boolean @default(true) @map("is_active")
  applyToManual Boolean @default(false) @map("apply_to_manual") // opt-in: aparece como sugestão no manual
  stopOnMatch   Boolean @default(true) @map("stop_on_match")

  // Condições (AND entre as preenchidas)
  descriptionMode        CategorizationMatchMode? @map("description_mode")
  descriptionValue       String?                  @map("description_value")
  conditionInstitutionId String?                  @map("condition_institution_id")
  minCents               BigInt?                  @map("min_cents")
  maxCents               BigInt?                  @map("max_cents")

  // Ações (patch parcial; null = "não define")
  setDescription        String?                   @map("set_description")
  setNotes              String?                   @map("set_notes")
  setCategoryId         String?                   @map("set_category_id")
  setSubcategoryId      String?                   @map("set_subcategory_id")
  setInstitutionId      String?                   @map("set_institution_id")
  setInstitutionText    String?                   @map("set_institution_text")
  setResponsiblePartyId String?                   @map("set_responsible_party_id")
  setExpenseType        TransactionExpenseType?   @map("set_expense_type")
  setPaymentMethod      TransactionPaymentMethod? @map("set_payment_method")
  setInvestmentType     String?                   @map("set_investment_type")   // só import
  setCardInstallment    String?                   @map("set_card_installment")  // só import
  setIsPending          Boolean?                  @map("set_is_pending")
  setIsFavorite         Boolean?                  @map("set_is_favorite")        // só import

  archivedAt  DateTime? @map("archived_at")
  createdById String    @map("created_by_id")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  account              Account            @relation(fields: [accountId], references: [id], onDelete: Cascade)
  createdBy            User               @relation("CategorizationRuleCreatedBy", fields: [createdById], references: [id], onDelete: Restrict)
  conditionInstitution Institution?       @relation("CategorizationRuleConditionInstitution", fields: [conditionInstitutionId], references: [id], onDelete: SetNull)
  setCategory          Category?          @relation("CategorizationRuleSetCategory", fields: [setCategoryId], references: [id], onDelete: SetNull)
  setSubcategory       Subcategory?       @relation("CategorizationRuleSetSubcategory", fields: [setSubcategoryId], references: [id], onDelete: SetNull)
  setInstitution       Institution?       @relation("CategorizationRuleSetInstitution", fields: [setInstitutionId], references: [id], onDelete: SetNull)
  setResponsibleParty  ResponsibleParty?  @relation("CategorizationRuleSetResponsibleParty", fields: [setResponsiblePartyId], references: [id], onDelete: SetNull)
  tags                 CategorizationRuleTag[]

  @@index([accountId])
  @@index([accountId, isActive, priority])
  @@map("categorization_rules")
}

model CategorizationRuleTag {
  ruleId String @map("rule_id")
  tagId  String @map("tag_id")
  rule   CategorizationRule @relation(fields: [ruleId], references: [id], onDelete: Cascade)
  tag    Tag                @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([ruleId, tagId])
  @@index([tagId])
  @@map("categorization_rule_tags")
}
```

`Account` ganha `categorizationRules CategorizationRule[]`; `User`, `Category`, `Subcategory`, `Institution` (2 back-relations, nomeadas), `ResponsibleParty` e `Tag` (via join) ganham as relações correspondentes.

### Motor puro (referência) — `src/lib/rules/evaluate.ts`

```ts
// SEM imports de server (client + server importam) — espelha src/lib/aliases/match.ts
export interface RuleEvalInput {
  description: string | null | undefined;
  amountCents: bigint | null | undefined;
  institutionId: string | null | undefined;
}

// Subset serializado necessário p/ avaliar + aplicar. O tipo completo
// (SerializedCategorizationRule) é um superset com nomes denormalizados p/ o preview.
export interface RuleCandidate {
  id: string;
  priority: number;
  stopOnMatch: boolean;
  descriptionMode: "contains" | "regex" | null;
  descriptionValue: string | null;
  conditionInstitutionId: string | null;
  minCents: bigint | null;
  maxCents: bigint | null;
  patch: RulePatch; // as ações set* já projetadas em forma de patch parcial
}

export interface RuleEvalResult {
  appliedRuleIds: string[];
  patch: RulePatch; // mesclado (first-set-wins), amountCents nunca presente
}

// ✅ ordem por priority asc; AND das condições; stopOnMatch; acúmulo first-set-wins
export function evaluateRules(
  input: RuleEvalInput,
  rules: readonly RuleCandidate[], // assumir já filtradas isActive + ordenadas por priority asc
): RuleEvalResult {
  const merged: RulePatch = {};
  const appliedRuleIds: string[] = [];
  const haystack = input.description?.toLowerCase() ?? "";

  for (const r of rules) {
    if (!matches(r, input, haystack)) continue;
    appliedRuleIds.push(r.id);
    for (const [k, v] of Object.entries(r.patch)) {
      if (v !== null && v !== undefined && merged[k] === undefined) {
        merged[k] = v; // first-set-wins (DD-05)
      }
    }
    if (r.stopOnMatch) break;
  }
  return { appliedRuleIds, patch: merged };
}

function matches(r: RuleCandidate, input: RuleEvalInput, haystack: string): boolean {
  // AND: cada condição PREENCHIDA precisa casar
  if (r.descriptionMode && r.descriptionValue) {
    if (r.descriptionMode === "contains") {
      if (!haystack.includes(r.descriptionValue.toLowerCase())) return false;
    } else {
      // regex validada no salvamento; runtime assume válida
      if (!new RegExp(r.descriptionValue).test(input.description ?? "")) return false;
    }
  }
  if (r.conditionInstitutionId && input.institutionId !== r.conditionInstitutionId) return false;
  // faixa em BigInt — NUNCA Float (money-handling)
  if (r.minCents !== null && (input.amountCents ?? null) !== null && input.amountCents! < r.minCents) return false;
  if (r.maxCents !== null && (input.amountCents ?? null) !== null && input.amountCents! > r.maxCents) return false;
  return true;
}
```

### Precedência no import (referência) — ordem de merge no service

```ts
// src/server/services/csv-import-service.ts — dentro do loop de montagem do TxData
// 1) valores resolvidos do CSV (categoria/instituição/subcat) já em txData
// 2) REGRA primeiro (só se a linha não fez opt-out); NUNCA amountCents (DD-06)
if (ruleResult.appliedRuleIds.length && !ruleIgnoreRows.has(row.rowIndex)) {
  mergeRulePatch(txData, ruleResult.patch); // sobrescreve o CSV; limpa subcat órfã (DD-18 da 61)
  appliedRuleIds = ruleResult.appliedRuleIds;
}
// 3) APELIDO por cima — apelido vence onde ambos tocam (DD-10 / DD-11 da 61)
if (alias && !aliasIgnoreRows.has(row.rowIndex)) {
  mergeAliasPatch(txData, alias); // bloco existente :318-357
}
```

---

## 8. Plano de Implementação (executado)

> Executado em 2026-07-21 nesta branch, orquestrado por subagentes em fases com gates. **Todos os gates passaram**: typecheck 0 erros, suíte completa **1065+ testes verdes**, `pnpm build` exit 0 (rota RSC `settings/rules` gerada), 3 invariantes confirmadas por verificação adversarial (precedência apelido>regra, paridade dual-run, `amountCents` nunca aplicado + faixa em BigInt).

### 8.1 Princípios de execução

- **Spec-anchored**: `specs/50-*.md` é a verdade. **TDD** onde há lógica (engine, service, schema). Testes ao lado do fonte; mock Prisma em `tests/mocks/prisma`; contexto em `tests/fixtures/account`. **Multi-tenancy** obrigatório em toda mutation (FK valida ownership por `accountId`). Convenções CLAUDE.md §5/§7 (BigInt centavos, `defineAction`, MUI-only + tokens, Pino, labels em `pt-BR.ts`). **Gates** `typecheck && lint && test` entre fases.

### 8.2 DAG de dependências

```
FASE 0 — Fundação (gate; libera tudo)
  0.1 doc domínio     0.2 Prisma+migration     0.3 messages (TODAS labels upfront)
                            │
              ┌─────────────┼───────────────┬──────────────┐
          0.4 Zod       0.5 serializer   0.6 engine       0.7 query
          schema        +tipo            (TDD)            (RULE_INCLUDE)
                            ▼  (gate: typecheck + engine/schema verdes)
FASE 1 — Server slice
  1.1 service (CRUD+reorder+ownership, TDD) ──► 1.2 actions + revalidate  (gate)
                            ▼
FASE 2 — 3 TRACKS PARALELOS (arquivos 100% disjuntos — sem conflito)
  ┌────────────────────┬─────────────────────┬────────────────────────┐
  │ TRACK A — Settings │ TRACK B — Import     │ TRACK C — Manual        │
  │ A1 page+manager    │ B1 parser param      │ C1 rename (8 arq, gate) │
  │ A2 form dialog     │ B2 server apply      │ C2 engine no popover    │
  │ A3 nav link        │ B3 schema ruleIgnore │ C3 rows consomem rules  │
  │ A4 RuleRow         │ B4 StepPreview       │ C4 FinanceTableCard+    │
  │                    │ B5 ImportWizard      │    TransactionTable fwd │
  └────────────────────┴─────────────────────┴────────────────────────┘
      (adapter compartilhado `serializedRuleToCandidate` roda ANTES dos tracks)
                            ▼  (todos aceitam prop `rules = []` → compilam sozinhos)
FASE 3 — Fiação (dono único; resolve contenção)  + fix `importRuleCandidates` (isActive)
  3.1 SectionTab (carrega getActiveCategorizationRules) → 3.2 SectionView (thread `rules`)
                            ▼
FASE 4 — Verificação: review + adversarial + build
FASE 5 — Hardening: guarda anti-ReDoS (DD-14)   [follow-up: backup spec 64]
```

### 8.3 Resolução de contenção (por que os tracks não colidiram)

Só **3 arquivos** eram tocados por >1 track — neutralizados:

| Arquivo | Risco | Neutralização |
|---|---|---|
| `src/lib/messages/pt-BR.ts` | A/B/C adicionam labels | Fase 0.3 adicionou **todas** as labels upfront; tracks só leem `m.rules.*`. |
| `src/components/months/SectionView.tsx` | B (`ImportWizard`) + C (`FinanceTableCard`) no mesmo corpo | Fase 3 (dono único). Tracks entregaram componentes que **aceitam** `rules = []`. |
| `src/components/months/SectionTab.tsx` | origem do prop | Fase 3. |

Adapter `serializedRuleToCandidate`/`manualRuleCandidates`/`importRuleCandidates` (`src/lib/rules/candidate.ts`) criado **antes** dos tracks (B e C dependiam). Rename do Track C: só símbolos, `apply.ts` manteve o nome do arquivo → zero overlap com Track B.

### 8.4 Fases e tarefas (com arquivos reais entregues)

**Fase 0 — Fundação** · `specs/01-domain-model.md` (§3.22/§3.23 + erDiagram + changelog) · `prisma/schema.prisma` + migração `20260721163728_add_categorization_rules` · `pt-BR.ts` (`settings.nav.rules` + namespace `rules`) · `src/lib/schemas/categorization-rule.ts` (+test) · `src/lib/serializers/categorization-rule.ts` · `src/lib/rules/evaluate.ts` (+test) · `src/server/queries/categorization-rules.ts` (`RULE_INCLUDE`, `getActiveCategorizationRules`).

**Fase 1 — Server** · `src/server/services/categorization-rule-service.ts` (+test: CRUD, reorder, IDOR por FK, subcat-parent, xor) · `src/actions/categorization-rules.ts` (5 actions) · `src/server/api/revalidate.ts` (`revalidateCategorizationRules`). Ajuste em `src/server/api/define-action.ts` (`z.ZodType<TInput, ZodTypeDef, unknown>`) p/ inferência de schema com `.default()` — verificado sem regressão.

**Fase 2 — Tracks** · Adapter `src/lib/rules/candidate.ts`. **A**: `settings/rules/{page,RulesManager}.tsx`, `components/transactions/rules/CategorizationRuleFormDialog.tsx`, `settings/layout.tsx`. **B**: `csv-parser.ts`, `csv-import-service.ts`, `schemas/csv-import.ts` (`ruleIgnoreRows`), `StepPreview.tsx`, `ImportWizard.tsx`, `import-preview.ts` (`describeCombinedImportApplication`). **C**: rename `useAliasMatch→useSuggestions`/`AliasSuggestionPopover→SuggestionPopover`/`computeAliasApplication→computeSuggestion`; `NewTransactionRow`/`TransactionRow`/`TransactionRowEditor`/`TransactionTable`/`FinanceTableCard`.

**Fase 3 — Fiação** · `SectionTab.tsx` (carrega regras) + `SectionView.tsx` (thread `rules` p/ FinanceTableCard + ImportWizard). Fix `importRuleCandidates` (filtra `isActive` no import — paridade com o manual).

**Fase 4 — Verificação** · review de convenções (myaccountant-reviewer), verificação adversarial das invariantes, `pnpm build`.

**Fase 5 — Hardening** · Guarda anti-ReDoS (`src/lib/rules/safe-regex.ts` + guarda no schema + teto de input no motor + testes) — DD-14.

### 8.5 Guia de paralelização

Sequencial nos gates: **Fase 0 → 1 → 2 (3 tracks paralelos) → 3 → 4/5**. Dentro da Fase 0: 0.2 primeiro (gera tipos), depois {0.4,0.5,0.6,0.7} paralelo; {0.1,0.3} livres. Fase 2 = 3 subagentes concorrentes na mesma working tree (sem worktree, arquivos disjuntos). Fase 3 **não** paraleliza (edita os 2 arquivos compartilhados). Caminho crítico: `0 → 1 → maior track → 3`.

### 8.6 Progresso (executado)

- [x] **Fase 0** — doc · prisma+migração · messages · schema · serializer · engine · query · *gate ✓*
- [x] **Fase 1** — service (33 testes) · actions+revalidate · *gate ✓*
- [x] **Fase 2** — adapter · Track A · Track B · Track C · *gate ✓ (128 testes)*
- [x] **Fase 3** — SectionTab · SectionView · fix isActive · *gate ✓ (1065 testes)*
- [x] **Fase 4** — review · adversarial (3/3 invariantes) · build ✓
- [x] **Fase 5** — guarda anti-ReDoS (DD-14) ✓

### 8.7 Resultado e follow-ups

**Entregue e verde**: motor puro (triplo uso) + CRUD em Settings (reorder por setas) + integração no import (preview 1-ícone/tooltip-fonte/toggle) + sugestão no manual (popover com origem, precedência apelido>regra) + guarda anti-ReDoS.

**Follow-ups conhecidos** (ver §5): (1) **backup de Account (spec 64)** ainda não cobre `CategorizationRule`/`CategorizationRuleTag` — extensão do contrato de backup; (2) **condição por instituição inerte no import** (parser sem id; funciona no manual); (3) **mitigação robusta de ReDoS** (RE2/worker-timeout) além da heurística; (4) validação visual **light/dark** manual (código usa só tokens semânticos — sem hex).
