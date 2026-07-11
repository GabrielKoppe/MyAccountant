# Spec 18 — Bug Fixes V2

> Status: implemented (BUG-01/02/03 corrigidos durante v2; BUG-04 resolvido via spec 62 — notes na gaveta de anexos `TransactionRowDetails`, não como tooltip isolado)
> Insumo: docs/v2-analysis.md §2 (BUG-01, BUG-02, BUG-03, BUG-04)
> Skills: [`money-handling`](../skills/money-handling/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`design-system`](../skills/design-system/SKILL.md) · [`testing`](../skills/testing/SKILL.md)

---

## 1. Problema

Quatro bugs identificados na revisão do V1 que afetam diretamente a confiabilidade dos dados e a experiência de uso cotidiano:

- **BUG-01**: Ao duplicar uma transação, ela sempre aparece no topo da tabela em vez de logo abaixo do original. Em `TransactionTable.tsx:78`, a função `onDuplicated` tenta encontrar a linha original com `prev.findIndex((r) => r.id === newTx.id.replace(/-copy$/, ""))`. Porém `newTx.id` é um UUID real retornado pelo servidor (`result.data.transactionId`), nunca termina em `-copy`, então `idx` é sempre `-1` e `splice(0, 0, newTx)` insere no topo.
- **BUG-02**: A query de transações em `months/[monthId]/page.tsx:63` tem `take: 300`. Meses com mais de 300 transações têm as mais antigas silenciosamente omitidas. Os totais de seção exibidos no resumo do mês ficam incorretos e não há nenhum aviso ao usuário.
- **BUG-03**: `getSectionTotals` em `month-service.ts:81–96` dispara uma query `aggregate` separada por seção via `Promise.all` (N+1). Com 5 seções, são 5 queries por carregamento da página. A função `batchSectionTotals` em `lib/queries/dashboards.ts:51–76` já resolve isso com um único `groupBy` — a solução existe mas não foi aplicada no serviço de meses.
- **BUG-04**: O campo `notes` existe no schema (`baseTransactionSchema`, `updateTransactionSchema`) e é carregado na página (`page.tsx:71`), mas **nunca é exibido nem editável na UI**: (a) no modo de leitura de `TransactionRow` não há indicador visual; (b) no modo de edição não há campo de input para `notes`; (c) `saveEdit()` em `TransactionRow.tsx:91–103` não inclui `notes` no payload enviado para `updateTransactionAction`.

---

## 2. Solução

Correções pontuais e cirúrgicas, sem alterar a estrutura ou contratos existentes:

- **BUG-01**: Alterar a assinatura de `onDuplicated` para `(newTx: TxRow, sourceId: string) => void`. Em `TransactionRow.handleDuplicate`, passar `tx.id` como `sourceId`. Em `TransactionTable.onDuplicated`, usar `sourceId` no `findIndex` em vez de `newTx.id.replace(/-copy$/, "")`.
- **BUG-02**: Remover `take: 300` da query `prisma.transaction.findMany` em `months/[monthId]/page.tsx`.
- **BUG-03**: Substituir o `Promise.all` de queries individuais em `getSectionTotals` por um único `prisma.transaction.groupBy({ by: ["sectionId"], where: { accountId, monthId, sectionId: { in: sectionIds }, table: { countInMonth: true } }, _sum: { amountCents: true } })`, retornando o mesmo `Record<string, bigint>` já esperado pelo chamador.
- **BUG-04**: (a) Adicionar campo `notes` no modo de edição de `TransactionRow` (textarea abaixo dos campos existentes). (b) Incluir `notes` no payload de `saveEdit()`. (c) Exibir ícone `NoteOutlined` na célula de ações do modo de leitura quando `tx.notes` não for nulo/vazio, com Tooltip mostrando o conteúdo.

---

## 3. User Stories

- Como usuário, quero que a transação duplicada apareça logo abaixo da original, para manter o contexto visual do que estou fazendo.
- Como usuário, quero ver todas as minhas transações do mês, mesmo que sejam mais de 300, para que os totais exibidos sejam sempre corretos.
- Como usuário, quero que a página do mês carregue com a menor latência possível.
- Como usuário, quero ver as notas de uma transação sem precisar entrar em modo de edição.
- Como usuário, quero poder editar as notas de uma transação diretamente na linha da tabela.

---

## 4. Critérios de Aceitação

- QUANDO uma transação é duplicada, A NOVA transação DEVE aparecer imediatamente abaixo da transação original na lista.
- ENQUANTO um mês tem mais de 300 transações, O SISTEMA DEVE exibir todas elas sem omissões silenciosas.
- QUANDO a página do mês carrega, O SISTEMA DEVE calcular os totais de seção com uma única query ao banco (`groupBy`), independentemente do número de seções.
- QUANDO uma transação possui o campo `notes` preenchido, O SISTEMA DEVE exibir um ícone de nota no modo de leitura que revele o conteúdo via Tooltip.
- SE uma transação não possui notas, O SISTEMA NÃO DEVE exibir o ícone de notas.
- QUANDO uma transação entra em modo de edição, O CAMPO `notes` DEVE estar visível e editável como `TextField multiline` com placeholder indicando que suporta Markdown.
- QUANDO o usuário salva uma edição com alteração no campo `notes`, A ALTERAÇÃO DEVE ser persistida no banco.
- O CONTEÚDO do campo `notes` é texto livre com suporte a sintaxe Markdown, mas NESTA SPEC é exibido como texto puro (sem renderização). A renderização com `react-markdown` fica para spec futura (ver §5).

---

## 5. Fora de Escopo

- Paginação de transações (o usuário explicitamente não quer paginação).
- Virtualização de listas (pode ser considerada em spec separada de performance se necessário).
- Renderização de Markdown no campo `notes` (tooltip e modo de leitura exibem texto puro por ora) — será coberto em spec futura de "Transaction Notes — Markdown Viewer".
- Qualquer outra nova feature de notas (busca por nota, notas anexadas, etc.).
- Alteração na estrutura do campo `notes` no schema Prisma ou Zod.
- Qualquer alteração nos dashboards (que já usam `batchSectionTotals` corretamente).

---

## 6. Referências Técnicas

| Item | Arquivo(s) a tocar | Localização exata |
|------|-------------------|-------------------|
| BUG-01 | `src/components/transactions/TransactionTable.tsx` | `onDuplicated` (linha 76–83) |
| BUG-01 | `src/components/transactions/TransactionRow.tsx` | assinatura da prop `onDuplicated` (linha 44) e `handleDuplicate` (linha 149) |
| BUG-02 | `src/app/(app)/[accountId]/months/[monthId]/page.tsx` | `take: 300` (linha 63) |
| BUG-03 | `src/server/services/month-service.ts` | `getSectionTotals` (linhas 74–97) |
| BUG-04 | `src/components/transactions/TransactionRow.tsx` | modo de edição (linhas 157–317) e modo de leitura (linhas 394–403) |

### BUG-03 — Implementação de referência

O padrão a copiar é `batchSectionTotals` em `src/lib/queries/dashboards.ts:51–76`. A versão de `getSectionTotals` para um único mês fica:

```typescript
const rows = await prisma.transaction.groupBy({
  by: ["sectionId"],
  where: {
    accountId,
    monthId,
    sectionId: { in: sectionIds },
    table: { countInMonth: true },
  },
  _sum: { amountCents: true },
});
return Object.fromEntries(rows.map((r) => [r.sectionId, r._sum.amountCents ?? 0n]));
```

A assinatura e o tipo de retorno de `getSectionTotals` não mudam — os chamadores existentes (`page.tsx`) não precisam de ajuste.

### BUG-04 — Posicionamento do campo `notes` no modo de edição

O campo deve ser renderizado como `TextField multiline` após a célula de Tipo de Investimento, na mesma `TableRow` de edição. A célula deve ter `colSpan` abrangendo todas as colunas visíveis, ou alternativamente ser adicionado como uma segunda linha de edição (`TableRow` adicional com `colSpan` total) imediatamente abaixo para não comprimir as colunas existentes.

Seguir convenção de idioma das mensagens: string `"Notas"` / `"Adicionar nota..."` via `src/lib/messages/pt-BR.ts`.
