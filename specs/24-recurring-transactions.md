# Spec 24 — Transações Recorrentes Automáticas

> Status: implemented (InstallmentGroupPanel, installment-service, createInstallmentGroupAction, integrado em TransactionRowDetails — 2026-07-11)
> Insumo: docs/v2-analysis.md §6 F-03
> Skills: [`multitenancy`](../skills/multitenancy/SKILL.md) · [`server-actions`](../skills/server-actions/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md) · [`date-timezone`](../skills/date-timezone/SKILL.md) · [`money-handling`](../skills/money-handling/SKILL.md) · [`testing`](../skills/testing/SKILL.md)

---

## 1. Problema

O sistema de `TableTemplate` (modelos de tabela com itens recorrentes) já existe e funciona bem, mas exige ação manual a cada mês: o usuário precisa lembrar de selecionar `sourceMethod = template` ao criar uma tabela e escolher o modelo correto. Para transações verdadeiramente recorrentes (aluguel, salário, assinaturas), esse processo manual mensal é trabalhoso e propenso ao esquecimento.

---

## 2. Solução

Adicionar uma opção de "aplicação automática" nos modelos de tabela (`TableTemplate`). Ao criar um novo mês, o sistema verificará quais modelos têm essa opção ativada e criará automaticamente as tabelas com as transações correspondentes nas seções configuradas.

O usuário configura o modelo uma vez — qual seção usar, qual tipo de tabela — e a partir daí os meses são populados automaticamente ao serem criados.

Esta feature é um **enriquecimento do fluxo de `TableTemplate` existente**, não uma nova abstração. O mecanismo de aplicação manual (criar tabela via `sourceMethod = template`) permanece disponível para os casos em que o usuário queira aplicar um modelo a um mês já criado.

---

## 3. User Stories

- Como usuário, quero marcar um modelo de tabela como "recorrente automático", para que ao criar um novo mês suas transações sejam adicionadas automaticamente.
- Como usuário, quero configurar em qual seção e com qual tipo de tabela o modelo automático deve ser criado.
- Como usuário, quero poder desativar a aplicação automática de um modelo sem apagá-lo.
- Como usuário, quero revisar e editar as transações criadas automaticamente, pois os valores podem variar (ex: salário com horas extras).

---

## 4. Critérios de Aceitação

- QUANDO o usuário edita um `TableTemplate`, DEVE haver uma opção "Aplicar automaticamente ao criar mês" (toggle on/off).
- QUANDO a opção automática está ativada, O USUÁRIO DEVE poder configurar: a seção de destino e o tipo de tabela a ser criada. **Esses campos são obrigatórios enquanto o toggle estiver ativado** — o save deve ser bloqueado até ambos estarem preenchidos.
- QUANDO um novo mês é criado (via `createMonth`), O SISTEMA DEVE verificar todos os `TableTemplate` com `autoApply = true` na mesma account.
- PARA CADA modelo com `autoApply = true`, O SISTEMA DEVE tentar criar automaticamente uma tabela no mês recém-criado usando os itens do modelo como transações, com `sourceMethod = template`. O nome da tabela criada é o mesmo nome do `TableTemplate`.
- SE um modelo não tiver itens (lista vazia), a tabela é criada normalmente, porém vazia.
- A data de cada transação automática DEVE usar o campo `day` do `TableTemplateItem` combinado com o mês/ano do mês recém-criado, seguindo a mesma regra do fluxo de template existente: SE o dia configurado não existir no mês (ex: dia 31 em fevereiro), usar o último dia do mês.
- A criação das tabelas automáticas usa estratégia de **melhor esforço**: o mês é sempre criado com sucesso, independentemente de falhas individuais nos modelos. Modelos com configuração inválida (ex: tipo de tabela deletado após ativação do autoApply) são ignorados e reportados como falha no feedback ao usuário.
- A ordem de criação das tabelas automáticas segue a ordem de criação dos `TableTemplate` (mais antigo primeiro).
- QUANDO um mês é criado com modelos automáticos, O SISTEMA DEVE exibir um **snackbar expansível** com texto resumido (ex: "3 tabelas criadas automaticamente") e um accordion que lista cada modelo processado com ícone de status (✓ sucesso / ✗ falha). Modelos com falha exibem o motivo via tooltip/hover.
- O USUÁRIO DEVE conseguir excluir ou editar as tabelas e transações criadas automaticamente normalmente, sem restrições.
- A configuração de `autoApply` pode ser feita por **owners e editors** da account.
- Seções são entidades de account; ao criar um mês, todas as seções da account são automaticamente instanciadas — portanto `autoSectionId` estará sempre disponível no mês recém-criado.

---

## 5. Fora de Escopo

- Criação automática de meses (o usuário ainda cria o mês manualmente; apenas o conteúdo é pré-populado).
- Agendamento por data/hora (cron jobs) — o trigger é sempre a criação manual do mês.
- Re-aplicação manual de modelos automáticos a um mês já existente — o fluxo de `sourceMethod = template` já cobre esse caso.
- Modelos com valores variáveis ou regras de atualização automática de valores.
- Recorrências com frequência diferente de mensal (ex: trimestral, anual).
- Notificações lembrando o usuário de criar o mês.
- Ordenação manual de tabelas dentro de uma seção (deferred para spec futura).

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
| `src/server/services/month-service.ts` | Lógica de aplicação automática em `createMonth` (melhor esforço — não dentro de uma única transaction atômica) |
| `src/server/services/table-template-service.ts` | CRUD dos novos campos |
| `src/components/settings/TableModelsManager.tsx` | UI para configurar autoApply + seção/tipo destino (campos obrigatórios quando toggle ativo) |
| `src/lib/schemas/table-template.ts` | Atualizar schema Zod (autoSectionId e autoTableTypeId obrigatórios quando autoApply = true) |
| `src/components/ui/` | Componente snackbar expansível com accordion de status por modelo |
| `src/lib/messages/pt-BR.ts` | Mensagens de feedback do snackbar |

**Estratégia de criação (melhor esforço):**
- O mês é criado normalmente em uma transação.
- Para cada `TableTemplate` com `autoApply = true`, a criação da tabela é tentada individualmente.
- Falhas individuais são capturadas, logadas (Pino) e reportadas no snackbar — sem impedir a criação do mês ou das demais tabelas.

**Componente de feedback:**
- Snackbar com texto resumido (ex: "3 de 4 tabelas criadas automaticamente").
- Accordion expansível listando cada modelo com ícone ✓ (sucesso) ou ✗ (falha).
- Modelos com falha exibem o motivo via tooltip ao hover.
- Design segue o sistema "Warm Calm" com tokens semânticos de `design-tokens.ts` (sem cores hardcoded).
- Exibido tanto em sucesso total quanto parcial.

**Regras de UI obrigatórias (ver [`skills/design-system/SKILL.md`](../skills/design-system/SKILL.md) e [`skills/mui-patterns/SKILL.md`](../skills/mui-patterns/SKILL.md)):**
- **Somente MUI** — proibido misturar Tailwind, shadcn ou CSS modules.
- **Tokens semânticos sempre** (`background.surface`, `accent.primary`, etc.) — nunca hex hardcoded em componentes.
- Customização via `sx prop`, `styled API` ou tema — nunca `!important` ou `style={}` inline com cores.
- Espaçamentos via tokens de `layout` (`layout.card`, `layout.stack`, `layout.inline`) — nunca valores mágicos (`sx={{ p: 8 }}`).
- Usar `<DialogShell>` para qualquer dialog, `<EmptyState>` para estados vazios, `<PageHeader>` para cabeçalhos de página.
- Cores de status (`success`, `danger`, `warning`) apenas com significado financeiro real — nunca decorativo.
- Todo componente novo deve ser testado em **light e dark mode**.

**Multi-tenancy:**
- Garantir que `autoSectionId` e `autoTableTypeId` pertencem à mesma account do template.
- Validação deve ocorrer no service, não apenas no schema Zod.

---

## 7. Decisões de Refinamento

| # | Decisão |
|---|---------|
| D1 | Seções são entidades de account instanciadas por mês — `autoSectionId` sempre existirá no mês criado |
| D2 | Estratégia de falha: melhor esforço — mês sempre criado; modelos inválidos ignorados com reporte |
| D3 | Re-aplicação a mês existente não é necessária — fluxo manual de template já cobre |
| D4 | Nome da tabela auto-criada = nome do `TableTemplate` |
| D5 | Data das transações: mesma regra do template existente (dia > último dia do mês → último dia) |
| D6 | Permissão para configurar autoApply: owners e editors |
| D7 | Feedback: snackbar expansível com accordion (✓/✗ por modelo, tooltip de erro nas falhas) |
| D8 | Template sem itens: cria tabela vazia mesmo assim |
| D9 | `autoSectionId` e `autoTableTypeId` obrigatórios quando `autoApply = true` — save bloqueado |
| D10 | Ordenação das tabelas auto-criadas: ordem de criação do template (mais antigo primeiro) |
