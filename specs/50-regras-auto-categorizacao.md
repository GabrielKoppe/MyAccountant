# Spec 50 — Motor de Regras de Auto-categorização

> Status: draft
> Insumo: levantamento estratégico e benchmark de mercado PFM (2026-06-29) — pilar Profundidade Financeira
> Skills: [`server-actions`](../skills/server-actions/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md) · [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md)

---

## 1. Problema

- **RULE-01**: O import CSV/XLSX (spec 10) traz transações sem categoria; o usuário **categoriza manualmente** linha a linha no preview, repetindo o mesmo trabalho a cada extrato ("toda linha com `IFOOD` é Alimentação").
- **RULE-02**: Transações manuais novas também exigem categorização repetitiva — não há memória das decisões anteriores do usuário.
- **RULE-03**: Não existe um **motor de regras if-then** (condição → ação) como o de Firefly III e Monarch, que permita automatizar categoria, responsável, tags e tipo de gasto com base na descrição, instituição ou faixa de valor.

---

## 2. Solução

Modelo `CategorizationRule` com condições e ações, aplicado no **preview de import** e, opcionalmente, a novas transações manuais. Regras têm **ordem de avaliação** (prioridade). Reaproveita `Tag` (spec 41 TRN-04) e `expenseType` (TRN-01).

- **RULE-01 / RULE-02**: motor que avalia regras em ordem e aplica a primeira (ou todas, conforme `stopOnMatch`) cujas condições casam, preenchendo os campos-alvo da transação.
- **RULE-03**: condições — descrição `contains`/`regex`, `institutionId`, faixa de valor (`minCents`/`maxCents`); ações — `categoryId`, `subcategoryId`, `responsibleUserId`, `expenseType`, e tags a adicionar.

```prisma
enum CategorizationMatchMode {
  contains
  regex

  @@map("categorization_match_mode")
}

model CategorizationRule {
  id                  String                  @id @default(cuid())
  accountId           String                  @map("account_id")
  name                String?
  priority            Int                     @default(0)          // menor = avaliada primeiro
  isActive            Boolean                 @default(true) @map("is_active")
  applyToManual       Boolean                 @default(false) @map("apply_to_manual") // tb em lançamentos manuais
  stopOnMatch         Boolean                 @default(true) @map("stop_on_match")

  // Condições (todas as preenchidas devem casar — AND)
  descriptionMode     CategorizationMatchMode? @map("description_mode")
  descriptionValue    String?                  @map("description_value")
  institutionId       String?                  @map("institution_id")
  minCents            BigInt?                  @map("min_cents")
  maxCents            BigInt?                  @map("max_cents")

  // Ações
  setCategoryId       String?                  @map("set_category_id")
  setSubcategoryId    String?                  @map("set_subcategory_id")
  setResponsibleUserId String?                 @map("set_responsible_user_id")
  setExpenseType      TransactionExpenseType?  @map("set_expense_type")
  addTagIds           Json                     @default("[]") @map("add_tag_ids") // string[] de Tag.id

  createdById         String                   @map("created_by_id")
  createdAt           DateTime                 @default(now()) @map("created_at")
  updatedAt           DateTime                 @updatedAt @map("updated_at")

  account     Account      @relation(fields: [accountId], references: [id], onDelete: Cascade)
  institution Institution? @relation(fields: [institutionId], references: [id], onDelete: SetNull)
  category    Category?    @relation(fields: [setCategoryId], references: [id], onDelete: SetNull)

  @@index([accountId])
  @@index([accountId, isActive, priority])
  @@map("categorization_rules")
}
```

`Account` ganha `categorizationRules CategorizationRule[]`; `Institution` e `Category` ganham a relação correspondente.

---

## 3. User Stories

- Como usuário, quero criar uma regra "se a descrição contém IFOOD então categoria = Alimentação", para não recategorizar manualmente a cada import.
- Como usuário, quero que as regras sejam aplicadas no preview do import, para revisar o resultado antes de salvar.
- Como usuário, quero opcionalmente aplicar regras também a lançamentos manuais novos, para padronizar a categorização em todo o app.
- Como usuário, quero ordenar minhas regras por prioridade, para controlar qual vence quando mais de uma casa.

---

## 4. Critérios de Aceitação

- QUANDO o preview de import é montado, O MOTOR DEVE avaliar as regras ativas em ordem crescente de `priority` e aplicar as ações da(s) regra(s) cujas condições casam, **sem salvar** — apenas preenchendo o preview editável pelo usuário.
- SE `stopOnMatch = true` numa regra que casa, O MOTOR NÃO DEVE avaliar regras de prioridade inferior para aquela transação; SE `false`, DEVE continuar acumulando ações de regras subsequentes.
- QUANDO múltiplas condições estão preenchidas numa regra, TODAS DEVEM casar (AND) para a regra ser aplicada.
- QUANDO a condição é faixa de valor, O MOTOR DEVE comparar `amountCents` (`BigInt`) com `minCents`/`maxCents` em centavos; NÃO DEVE converter para `Float`.
- SE `descriptionMode = regex`, O MOTOR DEVE validar a regex no salvamento da regra e rejeitar padrões inválidos com erro claro.
- QUANDO `applyToManual = true`, O MOTOR DEVE rodar as regras na criação de uma transação manual; QUANDO `false`, a transação manual NÃO DEVE ser afetada.
- QUANDO uma ação referencia `setCategoryId`, `setSubcategoryId`, `setResponsibleUserId` ou `addTagIds`, O MOTOR DEVE validar que todas pertencem à mesma account antes de aplicar.
- **Multi-tenancy**: QUANDO o motor avalia regras ou qualquer query lê `CategorizationRule`, ela DEVE filtrar por `accountId`. Regras de uma account NÃO DEVEM ser aplicadas a transações de outra.

---

## 5. Fora de Escopo

- **Auto-categorização por ML** — apenas regras determinísticas if-then; ML está fora (consistente com spec 41 §6).
- **Aplicação retroativa em massa** ao histórico já existente — escopo inicial cobre import e novos lançamentos; reprocessar o passado fica para spec futura.
- **Ações além de categorização** (ex: mover de tabela, criar vínculo) — restrito aos campos listados.
- **Sugestão automática de regras** a partir de padrões — fora do escopo; regras são criadas manualmente.
- **Condições compostas com OR** — apenas AND entre condições de uma mesma regra; OR se obtém com múltiplas regras.

---

## 6. Decisões de Design

| Decisão | Escolha | Motivo |
|---|---|---|
| Ordem de avaliação | Campo `priority` (menor primeiro) | Controle explícito e estável do usuário |
| Combinação de condições | AND entre condições preenchidas | Previsível; OR via múltiplas regras |
| `stopOnMatch` | Configurável por regra | Permite tanto "primeira vence" quanto acúmulo |
| Tags na ação | `addTagIds Json` (string[]) | Reaproveita `Tag` (TRN-04) sem tabela ponte extra |
| Aplicação a manuais | Opt-in via `applyToManual` | Evita surpresa em lançamentos manuais |

---

## 7. Referências Técnicas

| Item | Arquivo(s) a tocar |
|---|---|
| Modelo `CategorizationRule` + enum | `prisma/schema.prisma` · nova migration `add_categorization_rules` |
| Motor de avaliação | `src/server/services/categorization-rule-engine.ts` (novo) |
| Integração no preview de import | `src/server/services/csv-import-service.ts` |
| Aplicação em transação manual | `src/server/services/transaction-service.ts` |
| Schemas Zod (com validação de regex) | `src/lib/schemas/categorization-rule.ts` (novo) |
| Actions CRUD de regras | `src/actions/categorization-rules.ts` (novo) |
| Tags e expenseType (reaproveitar) | `prisma/schema.prisma` (`Tag`, `TransactionExpenseType`) |
| Import (não duplicar) | `specs/10-csv-xlsx-import.md` |
| Labels de UI | `src/lib/messages/pt-BR.ts` |
