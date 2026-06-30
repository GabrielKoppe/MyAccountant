# Spec 49 — Rastreamento de Assinaturas

> Status: draft
> Insumo: levantamento estratégico e benchmark de mercado PFM (2026-06-29) — pilar Profundidade Financeira
> Skills: [`money-handling`](../skills/money-handling/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md) · [`date-timezone`](../skills/date-timezone/SKILL.md)

---

## 1. Problema

- **SUB-01**: As recorrentes via `TableTemplate` (spec 24) são **manuais** — o usuário precisa cadastrar cada assinatura como item de template. Não há **detecção automática** de cobranças recorrentes a partir das transações reais já lançadas/importadas.
- **SUB-02**: Não existe um **painel de assinaturas** consolidando quanto o usuário gasta por mês/ano em serviços recorrentes (Netflix, Spotify, academia, etc.). Rocket Money construiu um negócio inteiro nisso.
- **SUB-03**: Não há **alerta de reajuste de preço**: quando uma assinatura conhecida passa a cobrar um valor maior, nada avisa o usuário.

---

## 2. Solução

Heurística de detecção a partir das transações reais + modelo `Subscription` consolidando cada série, com alerta de reajuste. Reaproveita `expenseType = fixed` (spec 41 TRN-01) e `source` (TRN-03) como sinais.

- **SUB-01**: serviço de detecção que agrupa transações por **descrição similar + valor aproximadamente constante** em meses consecutivos, priorizando as marcadas `expenseType = fixed`. Cada grupo detectado vira uma sugestão de `Subscription` que o usuário confirma.
- **SUB-02**: modelo `Subscription` com `amountCents`, `cycle` (mensal/anual) e `nextExpectedOn`; painel soma total mensal e anual das assinaturas confirmadas.
- **SUB-03**: ao detectar uma nova ocorrência cujo valor sobe acima de um limiar relativo (`priceChangeThresholdPercent`), o sistema marca a assinatura como "reajustada" e registra o valor anterior.

```prisma
enum SubscriptionCycle {
  monthly
  yearly

  @@map("subscription_cycle")
}

model Subscription {
  id              String            @id @default(cuid())
  accountId       String            @map("account_id")
  name            String                                  // "Netflix", "Spotify"
  amountCents     BigInt            @map("amount_cents")  // valor da cobrança no ciclo
  cycle           SubscriptionCycle @default(monthly)
  institutionId   String?           @map("institution_id")
  categoryId      String?           @map("category_id")
  matchPattern    String            @map("match_pattern")  // texto/descrição base p/ casar transações
  nextExpectedOn  DateTime?         @map("next_expected_on") @db.Date
  lastAmountCents BigInt?           @map("last_amount_cents") // valor anterior, p/ alerta de reajuste
  isActive        Boolean           @default(true) @map("is_active")
  createdAt       DateTime          @default(now()) @map("created_at")
  updatedAt       DateTime          @updatedAt @map("updated_at")

  account     Account      @relation(fields: [accountId], references: [id], onDelete: Cascade)
  institution Institution? @relation(fields: [institutionId], references: [id], onDelete: SetNull)
  category    Category?    @relation(fields: [categoryId], references: [id], onDelete: SetNull)

  @@index([accountId])
  @@index([accountId, isActive])
  @@map("subscriptions")
}
```

`Account` ganha `subscriptions Subscription[]`; `Institution` e `Category` ganham `subscriptions Subscription[]`.

---

## 3. User Stories

- Como usuário, quero que o app detecte automaticamente minhas assinaturas a partir das transações recorrentes, para não cadastrar cada uma manualmente.
- Como usuário, quero um painel mostrando todas as minhas assinaturas e o total que gasto por mês e por ano, para identificar serviços que posso cancelar.
- Como usuário, quero ser avisado quando uma assinatura conhecida reajustar o preço, para reavaliar se vale a pena mantê-la.
- Como usuário, quero confirmar ou descartar cada assinatura sugerida, para não poluir o painel com falsos positivos.

---

## 4. Critérios de Aceitação

- QUANDO a detecção roda, O SERVIÇO DEVE agrupar transações com descrição similar e `amountCents` dentro de uma tolerância em pelo menos 2 meses consecutivos, priorizando `expenseType = fixed`, e apresentar cada grupo como **sugestão** não confirmada.
- O SERVIÇO NÃO DEVE criar `Subscription` automaticamente sem confirmação do usuário; sugestões DEVEM ser explicitamente confirmadas.
- QUANDO o usuário confirma uma sugestão, O SISTEMA DEVE criar uma `Subscription` com `amountCents` (`BigInt`), `cycle` e `matchPattern`, persistindo com o `accountId` ativo.
- QUANDO uma nova transação casa o `matchPattern` de uma `Subscription` com valor acima de `last`/atual por mais que o limiar configurado, O SISTEMA DEVE registrar `lastAmountCents` com o valor anterior e sinalizar reajuste.
- QUANDO o painel é exibido, O SISTEMA DEVE somar o total **mensal** e **anual** normalizando o ciclo (anual ÷ 12 para o total mensal; mensal × 12 para o total anual), em `BigInt` centavos. NÃO DEVE usar `Float`.
- QUANDO `nextExpectedOn` é calculado, O SERVIÇO DEVE respeitar a convenção de datas do projeto (`date` sem timezone; timezone só na apresentação).
- **Multi-tenancy**: QUANDO a detecção lê transações ou qualquer query lê `Subscription`, ela DEVE filtrar por `accountId`. Um usuário NÃO DEVE ver assinaturas nem disparar detecção sobre dados de outra account.

---

## 5. Fora de Escopo

- **Cancelamento de assinatura pelo app** (Rocket Money negocia/cancela por você) — fora do escopo; o app apenas rastreia.
- **Negociação de preço com fornecedor** — fora do escopo.
- **Detecção por logo/merchant enrichment via ML** — a heurística é textual + valor; ML fica fora.
- **Recorrentes manuais** — continuam cobertas pela spec 24; esta spec não as substitui.
- **Notificação push de reajuste** — o disparo da notificação é responsabilidade da spec 29; aqui apenas se sinaliza o reajuste no domínio.

---

## 6. Decisões de Design

| Decisão | Escolha | Motivo |
|---|---|---|
| Detecção | Heurística textual + valor ~constante em meses consecutivos | Sem ML; reaproveita `expenseType`/`source` existentes |
| Confirmação | Sugestão sempre confirmada pelo usuário | Evita falsos positivos no painel |
| Reajuste | `lastAmountCents` + limiar relativo | Histórico mínimo suficiente para alertar |
| Normalização de ciclo | `cycle` enum + conversão na agregação | Total mensal e anual comparáveis |

---

## 7. Referências Técnicas

| Item | Arquivo(s) a tocar |
|---|---|
| Modelo `Subscription` + enum | `prisma/schema.prisma` · nova migration `add_subscriptions` |
| Service de detecção | `src/server/services/subscription-detect-service.ts` (novo) |
| Service CRUD + agregação | `src/server/services/subscription-service.ts` (novo) |
| Schemas Zod | `src/lib/schemas/subscription.ts` (novo) |
| Painel de assinaturas | `src/app/(app)/[accountId]/subscriptions/` (novo) ou widget |
| Sinais de origem/tipo | `prisma/schema.prisma` (`expenseType`, `source` em `Transaction`) |
| Labels de UI | `src/lib/messages/pt-BR.ts` |
| Recorrentes (não duplicar) | `specs/24-recurring-transactions.md` |
