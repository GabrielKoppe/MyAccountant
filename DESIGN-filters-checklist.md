# DESIGN (WIP) — Paridade de filtros (Parte A) + Widget de checklist mensal (Parte B)

> **Status**: design APROVADO (4 forks confirmados: A1 partyId · A2 full-9 · B1 template · B2 all-months).
> Arquivo de trabalho (§11 CLAUDE.md) — some quando o Part B for dobrado nos specs (01/05/36-checklist).
> Data: 2026-07-04.

## 🔖 HANDOFF / PROGRESSO (ler primeiro pós-compact)

**PART A (paridade de filtros) — ✅ COMPLETO e COMMITADO.**
- Branch `feat/filter-parity`, 2 commits: `17c3a18` (migração ESLint flat-config) + `1d97c71` (paridade de filtros).
- Verificado: typecheck ✓ · lint 0 errors ✓ · 597/597 testes ✓ · reviews (conventions+UI) sem blocker.
- 9 campos nivelados nas 3 superfícies; A1 aplicado (resolver `responsiblePartyIdsForFilter`); tags-as-dimension ADIADO (só filtro). Specs 09/19/36 atualizados.
- Falta só (opcional): drive Playwright das 3 superfícies em light/dark (deferido p/ verificação final).

**PART B (widget checklist mensal) — ✅ COMPLETO (não commitado). Branch `feat/monthly-checklist` (de main, PR2 independente).**
- Tasks 8–12 concluídas. Verificado: typecheck ✓ · lint 0 erros ✓ · 580 testes ✓ · prettier ✓.
- Models `ChecklistItem`/`ChecklistCompletion` + migração `add_monthly_checklist`; zod+service (17 testes, guarda tenant write-time em item E month); actions (defineAction, owner/editor) + `revalidateChecklist`/`revalidateMonth`-na-action; settings page+manager (add/rename/delete+mover); widget só em `month_summary` (singleton, 3 variantes, `useOptimistic(props)`, gated load, 10 testes).
- 3 reviews (conventions/architect/ui) — SEM blocker. Ajustes aplicados: `completedAt` serializado (ISO date-only, renderizado no expanded); delete-on-hover REMOVIDO do widget (footgun → só nas settings com confirm); EmptyState em vez de custom; contraste `text.disabled`→`text.tertiary`; aria-labels; badge read-only p/ viewer; teste de revert otimista; teste de regressão registry; string hardcoded do manager → messages. Notas de custo (recompute full-page, isPending compartilhado) no skill dashboard-widgets §"Widgets que mutam".
- Specs 01 (§3.18/3.19)/05 (§4.7)/36 (§7.7/7.8) + skill dashboard-widgets atualizados.
- Deferido consciente: TOCTOU de label único (dívida herdada de institution-service, consistente); `revalidateMonth` em create/delete usa monthId do client sem guard (inofensivo — revalidatePath não retorna dados).
- ESLint flat-config (`17c3a18`) cherry-picked de feat/filter-parity p/ lint funcionar isolado (dedupa quando PR1 cair na main).
- **Pós-review — 2 ajustes de UX/feature:** (1) widget redesenhado p/ o padrão das listas Pendentes/Favoritas (variantes 1×2/2×3/3×3, badge X/N, densidade caption, sem barra/EmptyState). (2) **Vínculo de transação↔item** (unilateral): `ChecklistCompletion.transactionId` (migração `checklist_completion_transaction_link`, `onDelete: SetNull`); vincular marca concluído; picker do mês (`LinkChecklistTransactionDialog`); chip com valor + desvincular no widget. Service/actions/testes (23 service + 14 widget) + specs 01/36 atualizados. Total 590 testes, lint 0 erros, typecheck ✓.

## Como ler este doc
Cada **DECISÃO** tem um default `[ASSUMED]` (minha recomendação). Vire qualquer um na revisão — a maior parte do design não depende deles.

---

## 0. Auditoria corrigida (Parte A)

Prompt assumiu que só faltava `paymentMethod` e que analysis faltava "4 campos". Auditoria de código diz outra coisa:

| Superfície | Suporta | Faltam (como filtro) |
|---|---|---|
| Drawer do mês (client-side) | 8/9 | `paymentMethod` |
| Widget `filtered-transactions` (Prisma where) | 5/9 | expenseType, source, tags, `paymentMethod` |
| Widget `analysis`/sandbox (Prisma where) | **2/9** | institutions, pending, favorite, expenseType, source, tags, `paymentMethod` (**7**) |

Dimensões de group/series do sandbox hoje: month, section, category, institution, table_type, member.

Conjunto-alvo (paridade) = `{categories, institutions, responsible, pending, favorite, expenseTypes, sources, tags, paymentMethod}` (9 campos).

### Achados do architect-reviewer que remodelam a Parte A

1. **Enums hardcoded em 3–4 lugares** (`page.tsx` `VALID_EXPENSE_TYPES`/`VALID_SOURCES`, `TransactionFilterDrawer.tsx`, `widget-config.ts`) → fonte real do drift. Vira fonte única.
2. **`responsible` é semanticamente INCONSISTENTE** (não é só cobertura):
   - Drawer: `responsiblePartyId[]` → **todas** as kinds de persona (personal/group/external).
   - Widgets: `userId[]` → traduzido por `personalPartyIdsForUsers` → **só** personas `personal`.
   - "Paridade" é falsa até escolher UMA semântica. Ver **DECISÃO A1**.
3. **Diferenças essenciais (não unificáveis trivialmente)**: predicado client (`applyGlobalFilters`, roda sobre `TransactionRow[]` em memória) vs `where` Prisma; `responsible` tem pré-passo **assíncrono** (`await personalPartyIdsForUsers`) que quebra "builder puro por campo"; widget where tem `table:{countInMonth:true}` (piso diferente do drawer).
4. **Spec 19 está desatualizada**: documenta 5 filtros, o drawer tem 8. Atualizar junto.
5. **Fontes de opção divergem**: `getWidgetConfigOptions` tem `members`(userIds)+`tags` mas **não** `parties`; `month-page.ts` tem `parties` mas não no formato do widget. Nenhuma é superconjunto.

---

## 1. Decisões

### DECISÃO (tomada por mim — prompt delegou, req.4): estrutura DRY
**Descriptor leve + fonte única de enums + factory Zod. NÃO catálogo dual-builder.**
- `src/lib/transaction-filters/fields.ts`:
  ```ts
  export const EXPENSE_TYPE_VALUES = [...] as const;   // derivado do enum Prisma
  export const SOURCE_VALUES = [...] as const;
  export const PAYMENT_METHOD_VALUES = [...] as const;

  type FilterFieldKind = "enum" | "relation" | "boolean";
  type FilterFieldDescriptor = {
    key: string;                          // "categories" | "expenseTypes" | ...
    kind: FilterFieldKind;
    enumValues?: readonly string[];       // kind enum
    optionSource?: "category" | "institution" | "tag" | "party"; // kind relation
    prismaField: string;                  // p/ where + dimensão sandbox
    urlParam?: string;                    // só drawer
  };
  export const TRANSACTION_FILTER_FIELDS: Record<string, FilterFieldDescriptor>;
  ```
- **Factory de fragmento Zod** que gera os campos de `MonthFilterState`, `filteredTransactionsConfigSchema` e o subconjunto de filtro do sandbox a partir do mesmo descriptor.
- **Fica explícito** (iterando o descriptor p/ não esquecer campo): `where` Prisma (com pré-passo async do responsible) em `filtered-transactions.ts`/`sandbox.ts`; predicado `applyGlobalFilters` client-side; dimensões do sandbox em `sandbox.ts`.
- **Justificativa**: predicado-client vs where-Prisma é diferença essencial; spec 56 (paginação) pode colapsar o lado client e o problema "dual-builder" some sozinho. Catálogo completo = over-eng agora.
- **Documentar** a assimetria em `specs/19` + skill novo `skills/transaction-filters` p/ não regredir.

### DECISÃO A1 — semântica do `responsible` `[ASSUMED: partyId em todos]`
Unificar em **`responsiblePartyId`** (como o drawer). Widgets passam a filtrar todas as personas.
- Expor `parties` em `getWidgetConfigOptions`.
- Trocar `options.members` → parties nos forms de widget (`WidgetConfigForm.tsx`).
- Aposentar a ponte legado `personalPartyIdsForUsers` (é bridge de legado, conforme comentário no próprio arquivo).
- *(Alternativa B: manter userId nos widgets → paridade fica falsa. Não recomendado.)*

### DECISÃO A2 — escopo de filtros do sandbox `[ASSUMED: full 9]`
Nivelar analysis aos **9 campos** como filtro (institutions/pending/favorite/expenseType/source/tags/paymentMethod novos). Paridade total, sem assimetria residual.
- *(Alternativa B: só os 4 nomeados no prompt → deixa institutions/pending/favorite de fora.)*
- **Dimensões** (group/series): adicionar as que fazem sentido como eixo — paymentMethod, source, expenseType (enums escalares, fáceis); `responsible` (party); tags é N:N (mais custo como dimensão — avaliar). Ver §2.3.

### DECISÃO B1 — semântica do add-inline `[ASSUMED: escreve no template]`
Add/remover inline no widget muda o `ChecklistItem` recorrente → afeta todos os meses. Um caminho de dados só, espelha Institutions. Sem 3º modelo.
- *(Alternativa: tarefa avulsa do mês / ambos → +complexidade de modelo, YAGNI.)*

### DECISÃO B2 — visibilidade por mês `[ASSUMED: todos, inclusive passados]`
Template aparece em qualquer mês; linha de conclusão ausente = pendente. Sem coluna de âncora. Reset/mês de graça.
- *(Alternativa: `effectiveFrom`/year+month + filtro na query → item novo não polui meses fechados.)*

---

## 2. Parte A — design de implementação

### 2.0 Groundwork (task #13) — bloqueia 4/5/6
1. `src/lib/transaction-filters/fields.ts` — enum arrays (do Prisma) + `TRANSACTION_FILTER_FIELDS` + factory Zod.
2. Substituir hardcodes: `page.tsx` (`VALID_*`), `TransactionFilterDrawer.tsx`, `widget-config.ts`.
3. Reconciliar `responsible` (A1): `getWidgetConfigOptions` expõe `parties`; forms trocam members→parties; where dos widgets passa a filtrar `responsiblePartyId` direto (dropar `personalPartyIdsForUsers`).

### 2.1 Drawer do mês (task #4) — add `paymentMethod`
- `MonthFilterContext.tsx`: `MonthFilterState` +`paymentMethods: string[]`; `EMPTY_FILTERS`; `applyGlobalFilters` predicado (`row.paymentMethod ∈ selected`); `hasActiveFilters`/`countActiveFilters`; URL write em `setFilters`.
- `months/[monthId]/page.tsx`: parse do searchParam (usar `PAYMENT_METHOD_VALUES` do descriptor p/ validar).
- `TransactionFilterDrawer.tsx`: accordion novo (padrão do `expenseType`), opções = enum + labels `m.transactions.paymentMethods.*`.
- `ActiveFilterChips.tsx`: chip novo.

### 2.2 Widget `filtered-transactions` (task #5)
- `filteredTransactionsConfigSchema` (widget-config.ts): +expenseType, source, tags, paymentMethod (via factory).
- `filtered-transactions.ts`: estender `where`; re-validação; responsible via partyId (A1).
- `FilteredTransactionsForm` (WidgetConfigForm.tsx): reutilizar `OptionsAutocomplete` p/ tags; selects de enum p/ expenseType/source/paymentMethod; responsible via parties.
- `defaultConfig` no registry + `buildSubtitle` (FilteredTransactionsWidget.tsx).

### 2.3 Widget `analysis`/sandbox (task #6)
- **Filtros** (A2 = full 9): `sandboxConfigSchema` +institutions/pending/favorite/expenseType/source/tags/paymentMethod; `where` em `sandbox.ts` (responsible via partyId).
- **Dimensões**: `SANDBOX_GROUP_BY`/`SANDBOX_SERIES_BY` + `getSandboxData` grouping p/ paymentMethod, source, expenseType (escalares), responsible (party). **tags como dimensão**: N:N → decidir (custo maior; talvez fora do escopo desta task — documentar se cortar).
- `AnalysisForm` (WidgetConfigForm.tsx) accordion de filtros; `buildSubtitle` (AnalysisWidget.tsx).

### 2.4 Testes (task #7) — TDD
- Fragmento `where` por campo novo (filtered-transactions + sandbox).
- Predicado client do drawer p/ paymentMethod.
- Multi-tenancy nas queries.
- Paridade: mesma transação filtrada por X aparece igual nas 3 superfícies.

### Serialização (reuso — não recriar)
`paymentMethod` já em `serializers/transaction.ts:70`, no select `month-page.ts:393`, no bulk patch `transaction.ts:79`.

---

## 3. Parte B — design de implementação

### 3.1 Modelo de dados (task #8) — [B1 template + B2 all-months]
```prisma
model ChecklistItem {
  id          String   @id @default(cuid())
  accountId   String
  label       String
  position    Int
  createdById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  account     Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)
  createdBy   User     @relation(fields: [createdById], references: [id])
  completions ChecklistCompletion[]

  @@unique([accountId, label])   // evita duplicata; ordena por position
  @@index([accountId])
}

model ChecklistCompletion {
  id            String   @id @default(cuid())
  accountId     String   // denormalizado p/ filtro tenant (skill multitenancy)
  itemId        String
  monthId       String
  completedById String
  createdAt     DateTime @default(now())

  account     Account       @relation(fields: [accountId], references: [id], onDelete: Cascade)
  item        ChecklistItem @relation(fields: [itemId], references: [id], onDelete: Cascade)
  month       Month         @relation(fields: [monthId], references: [id], onDelete: Cascade)
  completedBy User          @relation(fields: [completedById], references: [id])

  @@unique([itemId, monthId])   // 1 linha = concluído; ausência = pendente
  @@index([accountId])
  @@index([monthId])
}
```
- **Linha presente = concluído; ausência = pendente.** Toggle = create/delete. Reset/mês = grátis.
- FK `monthId` (não year+month): a página do mês é `[monthId]` → Month sempre existe ao ver/togglar.
- Back-relations em `Account` e `Month`. Cascade em delete de item/month/account.
- Migração: `add_monthly_checklist`.

### 3.2 Zod (task #9) — `src/lib/schemas/checklist.ts`
`createChecklistItem`, `updateChecklistItem`, `deleteChecklistItem`, `reorderChecklist` (ids ordenados), `toggleChecklistCompletion` ({itemId, monthId}).

### 3.3 Service (task #9) — `src/server/services/checklist-service.ts` (espelha institution-service)
`(input, ctx)` tenant-scoped: create (position=max+1), update (rename), delete (cascade), reorder, `toggleCompletion` (verifica item+month ∈ account; upsert/delete linha), `listForMonth(monthId, ctx)` (items + estado), `listItems(ctx)` (template).
- **TDD primeiro**: CRUD + toggle + multi-tenancy (nenhuma query vaza entre accounts).

### 3.4 Actions (task #10) — `src/actions/checklist.ts` via `defineAction`
`requireRoles: [owner, editor]` em TODAS as mutações (viewer read-only, inclusive toggle). Só transporte. Read = query RSC (sem action).

### 3.5 Settings UI (task #10) — espelha Institutions
- Page RSC `settings/checklist/page.tsx` (redirect viewer).
- `ChecklistManager.tsx` client (estado otimista: add/rename/delete/reorder).
- Link em `settings/layout.tsx` `editorLinks`.
- Messages: `settings.nav.checklist`, bloco `settings.checklist.*`.

### 3.6 Widget (task #11) — **só** `month_summary`
- `WidgetDef` **apenas** no array `month_summary` de `WIDGET_REGISTRY` (enforcement end-to-end via `resolveLayout`/`upsertLayout`). `kind:"panel"`, `defaultVisible:false`, `instantiable:false`, **sem** `configSchema`.
- **≥3 `sizeVariants`** (conteúdo real crescente):
  - `compact`: lista de checkboxes + contador "X/N".
  - `default`: + barra/contador de progresso no header + campo add-inline + delete no hover.
  - `large`: + metadata de conclusão ("✓ por Fulano", timestamp de `completedBy`/`createdAt`).
- Ícone em `widget-icons.ts` (grupo `month_summary`); tipo em `widget-types.ts`.
- Componente `src/components/dashboards/panels/ChecklistWidget.tsx` recebe `renderMode`; checkboxes + add/remove chamam actions (skill `ui-feedback`: notistack + `useActionFeedback` + estado otimista). `EmptyState` quando sem tarefas.
- **Precedente**: 1º widget que MUTA dados. Padrão: dados via RSC (server-load) → mutação client→action→service→`revalidatePath` da página do mês. Documentar em spec 36 + skill `dashboard-widgets`.

### 3.7 Data loading (task #11)
`getMonthSummaryData` (`month-page.ts:144`, junto de `summaryWidgets`) carrega `listForMonth`. Registrar node em `MonthSummary.tsx:134` (`nodeByWidgetId`).

### 3.8 Testes (task #9/#12)
Service CRUD+toggle+tenancy (TDD). Widget: render nas 3 variantes; toggle otimista; EmptyState.

---

### 3.9 Arquitetura de mutação (VALIDADA — architect-reviewer) — inegociável
> **Correção de premissa**: NÃO é o "1º widget que muta dados" — `ActivityWidget` já muta
> (`updateTransactionAction`), mas com ANTI-PADRÃO (`useState(props)` + sem revalidate → drift).
> O checklist deve fixar o padrão BOM abaixo; marcar `ActivityWidget` como legado a migrar.

1. **Revalidação na ACTION, nunca no service.** Toggle → `revalidateMonth(ctx.accountId, monthId)`
   (helper JÁ existe em `src/server/api/revalidate.ts` — revalida page do mês + dashboard mensal;
   modo "page", nunca "layout"). Sem isso o widget mostra estado velho por Router Cache. Não usar
   `revalidateTag` (o repo não usa tag-cache).
2. **Feedback: `useOptimistic(props)` + `startTransition`.** PROIBIDO `useState(props)` (não
   re-hidrata, drifta). Base do otimista = prop vinda do RSC → `revalidateMonth` reconcilia sozinho
   (sem `useEffect`/`key` remount). Erro: `defineAction` retorna `{ok:false}` (não lança) ANTES do
   revalidate → servidor intacto → otimista reverte ao fechar a transition. Snackbar via `useActionFeedback`.
3. **Toggle idempotente**: on = `upsert` no `@@unique([itemId, monthId])` (ou createMany skipDuplicates);
   off = `deleteMany({ itemId, monthId, accountId })`. Evita P2002 em double-click/concorrência.
4. **Guarda tenant write-time (INEGOCIÁVEL)**: `toggleCompletion` verifica `item.accountId === ctx.accountId`
   E `month.accountId === ctx.accountId` ANTES de inserir (senão itemId/monthId forjado cria completion
   cross-tenant). Coberto por teste de multi-tenancy (espelha `institution-service.ts`).
5. **Carregamento GATED** em `getMonthSummaryData`: widget é `defaultVisible:false` → maioria das accounts
   não o tem. Só rodar `listForMonth` se o widget estiver no `summaryWidgets` visível resolvido (espelha
   `getFilteredTransactionsMap` em `filtered-transactions.ts`), DENTRO do `Promise.all` existente (não sequencial).
6. **Item-CRUD (account-scoped, sem monthId)**: add `revalidateChecklist(accountId)` em `revalidate.ts`
   (espelha `revalidateInstitutions`, revalida `/settings/checklist`). Inline-add do widget (B1): passar
   `monthId` OPCIONAL ao input de create/delete → quando presente, action chama `revalidateMonth` também
   (item novo aparece no mês atual) + `revalidateChecklist`. Não misturar `router.refresh()` com `revalidatePath`.
7. **Skill**: adicionar seção "Widgets que mutam dados" em `skills/dashboard-widgets/SKILL.md` (itens 1-6 acima
   + tabela contexto→revalidate + gating de papel viewer=read-only espelhando `requireRoles`).

## 4. Specs a atualizar (spec-anchored — task #12)
- `specs/01-domain-model.md` — `ChecklistItem` / `ChecklistCompletion`.
- `specs/05-account-settings.md` — settings-list do checklist.
- `specs/09-transactions.md` + `specs/19-transaction-search-filter-sort.md` — conjunto de 9 filtros nivelado (spec 19 hoje diz 5) + `paymentMethod`; semântica canônica do `responsible` (A1); assimetria client-predicate vs Prisma-where documentada.
- `specs/36-widgets-configuraveis-instanciaveis.md` — widget checklist + precedente de widget que muta dados.
- `skills/dashboard-widgets/SKILL.md` — padrão widget-com-mutação (se novo).
- `skills/transaction-filters/SKILL.md` (novo) — descriptor + contrato dos 9 campos + assimetria de execução.

## 5. Verificação (task #12)
`prisma validate` → `typecheck` → `lint` → `test`. Depois Playwright: cada filtro novo nas 3 superfícies + checklist em ≥2 meses, **light e dark**. Reviews: `myaccountant-reviewer` + `ui-critique`.

## 6. Corte de PRs
Fronteira natural = "PART B". PR1 = Parte A (groundwork+3 superfícies+testes+specs 09/19). PR2 = Parte B (checklist completo+specs 01/05/36).

## 7. Riscos abertos
- A1 (partyId) toca o sistema de responsible-party (spec 60 recém-merjado) — validar que os forms de widget e `getWidgetConfigOptions` acomodam parties sem quebrar dashboards existentes.
- tags como dimensão do sandbox (N:N) pode ficar fora do escopo — decidir na §2.3.
- Migração de config existente de widgets: `filteredTransactionsConfigSchema` ganha campos novos opcionais → configs salvas antigas continuam válidas (campos default vazio). Confirmar na re-validação.
