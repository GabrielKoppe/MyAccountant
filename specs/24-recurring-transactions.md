# Spec 24 — Transações Recorrentes Automáticas

> Status: draft
> Insumo: docs/v2-analysis.md §6 F-03
> Skills: [`multitenancy`](../skills/multitenancy/SKILL.md) · [`server-actions`](../skills/server-actions/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md) · [`date-timezone`](../skills/date-timezone/SKILL.md) · [`money-handling`](../skills/money-handling/SKILL.md) · [`testing`](../skills/testing/SKILL.md)

---

## 1. Problema

O sistema de `TableTemplate` (modelos de tabela com itens recorrentes) já existe e funciona bem, mas exige ação manual a cada mês: o usuário precisa lembrar de selecionar `sourceMethod = template` ao criar uma tabela e escolher o modelo correto. Para transações verdadeiramente recorrentes (aluguel, salário, assinaturas), esse processo manual mensal é trabalhoso e propenso ao esquecimento.

---

## 2. Solução

Adicionar uma opção de "aplicação automática" nos modelos de tabela (`TableTemplate`). Ao criar um novo mês, o sistema verificará quais modelos têm essa opção ativada e criará automaticamente as tabelas com as transações correspondentes nas seções configuradas.

O usuário configura o modelo uma vez — qual seção usar, qual tipo de tabela — e a partir daí os meses são populados automaticamente ao serem criados.

---

## 3. User Stories

- Como usuário, quero marcar um modelo de tabela como "recorrente automático", para que ao criar um novo mês suas transações sejam adicionadas automaticamente.
- Como usuário, quero configurar em qual seção e com qual tipo de tabela o modelo automático deve ser criado.
- Como usuário, quero poder desativar a aplicação automática de um modelo sem apagá-lo.
- Como usuário, quero revisar e editar as transações criadas automaticamente, pois os valores podem variar (ex: salário com horas extras).

---

## 4. Critérios de Aceitação

- QUANDO o usuário edita um `TableTemplate`, DEVE haver uma opção "Aplicar automaticamente ao criar mês" (toggle on/off).
- QUANDO a opção automática está ativada, O USUÁRIO DEVE poder configurar: a seção de destino e o tipo de tabela a ser criada.
- QUANDO um novo mês é criado (via `createMonth`), O SISTEMA DEVE verificar todos os `TableTemplate` ativos com `autoApply = true` na mesma account.
- PARA CADA modelo com `autoApply = true`, O SISTEMA DEVE criar automaticamente uma tabela no mês recém-criado usando os itens do modelo como transações, com `sourceMethod = template`.
- A data de cada transação automática DEVE usar o campo `day` do `TableTemplateItem` combinado com o mês/ano do mês recém-criado.
- QUANDO um mês é criado com modelos automáticos, O SISTEMA DEVE informar ao usuário quantas tabelas foram criadas automaticamente (ex: snackbar "3 tabelas criadas automaticamente com base nos seus modelos").
- O USUÁRIO DEVE conseguir excluir ou editar as tabelas e transações criadas automaticamente normalmente, sem restrições.
- SE o dia configurado no item do modelo não existir no mês (ex: dia 31 em fevereiro), O SISTEMA DEVE usar o último dia do mês.

---

## 5. Fora de Escopo

- Criação automática de meses (o usuário ainda cria o mês manualmente; apenas o conteúdo é pré-populado).
- Agendamento por data/hora (cron jobs) — o trigger é sempre a criação manual do mês.
- Modelos com valores variáveis ou regras de atualização automática de valores.
- Recorrências com frequência diferente de mensal (ex: trimestral, anual).
- Notificações lembrando o usuário de criar o mês.

---

## 6. Referências Técnicas

**Schema — alterações em `TableTemplate`:**
```prisma
model TableTemplate {
  // campos existentes...
  autoApply         Boolean  @default(false) @map("auto_apply")
  autoSectionId     String?  @map("auto_section_id")
  autoTableTypeId   String?  @map("auto_table_type_id")
}
```

**Nova migration**: adicionar campos `auto_apply`, `auto_section_id`, `auto_table_type_id` em `table_templates`.

| Arquivo | Mudança |
|---------|---------|
| `prisma/schema.prisma` | Adicionar campos ao modelo `TableTemplate` |
| `src/server/services/month-service.ts` | Lógica de aplicação automática em `createMonth` |
| `src/server/services/table-template-service.ts` | CRUD dos novos campos |
| `src/components/settings/TableModelsManager.tsx` | UI para configurar autoApply + seção/tipo destino |
| `src/lib/schemas/table-template.ts` | Atualizar schema Zod |

- A criação das tabelas automáticas DEVE ocorrer dentro da mesma transação do banco que cria o mês (prisma.$transaction) para garantir atomicidade.
- Multi-tenancy: garantir que `autoSectionId` e `autoTableTypeId` pertencem à mesma account do template.
