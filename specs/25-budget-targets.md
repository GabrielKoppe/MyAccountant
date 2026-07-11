# Spec 25 — Metas de Orçamento

> Status: implemented (BudgetsWidget, BudgetProgressBar, BudgetWidgetContent, settings/budgets, budget-service, budgets.ts action — 2026-07-11)
> Insumo: docs/v2-analysis.md §6 F-04
> Skills: [`multitenancy`](../skills/multitenancy/SKILL.md) · [`money-handling`](../skills/money-handling/SKILL.md) · [`server-actions`](../skills/server-actions/SKILL.md) · [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`design-system`](../skills/design-system/SKILL.md) · [`testing`](../skills/testing/SKILL.md)

---

## 1. Problema

O app registra o que foi gasto, mas não oferece nenhuma forma de comparar com o que se planejava gastar. Famílias e casais que usam o MyAccountant colaborativamente frequentemente têm metas mensais ("não gastar mais de R$2.000 em alimentação"). Hoje, saber se ultrapassou uma meta exige cálculo manual comparando os totais com a meta imaginada.

---

## 2. Solução

Adicionar um sistema de metas de orçamento mensal por **seção**, **categoria**, **membro**, **instituição** e/ou **tipo de tabela**. O usuário define um valor alvo, e o dashboard mensal mostra o progresso (gasto vs. meta) com indicadores visuais de status (ok / atenção / ultrapassado).

A meta é sempre definida em **nível de account** (visível e compartilhada por todos os membros). A dimensão "membro" não cria uma meta pessoal — ela filtra o progresso pelo gasto do membro específico (campo `responsibleUserId` nas transações). Pode ser recorrente (padrão para todos os meses) ou específica para um mês.

---

## 3. User Stories

- Como usuário, quero definir um valor máximo de gasto mensal por seção (ex: máximo R$3.000 em "Gastos"), para saber quando estou perto do limite.
- Como usuário, quero definir um valor alvo por categoria (ex: R$800/mês em "Alimentação"), para controlar gastos específicos.
- Como usuário, quero definir uma meta filtrando por membro (ex: "quanto o João gastou em Alimentação"), para acompanhar gastos individuais dentro da account.
- Como usuário, quero definir metas por instituição ou tipo de tabela para controlar canais de pagamento específicos.
- Como usuário, quero ver no dashboard mensal quanto já gastei vs. minha meta, com uma barra de progresso.
- Como usuário, quero ser alertado visualmente quando atingir meu percentual de alerta configurado (padrão 80%) e quando ultrapassar 100% de uma meta.
- Como usuário, quero selecionar quais metas aparecem destacadas na página de resumo do mês.

---

## 4. Critérios de Aceitação

### Configuração de metas

- O SISTEMA DEVE permitir criar/editar/deletar metas na página de configurações (nova sub-seção "Metas").
- O SISTEMA DEVE permitir criar uma meta diretamente do dashboard mensal via botão que abre um dialog — o mesmo componente de form usado na página de configurações deve ser reutilizado.
- UMA META DEVE poder ser associada a exatamente uma das cinco dimensões: **seção**, **categoria**, **membro**, **instituição** ou **tipo de tabela**.
- **Combinações de dimensões permitidas** (quando faz sentido cruzar dois critérios):
  - ✅ Categoria + Membro
  - ✅ Categoria + Instituição
  - ✅ Seção + Membro
  - ✅ Seção + Instituição
  - ✅ Tipo de tabela + Membro
  - ✅ Tipo de tabela + Instituição
  - ❌ Seção + Categoria — inválido (categoria já pertence a uma seção)
  - ❌ Seção + Tipo de tabela — inválido (conflito conceitual de agrupamento)
- UMA META DEVE ter: valor alvo (`amountCents`), nome opcional (se não preenchido o sistema exibe rótulo gerado automaticamente a partir da dimensão + valor), limiar de alerta configurável (padrão 80%), e opção de ser recorrente ou específica de um mês.
- NÃO HÁ restrição de unicidade — o usuário pode criar múltiplas metas para a mesma dimensão no mesmo mês; a responsabilidade de organização é do usuário.
- UMA META PODE ser marcada como `showInSummary` para aparecer destacada na página de resumo do mês.

### Cálculo de progresso

- O progresso de uma meta é calculado considerando apenas **transações de débito/saída** do mês — a mesma lógica de totalização que o dashboard já usa para seções de gasto.
- Para a dimensão **membro**: filtrar transações onde `responsibleUserId = AccountMember.userId` (join via `account_members`).
- Para metas recorrentes: buscar onde `year IS NULL` e `month IS NULL`.
- Para metas específicas de mês: buscar onde `year = X` e `month = Y`.
- Quando existirem ambas (recorrente + específica) para a mesma dimensão no mesmo mês, a específica tem precedência na exibição, mas ambas são calculadas e exibidas.

### Exibição no dashboard mensal

- **Bloco dedicado**: uma seção "Metas do mês" no dashboard exibe todas as metas ativas com suas barras de progresso.
- **Inline colapsável**: cada seção, categoria, membro, instituição ou tipo de tabela que possui meta exibe uma barra de progresso diretamente junto à sua linha/card no dashboard. Essas barras são **colapsáveis** para não poluir a tela.
- PARA CADA META ATIVA, A BARRA DEVE exibir: nome (ou rótulo automático), valor gasto, valor da meta, percentual.
- QUANDO o percentual atingido é < `alertThresholdPercent`, A BARRA DEVE ser exibida na cor da seção (ou verde padrão).
- QUANDO o percentual está entre `alertThresholdPercent` e 99%, A BARRA DEVE ser exibida em amarelo/âmbar com ícone de atenção.
- QUANDO o percentual atingido é ≥ 100%, A BARRA DEVE ser exibida em vermelho com indicação clara de "ultrapassado".

### Página de resumo do mês

- Metas marcadas com `showInSummary = true` DEVEM aparecer em um bloco dedicado na página de resumo do mês.
- O usuário DEVE poder selecionar/desmarcar o flag `showInSummary` ao criar ou editar uma meta.

---

## 5. Fora de Escopo

- Notificações push/email ao ultrapassar meta (pode integrar com spec 29 de notificações futuramente).
- Metas de receita (apenas metas de gasto/limite).
- Planejamento "orçamento vs. real" com tabela de mês planejado (spec futura F-14).
- Metas anuais (apenas mensais na V2).

---

## 6. Referências Técnicas

**Schema — novo modelo `Budget`:**
```prisma
model Budget {
  id                    String   @id @default(cuid())
  accountId             String   @map("account_id")
  name                  String?
  sectionId             String?  @map("section_id")
  categoryId            String?  @map("category_id")
  memberId              String?  @map("member_id")
  institutionId         String?  @map("institution_id")
  tableTypeId           String?  @map("table_type_id")
  amountCents           BigInt   @map("amount_cents")
  alertThresholdPercent Int      @default(80) @map("alert_threshold_percent")
  isRecurring           Boolean  @default(true) @map("is_recurring")
  showInSummary         Boolean  @default(false) @map("show_in_summary")
  year                  Int?
  month                 Int?
  createdAt             DateTime @default(now()) @map("created_at")
  updatedAt             DateTime @updatedAt @map("updated_at")

  account     Account        @relation(fields: [accountId], references: [id], onDelete: Cascade)
  section     Section?       @relation(fields: [sectionId], references: [id], onDelete: Cascade)
  category    Category?      @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  member      AccountMember? @relation(fields: [memberId], references: [id], onDelete: Cascade)
  institution Institution?   @relation(fields: [institutionId], references: [id], onDelete: Cascade)
  tableType   TableType?     @relation(fields: [tableTypeId], references: [id], onDelete: Cascade)

  @@index([accountId])
  @@map("budgets")
}
```

**Arquivos a criar/modificar:**

| Arquivo | Mudança |
|---------|---------|
| `prisma/schema.prisma` | Novo modelo `Budget` + relações em `Section`, `Category`, `AccountMember`, `Institution`, `TableType` |
| `src/server/services/budget-service.ts` | CRUD + cálculo de progresso por dimensão |
| `src/actions/budgets.ts` | Server Actions: create, update, delete |
| `src/lib/schemas/budget.ts` | Zod schema com validação de combinações incompatíveis |
| `src/app/[locale]/[accountId]/settings/budgets/page.tsx` | Nova sub-página de configuração de metas |
| `src/components/budgets/BudgetFormDialog.tsx` | Dialog de criação/edição — reutilizado no dashboard e nas settings |
| `src/components/budgets/BudgetProgressBar.tsx` | Barra de progresso com estado visual (ok/atenção/ultrapassado) |
| `src/components/dashboards/MonthlyDashboardClient.tsx` | Bloco "Metas do mês" + barras inline colapsáveis |
| `src/components/dashboards/MonthlySummaryClient.tsx` | Bloco de metas com `showInSummary = true` |
| `src/lib/queries/budgets.ts` | Query: buscar metas ativas do mês + calcular progresso |

**Regras de validação (Zod):**
- Pelo menos uma dimensão deve ser preenchida.
- Combinações inválidas rejeitadas: `sectionId + categoryId` e `sectionId + tableTypeId`.
- Se `isRecurring = true`, `year` e `month` devem ser null. Se `isRecurring = false`, ambos são obrigatórios.
- `alertThresholdPercent` deve estar entre 1 e 99.

**Cálculo de progresso — join para dimensão membro:**
```sql
-- Budget.memberId → AccountMember.id → AccountMember.userId = Transaction.responsibleUserId
WHERE t.responsible_user_id = (
  SELECT user_id FROM account_members WHERE id = :memberId
)
```

**Rótulo automático (fallback quando `name` é null):**
- Seção: `{section.name} — até {formatCurrency(amountCents)}`
- Categoria: `{category.name} — até {formatCurrency(amountCents)}`
- Membro: `{member.user.name} — até {formatCurrency(amountCents)}`
- Instituição: `{institution.name} — até {formatCurrency(amountCents)}`
- Tipo de tabela: `{tableType.name} — até {formatCurrency(amountCents)}`
- Combinação: `{dim1.name} + {dim2.name} — até {formatCurrency(amountCents)}`
