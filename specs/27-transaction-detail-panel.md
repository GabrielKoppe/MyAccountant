# Spec 27 — Painel de Detalhes da Transação

> Status: draft
> Insumo: docs/v2-analysis.md §5 SEC-03 (reinterpretado conforme feedback do usuário)
> Skills: [`multitenancy`](../skills/multitenancy/SKILL.md) · [`money-handling`](../skills/money-handling/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`design-system`](../skills/design-system/SKILL.md) · [`date-timezone`](../skills/date-timezone/SKILL.md)

---

## 1. Problema

O sistema registra `createdById`, `createdAt`, `updatedById` e `updatedAt` em cada transação, mas essas informações nunca são exibidas para o usuário. Em um contexto colaborativo (casal, família), saber "quem adicionou essa transação" ou "quando foi a última alteração" é uma informação útil para transparência e rastreabilidade.

Além disso, campos como `notes`, `cardInstallment`, `investmentType` e `institutionText` — que existem no schema e podem estar preenchidos — não têm um lugar consolidado onde o usuário possa visualizá-los sem entrar em modo de edição.

O usuário optou por não implementar um log de auditoria completo (muito pesado para o público-alvo) e sim por uma visão expandida e informativa da transação.

---

## 2. Solução

Adicionar uma opção "Ver detalhes" no menu ⋮ de cada transação. Ao clicar, um drawer lateral (MUI `Drawer`, ancorado à direita) abre com uma visão completa e organizada da transação:

- Todos os campos preenchidos da transação
- Informações de auditoria: criado por (avatar + nome), criado em, última alteração por (avatar + nome), alterado em
- Ação de "Editar" que fecha o drawer e ativa o modo de edição inline

---

## 3. User Stories

- Como usuário, quero ver todos os detalhes de uma transação em um lugar organizado, sem precisar entrar em modo de edição.
- Como membro de uma account colaborativa, quero saber quem criou ou editou uma transação e quando, para ter transparência sobre os dados.
- Como usuário, quero acessar o modo de edição a partir do painel de detalhes, como uma ação natural de continuidade.

---

## 4. Critérios de Aceitação

- QUANDO o usuário abre o menu ⋮ de uma transação, DEVE existir a opção "Ver detalhes".
- QUANDO "Ver detalhes" é clicado, UM DRAWER DEVE abrir ancorado à direita da tela sem recarregar a página.
- O drawer DEVE exibir os seguintes campos (quando preenchidos): Data, Descrição, Valor formatado, Seção/Tabela, Categoria, Subcategoria, Instituição, Responsável (avatar + nome), Notas, Parcela do cartão, Tipo de investimento.
- O drawer DEVE exibir, em seção separada "Histórico": Criado por (avatar + nome + data/hora), Última alteração por (avatar + nome + data/hora) — exibir apenas se houver alteração registrada.
- SE o campo `updatedById` for nulo, A SEÇÃO DE ÚLTIMA ALTERAÇÃO NÃO DEVE ser exibida.
- O drawer DEVE ter um botão "Editar" que o fecha e ativa o modo de edição inline na transação correspondente.
- O drawer DEVE ser fechável clicando fora dele, no ícone X, ou pressionando Esc.
- Em mobile, o drawer DEVE ocupar a tela inteira (bottom sheet ou full-screen drawer).

---

## 5. Fora de Escopo

- Histórico de todas as versões anteriores da transação (log completo de alterações) — intencionalmente fora de escopo para manter o banco enxuto.
- Edição de campos diretamente no drawer (o drawer é somente leitura; edição ocorre no inline da tabela).
- Comentários no drawer (tratado em spec separada, spec 30).
- Anexos no drawer (tratado em spec separada, spec 30).

---

## 6. Referências Técnicas

| Arquivo | Mudança |
|---------|---------|
| `src/components/transactions/TransactionRow.tsx` | Adicionar opção "Ver detalhes" no menu ⋮ |
| `src/components/transactions/TransactionDetailDrawer.tsx` | Novo componente |
| `src/components/transactions/TransactionTable.tsx` | Estado para controlar qual transação está com drawer aberto |
| `src/app/(app)/[accountId]/months/[monthId]/page.tsx` | Incluir `createdAt`, `updatedAt`, nome dos usuários criador/atualizador na query |

**Dados adicionais necessários na query da página do mês** (hoje não incluídos):
```ts
select: {
  // campos existentes...
  createdAt: true,
  updatedAt: true,
  // resolver nomes dos usuários via join ou map de membros já carregados
}
```

- Os nomes de `createdBy` e `updatedBy` podem ser resolvidos pelo `members` array já carregado na página, usando `createdById` e `updatedById` como chaves de lookup — sem query adicional.
- Usar MUI `Drawer` com `anchor="right"` para desktop e `anchor="bottom"` para mobile.
- O drawer é um Client Component recebendo os dados da transação como props; sem chamada adicional ao servidor para abrir.
