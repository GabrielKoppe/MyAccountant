# Spec 25 — Metas de Orçamento

> Status: draft
> Insumo: docs/v2-analysis.md §6 F-04
> Skills: [`multitenancy`](../skills/multitenancy/SKILL.md) · [`money-handling`](../skills/money-handling/SKILL.md) · [`server-actions`](../skills/server-actions/SKILL.md) · [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`design-system`](../skills/design-system/SKILL.md) · [`testing`](../skills/testing/SKILL.md)

---

## 1. Problema

O app registra o que foi gasto, mas não oferece nenhuma forma de comparar com o que se planejava gastar. Famílias e casais que usam o MyAccountant colaborativamente frequentemente têm metas mensais ("não gastar mais de R$2.000 em alimentação"). Hoje, saber se ultrapassou uma meta exige cálculo manual comparando os totais com a meta imaginada.

---

## 2. Solução

Adicionar um sistema simples de metas de orçamento mensal por **seção** e/ou por **categoria**. O usuário define um valor alvo, e o dashboard mensal mostra o progresso (gasto vs. meta) com indicadores visuais de status (ok / atenção / ultrapassado).

A meta é definida em nível de account (vale para todos os membros) e pode ser configurada por mês específico ou como padrão recorrente.

---

## 3. User Stories

- Como usuário, quero definir um valor máximo de gasto mensal por seção (ex: máximo R$3.000 em "Gastos"), para saber quando estou perto do limite.
- Como usuário, quero definir um valor alvo por categoria (ex: R$800/mês em "Alimentação"), para controlar gastos específicos.
- Como usuário, quero ver no dashboard mensal quanto já gastei vs. minha meta, com uma barra de progresso.
- Como usuário, quero ser alertado visualmente quando atingir 80% e 100% de uma meta.

---

## 4. Critérios de Aceitação

**Configuração de metas:**
- O SISTEMA DEVE permitir definir metas na página de configurações (nova sub-seção "Metas") ou diretamente no dashboard mensal.
- UMA META DEVE poder ser associada a: uma seção OU uma categoria (não ambos ao mesmo tempo, para manter simplicidade).
- UMA META DEVE ter: valor alvo em centavos, e opção de ser "padrão recorrente" (aplica a todos os meses) ou específica para um mês.
- O USUÁRIO DEVE poder criar, editar e deletar metas.

**Exibição no dashboard:**
- QUANDO o dashboard mensal é carregado, O SISTEMA DEVE calcular o gasto atual de cada seção/categoria que possui meta.
- PARA CADA META ATIVA, UMA BARRA DE PROGRESSO DEVE ser exibida com: valor gasto, valor da meta, percentual.
- QUANDO o percentual atingido é < 80%, A BARRA DEVE ser exibida na cor da seção (ou verde padrão).
- QUANDO o percentual está entre 80% e 99%, A BARRA DEVE ser exibida em amarelo/âmbar com ícone de atenção.
- QUANDO o percentual atingido é ≥ 100%, A BARRA DEVE ser exibida em vermelho com indicação clara de "ultrapassado".

---

## 5. Fora de Escopo

- Notificações push/email ao ultrapassar meta (pode integrar com spec 29 de notificações futuramente).
- Metas de receita (apenas metas de gasto/limite).
- Metas para seções do tipo `add` (renda) — inicialmente apenas para `subtract`.
- Planejamento "orçamento vs. real" com tabela de mês planejado (spec futura F-14).
- Metas anuais (apenas mensais na V2).

---

## 6. Referências Técnicas

**Schema — novo modelo `Budget`:**
```prisma
model Budget {
  id          String   @id @default(cuid())
  accountId   String   @map("account_id")
  sectionId   String?  @map("section_id")
  categoryId  String?  @map("category_id")
  amountCents BigInt   @map("amount_cents")
  isRecurring Boolean  @default(true) @map("is_recurring")
  year        Int?
  month       Int?
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  account  Account      @relation(...)
  section  Section?     @relation(...)
  category Category?    @relation(...)

  @@index([accountId])
  @@map("budgets")
}
```

| Arquivo | Mudança |
|---------|---------|
| `prisma/schema.prisma` | Novo modelo `Budget` |
| `src/server/services/` | Novo `budget-service.ts` |
| `src/actions/` | Novo `budgets.ts` |
| `src/lib/schemas/` | Novo `budget.ts` |
| `src/app/.../settings/` | Nova sub-página `budgets/page.tsx` |
| `src/components/dashboards/MonthlyDashboardClient.tsx` | Seção de metas com barras de progresso |
| `src/lib/queries/dashboards.ts` | Função para buscar metas + progresso do mês |

- Constraint: se `sectionId` preenchido, `categoryId` deve ser null, e vice-versa.
- Para metas recorrentes (`isRecurring = true`): buscar onde `year` e `month` são null.
- Para metas específicas de mês: buscar onde `year = X` e `month = Y`.
- Prioridade: meta específica do mês tem precedência sobre meta recorrente.
