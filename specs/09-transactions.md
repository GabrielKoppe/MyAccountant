# Spec 09 — Transactions

> Skills: [`server-actions`](../skills/server-actions/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md) · [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md) · [`money-handling`](../skills/money-handling/SKILL.md) · [`date-timezone`](../skills/date-timezone/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`design-system`](../skills/design-system/SKILL.md) · [`logging`](../skills/logging/SKILL.md) · [`testing`](../skills/testing/SKILL.md)

## 1. Propósito

Define o CRUD de **Transaction**: a menor unidade de dado financeiro. Inclui todos os campos, validações, e operações de bulk.

> Schema e relacionamentos completos em `01-domain-model.md` §3.8.

## 2. Visualização

Transactions são **linhas** dentro de uma FinanceTable. Visualizadas como tabela tradicional, edição **inline**.

### 2.1 Colunas (default)
```
[ ][ Data    ][ Descrição    ][ Categoria   ][ Sub. ][ Inst. ][ Valor   ][ Resp. ][ ⚐ ][ ⋮ ]
```

- `[ ]` — checkbox para bulk select
- `Data` — `occurredOn` (formato DD/MM ou DD/MM/YY se for de outro ano)
- `Descrição` — `description`
- `Categoria` — `category.name` (clicável para mudar)
- `Sub.` — `subcategory.name` (depende de category)
- `Inst.` — `institution.name` ou `institutionText`
- `Valor` — formatado com sinal e cor (verde positivo, vermelho negativo, neutro = cinza)
- `Resp.` — avatar do `responsibleUser`
- `⚐` — toggle `isFavorite`
- `⋮` — menu de ações (editar, duplicar, deletar)

### 2.2 Estados visuais por linha
- `isPending=true` → linha com opacidade reduzida + ícone de relógio.
- `isFavorite=true` → estrela preenchida.

## 3. CRUD

### 3.1 Criar
**Via UI**:
- Click em "+ Nova transação" no header da tabela.
- Aparece uma **nova linha em branco** no topo da tabela, em modo de edição inline.
- Tab navega entre os campos.
- Enter salva, Esc cancela.
- Salvamento automático ao sair do foco (blur) ou Enter.

**Campos obrigatórios**:
- `occurredOn` (default: hoje)
- `amountCents` (default: 0)

**Campos opcionais**: todos os outros.

**Defaults inteligentes**:
- `description`: vazio
- `categoryId`: última categoria usada **nessa tabela** (cache em estado client) ou null
- `responsibleUserId`: `AccountSettings.defaultResponsibleUserId` ou usuário corrente
- `isPending`: false
- `isFavorite`: false

### 3.2 Editar
- Click em qualquer célula entra em edição inline.
- Salva ao sair do foco (debounce 300ms).
- Mudanças em `categoryId` resetam `subcategoryId` se a sub não pertencer à nova category.

### 3.3 Duplicar
**Trigger**: menu `⋮` → "Duplicar".

**Comportamento**:
- Cria nova transação com **todos os campos copiados** exceto `id`, `createdAt`.
- `occurredOn` permanece (mesma data — usuário pode mudar depois).
- `createdById` = usuário corrente (não copia o original).
- Nova linha aparece logo abaixo da original.

### 3.4 Deletar
- Click em `⋮` → "Deletar".
- Sem modal (operação reversível em sessão? — **MVP: sem undo**, mas com toast "Transação deletada"; se reverter for útil, adicionar depois).
- Hard delete.

### 3.5 Bulk operations

**Trigger**: selecionar 1+ checkboxes → barra de ações no topo.

Ações disponíveis:
- **Deletar selecionadas** (com confirmação se > 5 itens).
- **Marcar como pendente** (toggle on/off).
- **Marcar como favorita** (toggle).
- **Atribuir categoria** (select).
- **Mover para outra tabela** → abre `MoveTransactionsDialog` (ver §3.6).

### 3.6 Mover transações (bulk)

**Trigger**: barra de bulk → botão "Mover para tabela".

**Regras**:
- Pode mover para qualquer tabela de qualquer mês/seção da mesma Account.
- Pode criar uma nova FinanceTable como destino (inline no dialog).
- **Não** pode criar uma nova Section nem um novo Month — ambos devem preexistir.
- Não pode mover para a própria tabela de origem (validação no client).
- `occurredOn` das transações **não muda** — preserva a data original do lançamento.
- Todos os outros campos (categoria, valor, notas, etc.) são preservados.

**Dialog (`MoveTransactionsDialog`)**:

```
┌─ Mover 3 transação(ões) ──────────────────────────────────┐
│                                                            │
│  Mês destino    [ Maio/2026      ▼ ]  ← meses existentes  │
│                                                            │
│  Seção destino  [ Cartão         ▼ ]  ← seções da account  │
│                                                            │
│  Tabela destino [ Nubank         ▼ ]  ← tabelas do mês×seção │
│                 └── (+ opção "+ Criar nova tabela" no select) │
│                                                            │
│  ┌ visível só quando "Criar nova tabela" selecionado ───┐  │
│  │  Nome:  [_________________________________]          │  │
│  │  Tipo:  [ Manual                         ▼ ]        │  │
│  │  ☑ Contar no total do mês                           │  │
│  └───────────────────────────────────────────────────── ┘  │
│                                                            │
│  [Cancelar]                    [Mover transações →]       │
└────────────────────────────────────────────────────────────┘
```

**Comportamento dos selects em cascata**:
1. Mês → Section → Table (filtradas por mês+seção selecionados).
2. Mudar o Mês reseta a seleção de Tabela (mas mantém a Seção se ela existir nesse mês).
3. Se não há tabelas no Mês × Seção escolhidos: a opção "+ Criar nova tabela" aparece automaticamente.
4. Confirmar cria a tabela (se necessário) e move as transações atomicamente no server.

**Após mover com sucesso**:
- As transações somem da tabela de origem (atualização otimista local).
- `revalidatePath` invalida o mês de origem **e** o mês de destino (se forem diferentes).
- Um snackbar confirma: "3 transações movidas para [Nome da Tabela]".

**Schema**:
```ts
moveTransactionsSchema = z.object({
  ids: z.array(z.string().cuid()).min(1),
  sourceMonthId: z.string().cuid(),   // para revalidar o mês de origem
  destination: z.discriminatedUnion("type", [
    // Mover para tabela existente
    z.object({ type: z.literal("existing"), tableId: z.string().cuid() }),
    // Criar nova tabela e mover para ela
    z.object({
      type: z.literal("new"),
      monthId: z.string().cuid(),
      sectionId: z.string().cuid(),
      tableTypeId: z.string().cuid(),
      name: z.string().min(1).max(80).trim(),
      countInMonth: z.boolean(),
    }),
  ]),
})
```

**Action de leitura para popular o dialog (`listTablesForMoveAction`)**:
```ts
// Retorna numa única query todos os dados necessários para o dialog
{
  months: { id, year, month }[],           // todos os meses da account
  sections: { id, name }[],               // todas as seções da account
  tables: { id, name, monthId, sectionId }[], // todas as tabelas
  tableTypes: { id, name, isDefault }[],  // para criar nova tabela
}
```

## 4. Campos detalhados

### 4.1 `occurredOn`
- Tipo: `Date` (date-only, sem timezone).
- UI: date picker.
- Default: hoje (no timezone do user).
- **Não há validação de "está no mês"** — uma transação pode ter `occurredOn` de outro mês fora do `Month` em que está. Isso é intencional (ex: lançamento atrasado).
- Ver `skills/date-timezone/SKILL.md` para conversão.

### 4.2 `amountCents`
- Tipo: `BigInt`.
- UI: input com máscara monetária ("R$ 1.234,56").
- Negativo permitido (importante em sections `add` e `neutral`).
- Validação Zod: `z.coerce.bigint()` (do form string mascarado).
- Display: cor verde positivo, vermelho negativo, cinza zero.

### 4.3 `description`
- Tipo: `String?`, max 200 chars.
- UI: input text.

### 4.4 `categoryId` + `subcategoryId`
- Select hierárquico com search.
- Mudar `categoryId` reseta `subcategoryId`.
- Validação: `subcategoryId` (se preenchido) deve ter `category.id === categoryId`.

### 4.5 `institutionId` + `institutionText`
- Combobox: usuário pode escolher de cadastros existentes ou digitar livre.
- Se escolher cadastro → `institutionId` preenchido, `institutionText` ignorado.
- Se digitar livre → `institutionText` preenchido, `institutionId` null.
- **UI** sempre exibe o valor efetivo (cadastro tem prioridade).

### 4.6 `responsibleUserId`
- Select de membros da Account.
- Default: `AccountSettings.defaultResponsibleUserId` ou user corrente.
- Display: avatar pequeno.

### 4.7 `isPending`
- Boolean.
- UI: checkbox ou toggle.
- Indica que a transação está agendada/prevista, mas pode mudar.
- **Não afeta cálculos** no MVP.

### 4.8 `isFavorite`
- Boolean.
- UI: ícone de estrela na linha.
- Filtro disponível: "só favoritas".

### 4.9 `cardInstallment` (só se `tableType=card`)
- String formato `"X/Y"` (ex: `"3/12"`).
- Validação Zod: regex `/^\d+\/\d+$/`.
- UI: input pequeno com placeholder "3/12".

### 4.10 `investmentType` (só se `tableType=investment`)
- String livre (no MVP).
- Valores comuns: "CDB", "Tesouro", "Ações", "FII", "Cripto", "Fundos".
- **v2**: enum ou cadastro próprio.

### 4.11 `notes`
- Text longo (multiline).
- UI: oculto por default, click em ícone na linha abre popover.

### 4.12 `metadata`
- JSON arbitrário.
- Não exposto na UI default.
- Usado por features futuras (ex: dados de import original).

## 5. Validação (Zod)

```ts
// src/lib/schemas/transaction.ts

export const baseTransactionSchema = z.object({
  occurredOn: z.coerce.date(),
  amountCents: z.coerce.bigint(),
  description: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  isPending: z.boolean().default(false),
  isFavorite: z.boolean().default(false),
  categoryId: z.string().cuid().nullable().optional(),
  subcategoryId: z.string().cuid().nullable().optional(),
  institutionId: z.string().cuid().nullable().optional(),
  institutionText: z.string().max(80).optional(),
  responsibleUserId: z.string().cuid().nullable().optional(),
  cardInstallment: z.string().regex(/^\d+\/\d+$/).optional(),
  investmentType: z.string().max(40).optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const createTransactionSchema = baseTransactionSchema.extend({
  tableId: z.string().cuid(),
});

// Validação cruzada: subcategory pertence à category
export const transactionWithCategoryCheck = createTransactionSchema.refine(
  async (data) => {
    if (!data.subcategoryId) return true;
    const sub = await prisma.subcategory.findUnique({
      where: { id: data.subcategoryId },
    });
    return sub?.categoryId === data.categoryId;
  },
  { message: "Subcategoria não pertence à categoria selecionada" }
);
```

> **Atenção**: validações que tocam o DB (`refine` async com query) só rodam no server. No client, validar só forma + presença.

## 6. Server Actions

```ts
// src/actions/transactions.ts

export async function createTransaction(accountId, data);
export async function updateTransaction(accountId, transactionId, data);
export async function deleteTransaction(accountId, transactionId);
export async function duplicateTransaction(accountId, transactionId);

// Bulk
export async function bulkUpdateTransactions(accountId, ids, patch);
export async function bulkDeleteTransactions(accountId, ids);
export async function moveTransactions(accountId, ids, targetTableId);
```

Toda Server Action:
1. `requireAccountAccess(accountId)` com role editor+.
2. Validar Zod.
3. **Validar que `tableId`/`transactionId` pertencem ao `accountId`** (evita IDOR).
4. **Popular `sectionId` automaticamente** a partir do `tableId` (desnormalização).
5. `revalidatePath` apropriado.

## 7. Filtros e busca

**Dentro da FinanceTable** (UI top da tabela):
- Search por descrição (case insensitive, contains).
- Filtro por categoria.
- Filtro por instituição.
- Filtro por status (pendente / favorita).
- Filtro por range de datas.

**Implementação MVP**: client-side filtering (transactions já estão carregadas).

> Se tabela tiver > 500 transações, mover para server-side. Improvável no MVP.

## 8. Importação como criação em massa

Detalhado em `10-csv-xlsx-import.md`. Resumo:
- Mesmo Zod schema, validado linha a linha.
- Erros agregados, retorno com {ok: [...], errors: [...]}.
- User confirma antes de salvar.

## 9. Performance

- **Carregamento inicial**: limit 200 por tabela. Botão "carregar mais" se exceder.
- **Edição inline com auto-save**: debounce 300ms + indicador visual ("salvando..." / "salvo").
- **Bulk updates**: usar `prisma.$transaction` para atomicidade.
- **Mutations otimistas no client** com rollback em erro (TanStack Query opcional).

## 10. Edge cases

- **Transação com data fora do mês da tabela**: permitido. Aparece naquela tabela mas pode confundir em dashboards. **Aviso na UI quando salvar.**
- **Excluir categoria que está em uso**: `categoryId` vira null. Linha continua válida.
- **Mudança de responsible para usuário não mais membro**: validar antes. Se mudou após save: na próxima atualização, validar.
- **Valor zero**: permitido (útil para "memo" ou placeholders).
- **Descrição vazia**: permitida.

## 11. Decisões em aberto

- [ ] Recorrência de transações (criar 12 transações iguais com 1 click)? — **v2**.
- [ ] Tags livres em transações? — **v2**.
- [ ] Anexar comprovante (imagem/PDF)? — **v2**, fora do MVP (storage).
- [ ] Histórico de mudanças por transação? — **v3**.
- [ ] Undo após delete? — **v2**.
