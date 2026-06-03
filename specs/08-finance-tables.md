# Spec 08 — Tabelas Financeiras

> Skills: [`server-actions`](../skills/server-actions/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md) · [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md) · [`money-handling`](../skills/money-handling/SKILL.md) · [`date-timezone`](../skills/date-timezone/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`design-system`](../skills/design-system/SKILL.md) · [`testing`](../skills/testing/SKILL.md)

## 1. Propósito

Define a **Finance Table**: estrutura que agrupa Transactions dentro de uma Section de um Mês. CRUD, source methods (empty, copy, import), e visualização.

## 2. Conceito

Uma **FinanceTable**:
- Pertence a um `(Month, Section)`.
- Contém N Transactions.
- Referencia um `TableType` via `tableTypeId`, que define o nome do tipo e as colunas visíveis.
- Pode ser criada vazia, copiada de outra tabela, ou importada de CSV/XLSX.
- Pode ter o flag `countInMonth=false` para excluí-la do cálculo do mês.

## 3. Visualização

### 3.1 Layout
```
┌──────────────────────────────────────────────────────────────────┐
│ ▼  Cartão Nubank                                                 │
│                                       Total: R$ 1.234,56         │
│                          [+ Nova transação] [⋮] [Colapsar ▼]     │
├──────────────────────────────────────────────────────────────────┤
│ Data       Descrição      Categoria   Inst.   Valor    Resp.    │
├──────────────────────────────────────────────────────────────────┤
│ 03/01      Supermercado   Alimentação Nubank  234,56   Maria    │
│ 05/01      Uber           Transporte  Nubank   25,00   João     │
│ ...                                                              │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 Header
- **Nome da tabela** (canto esquerdo)
- **Total** (calculado, atualiza ao vivo)
- **+ Nova transação** (adiciona linha vazia editável inline)
- **Ellipsis menu (⋮)**:
  - Editar nome
  - Alterar tipo de tabela (`tableTypeId`) — muda visibilidade de colunas
  - Toggle "Contar no mês" (`countInMonth`)
  - Duplicar tabela (cria cópia no mesmo mês ou outro)
  - Deletar tabela (com confirmação)
- **Colapsar/expandir** (▼/▶)

### 3.3 Estados
- **Colapsada**: mostra só header (nome + total).
- **Expandida**: mostra header + linhas.
- Estado persistido em cookie (`collapsedTables[]`) ou localStorage.

## 4. Criação

### 4.1 Modal de criação

**Trigger**:
- Botão no header do Mês (com section pré-vazia → usuário escolhe).
- Botão no header de uma Section (com section pré-selecionada).
- Botão central no estado vazio do Mês.

**Form**:
1. **Section** (select) — pode ser pré-selecionada.
2. **Nome da tabela** (string, 1-80 chars).
3. **Source method** (radio):
   - `empty` — tabela vazia
   - `copy` — copiar de outra tabela
   - `import` — importar de CSV/XLSX
4. **Campos condicionais** baseados no source method.

### 4.2 Source method: `empty`

Sem campos adicionais. Cria tabela vazia.

### 4.3 Source method: `copy`

Campos adicionais:
- **Tabela de origem** (select agrupado por Mês → Section → Tabela).
  - Exibe todas as tabelas da Account.
  - Ordenado por Mês DESC.
  - Mostra nome do mês + section + nome da tabela.
- **O que copiar**:
  - ☑ Estrutura apenas (cria tabela vazia, mantém só nome — checkbox = false por default).
  - ☑ Estrutura + transações (checkbox = true por default).
- **Override de transações** (se "incluir transações" = true):
  - ☑ Atualizar datas para o mês corrente (ex: 03/12 → 03/01 quando copiando dez/2025 → jan/2026). Default: true.
  - ☑ Marcar todas como pendentes (`isPending=true`). Default: false.

**Server Action**:
```ts
async function createFinanceTableFromCopy(input: CopyTableInput) {
  return prisma.$transaction(async (tx) => {
    const sourceTable = await tx.financeTable.findUnique({
      where: { id: input.sourceTableId },
      include: { transactions: true },
    });

    const newTable = await tx.financeTable.create({
      data: {
        accountId: input.accountId,
        monthId: input.monthId,
        sectionId: input.sectionId,
        name: input.name,
        tableTypeId: sourceTable.tableTypeId,
        sourceMethod: "copy",
        sourceTableId: sourceTable.id,
        // ...
      },
    });

    if (input.includeTransactions) {
      await tx.transaction.createMany({
        data: sourceTable.transactions.map(t => ({
          ...t,
          id: undefined, // novo id
          tableId: newTable.id,
          monthId: input.monthId,
          occurredOn: input.updateDates
            ? remapDateToMonth(t.occurredOn, newMonth)
            : t.occurredOn,
          isPending: input.markAsPending || t.isPending,
          createdById: input.userId,
          createdAt: undefined,
          updatedAt: undefined,
        })),
      });
    }

    return newTable;
  });
}
```

### 4.4 Source method: `import`

Ver `10-csv-xlsx-import.md`.

## 5. tableTypeId — Tipo de Tabela

Cada `FinanceTable` referencia um `TableType` da mesma Account via `tableTypeId`.

O `TableType` define:
- **Nome** exibido no header da tabela (ex: "Cartão de crédito")
- **Colunas visíveis** (`hiddenColumns` JSON)

**Tipos pré-criados ao criar a Account**:
| TableType | Colunas ocultas | Notas |
|---|---|---|
| Manual (padrão) | nenhuma | Default para novas tabelas |
| Cartão de crédito | `investmentType` | Para tabelas de cartão |
| Investimentos | `cardInstallment` | Para tabelas de investimento |

**Na criação da FinanceTable**:
- O select de "Tipo" lista os `TableType`s da Account
- O tipo padrão ("Manual") é pré-selecionado
- A escolha do tipo define automaticamente a visibilidade das colunas

**Override por tabela**:
Removido. A configuração de colunas agora fica exclusivamente no `TableType`. Para um comportamento diferente, o usuário cria um novo tipo customizado.

## 6. CRUD detalhado

### 6.1 Criar
Já descrito em §4.

### 6.2 Listar (em um Mês/Section)
```ts
async function listFinanceTables(accountId: string, monthId: string, sectionId?: string) {
  return prisma.financeTable.findMany({
    where: { accountId, monthId, ...(sectionId && { sectionId }) },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { transactions: true } } },
  });
}
```

### 6.3 Atualizar
- Renomear: simples update do `name`.
- Toggle `countInMonth`: simples update.
- Reordenação dentro de uma section: drag-and-drop atualiza `displayOrder`.

### 6.4 Deletar
- Cascade delete das transactions.
- Confirmação obrigatória (modal).
- Se a tabela tinha cópias (outras tabelas com `sourceTableId = thisId`): mantém as cópias, mas zera o `sourceTableId` delas (FK SET NULL).

### 6.5 Duplicar (atalho)
- Mesmo fluxo de `source method = copy` mas pré-preenchido.

## 7. Colunas visíveis por tabela

A visibilidade de colunas de uma `FinanceTable` é determinada exclusivamente pelo `TableType` referenciado via `tableTypeId`. Não há override por tabela individual.

**Como obter as colunas visíveis**:
```ts
function getHiddenColumns(tableType: TableType): Record<string, boolean> {
  return tableType.hiddenColumns as Record<string, boolean>;
}
```

Para customizar a visibilidade de uma tabela específica, o usuário deve alterar seu `tableTypeId` para um tipo com a configuração desejada, ou criar um novo `TableType` customizado em `/settings/table-types`.

## 8. Server Actions

```ts
// src/actions/finance-tables.ts

// data inclui: name, tableTypeId, sectionId, sourceMethod, etc.
export async function createFinanceTable(accountId, monthId, data);
// data pode incluir: name, tableTypeId, countInMonth
export async function updateFinanceTable(accountId, tableId, data);
export async function deleteFinanceTable(accountId, tableId);
export async function duplicateFinanceTable(accountId, tableId, targetMonthId);
export async function reorderFinanceTablesInSection(accountId, sectionId, monthId, orderedIds);
export async function getFinanceTableTotal(accountId, tableId);
```

## 9. Validação (Zod)

```ts
// src/lib/schemas/finance-table.ts

export const createFinanceTableSchema = z.object({
  monthId: z.string().cuid(),
  sectionId: z.string().cuid(),
  name: z.string().min(1).max(80).trim(),
  tableTypeId: z.string().cuid(),
  sourceMethod: z.enum(["empty", "copy", "import"]),
  countInMonth: z.boolean().default(true),
  // condicionais baseados em sourceMethod
  sourceTableId: z.string().cuid().optional(),
  copyOptions: z.object({
    includeTransactions: z.boolean().default(true),
    updateDates: z.boolean().default(true),
    markAsPending: z.boolean().default(false),
  }).optional(),
});
```

## 10. Performance

- **Total da tabela**: usar `prisma.transaction.aggregate` em vez de carregar todas as transactions.
- **Paginação de transações dentro da tabela**: virtual scrolling no client se > 200 linhas.
- **Listagem de tabelas de um mês**: incluir `_count: { transactions: true }` para badge sem N+1.

## 11. Edge cases

- **Source table deletada após cópia**: cópia continua existindo, `sourceTableId` vira NULL.
- **Copiar entre Sections diferentes**: permitido. A tabela copiada é "uma nova tabela" — `sectionId` da nova é o destino, não o da source.
- **Copiar para um Mês sem essa Section ativa**: impedido na UI (select de section só mostra active + inactive com tabelas naquele mês). Em server, validar.
- **Tabela com 0 transações**: válida, total = 0.
- **Tabela em Section inactive**: read-only.

## 12. Decisões em aberto

- [ ] Mover tabela entre Months/Sections? — **MVP: não**. Só duplicar.
- [ ] Tabela "template" salva globalmente na Account? — **v2**.
- [ ] Bulk operations em múltiplas tabelas (mover, deletar)? — **v2**.
- [ ] Histórico de versões da tabela? — **fora de escopo**.
