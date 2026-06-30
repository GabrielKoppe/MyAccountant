# Spec 47 — Metas de Poupança

> Status: draft
> Insumo: levantamento estratégico e benchmark de mercado PFM (2026-06-29) — pilar Profundidade Financeira
> Skills: [`money-handling`](../skills/money-handling/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md) · [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md) · [`dashboards-charts`](../skills/dashboards-charts/SKILL.md)

---

## 1. Problema

- **GOAL-01**: A spec 25 (`Budget`, ver `prisma/schema.prisma` model `Budget`) entrega **limites de gasto** mensais — "não gastar mais que X". Não existe o conceito oposto: **meta de acúmulo** ("juntar R$ 20.000 para a viagem até dezembro"), com valor-alvo e prazo.
- **GOAL-02**: Sem meta de acúmulo, não há **acompanhamento de progresso** (quanto já foi guardado vs. alvo) nem projeção de quando a meta será atingida no ritmo atual. YNAB e Monarch têm goals como feature central.
- **GOAL-03**: Não há suporte **colaborativo** a metas: numa account com vários membros (casal/família), é impossível rastrear quanto cada membro contribuiu para uma meta conjunta. O `Budget` da spec 25 filtra por membro, mas não acumula contribuições.

---

## 2. Solução

Introduzir `Goal` (meta de acúmulo com alvo e prazo) e `GoalContribution` (aportes rastreados por membro), com widget de progresso. Valores em `BigInt` centavos.

- **GOAL-01**: modelo `Goal` com `targetCents`, `deadline` opcional e dimensão opcional (`sectionId` ou `categoryId`) para sugerir contribuições a partir de transações relacionadas.
- **GOAL-02**: progresso = soma de `GoalContribution.amountCents`; widget de barra/percentual e estimativa de conclusão.
- **GOAL-03**: `GoalContribution` carrega `byUserId` (quem aportou) e `transactionId` opcional (vínculo ao lançamento), permitindo metas conjuntas com contribuição rastreada por membro.

```prisma
model Goal {
  id          String    @id @default(cuid())
  accountId   String    @map("account_id")
  name        String                              // "Viagem ao Japão", "Reserva de emergência"
  targetCents BigInt    @map("target_cents")
  deadline    DateTime? @db.Date                  // prazo opcional
  sectionId   String?   @map("section_id")        // dimensão opcional p/ sugerir aportes
  categoryId  String?   @map("category_id")
  isAchieved  Boolean   @default(false) @map("is_achieved")
  createdById String    @map("created_by_id")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  account       Account            @relation(fields: [accountId], references: [id], onDelete: Cascade)
  section       Section?           @relation(fields: [sectionId], references: [id], onDelete: SetNull)
  category      Category?          @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  contributions GoalContribution[]

  @@index([accountId])
  @@map("goals")
}

model GoalContribution {
  id            String   @id @default(cuid())
  accountId     String   @map("account_id")
  goalId        String   @map("goal_id")
  amountCents   BigInt   @map("amount_cents")
  contributedOn DateTime @map("contributed_on") @db.Date
  byUserId      String   @map("by_user_id")        // membro que aportou
  transactionId String?  @map("transaction_id")    // vínculo opcional ao lançamento
  notes         String?
  createdAt     DateTime @default(now()) @map("created_at")

  account     Account      @relation(fields: [accountId], references: [id], onDelete: Cascade)
  goal        Goal         @relation(fields: [goalId], references: [id], onDelete: Cascade)
  byUser      User         @relation("GoalContributor", fields: [byUserId], references: [id], onDelete: Restrict)
  transaction Transaction? @relation(fields: [transactionId], references: [id], onDelete: SetNull)

  @@index([accountId])
  @@index([goalId])
  @@map("goal_contributions")
}
```

`Account` ganha `goals Goal[]` e `goalContributions GoalContribution[]`; `User` ganha `goalContributions GoalContribution[] @relation("GoalContributor")`; `Transaction` ganha `goalContributions GoalContribution[]`.

---

## 3. User Stories

- Como usuário, quero criar uma meta de poupança com valor-alvo e prazo (ex: "R$ 20.000 até dez/2026"), para ter um objetivo claro de acúmulo.
- Como usuário, quero registrar aportes para uma meta, para ver o progresso aumentar em direção ao alvo.
- Como membro de uma account colaborativa, quero que minha contribuição a uma meta conjunta seja registrada no meu nome, para sabermos quanto cada um aportou.
- Como usuário, quero ver no dashboard uma barra de progresso e a estimativa de quando atingirei a meta no ritmo atual, para me planejar.

---

## 4. Critérios de Aceitação

- QUANDO o usuário cria uma `Goal`, O SISTEMA DEVE exigir `name` e `targetCents` (em centavos, `BigInt`); `deadline` é opcional.
- QUANDO o usuário registra uma `GoalContribution`, O SISTEMA DEVE gravar `amountCents` (`BigInt`), `contributedOn` (`date`) e `byUserId` = usuário autenticado, e somar ao progresso da meta. NÃO DEVE usar `Float`.
- QUANDO o progresso (soma das contribuições) atinge ou ultrapassa `targetCents`, O SISTEMA DEVE marcar `isAchieved = true`.
- SE a `Goal` possui `deadline`, O WIDGET DEVE exibir o aporte mensal necessário para atingir o alvo até o prazo, calculado a partir do saldo restante e dos meses restantes.
- QUANDO uma `GoalContribution` é vinculada a um `transactionId`, O SISTEMA DEVE validar que a transação pertence à mesma account; SE não pertencer, DEVE rejeitar.
- **Multi-tenancy**: QUANDO qualquer query lê ou grava `Goal` / `GoalContribution`, ela DEVE filtrar por `accountId`. Um usuário NÃO DEVE conseguir aportar em ou ler uma meta de outra account, mesmo informando um `goalId` válido de terceiro.
- O WIDGET de progresso DEVE renderizar a barra com tokens semânticos do tema em light e dark mode, nunca hex hardcoded.

---

## 5. Fora de Escopo

- **Dedução automática do patrimônio líquido** ao aportar — integração com spec 46 fica para uma spec futura.
- **Sub-metas / metas aninhadas** — uma meta é plana neste escopo.
- **Lembretes/notificações de aporte** — coberto pela spec 29 (notificações).
- **Movimentação real de dinheiro entre contas** — o aporte é um registro, não transfere saldo.
- **Metas de redução de dívida** — coberto pela spec 51 (Gestão de Dívidas).

---

## 6. Decisões de Design

| Decisão | Escolha | Motivo |
|---|---|---|
| Progresso | Derivado da soma de `GoalContribution` | Evita campo redundante propenso a divergir |
| Contribuição por membro | `byUserId` obrigatório na contribuição | Habilita metas conjuntas rastreáveis |
| Vínculo a transação | `transactionId` opcional, `onDelete: SetNull` | Aporte sobrevive à exclusão da transação |
| Diferença vs. Budget (spec 25) | `Goal` é acúmulo (alvo), `Budget` é limite (teto) | Conceitos opostos, modelos separados |

---

## 7. Referências Técnicas

| Item | Arquivo(s) a tocar |
|---|---|
| Modelos `Goal` / `GoalContribution` | `prisma/schema.prisma` · nova migration `add_goals` |
| Schemas Zod (form + action) | `src/lib/schemas/goal.ts` (novo) |
| Service de metas e progresso | `src/server/services/goal-service.ts` (novo) |
| Actions de criação/aporte | `src/actions/goals.ts` (novo) |
| Serialização BigInt → string | `src/lib/serializers/` (novo serializer) |
| Widget de progresso | `src/components/dashboard/widgets/` (novo widget `goal-progress`) |
| Labels de UI | `src/lib/messages/pt-BR.ts` |
| Referência de limites (não duplicar) | `specs/25-budget-targets.md` |
