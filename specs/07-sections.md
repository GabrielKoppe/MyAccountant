# Spec 07 — Sections (comportamento)

> Skills: [`server-actions`](../skills/server-actions/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`logging`](../skills/logging/SKILL.md)

## 1. Propósito

Define como Sections se comportam dentro dos Meses, incluindo regras de visibilidade, contagem e ativação/desativação.

> Configuração de Sections (CRUD) está em `05-account-settings.md`. Aqui o foco é **runtime**.

## 2. Conceito

Uma **Section** é uma "aba" dentro de cada Mês. Ela:
- É configurada na Account (não no Mês).
- Aparece em todos os Meses automaticamente.
- Define um `countType` que afeta o cálculo do total do Mês.
- Pode ter N Finance Tables dentro dela em cada Mês.
- Pode ser ativada/desativada sem perder dados históricos.

## 3. Visualização dentro do Mês

Cada Section vira uma **tab** na navegação do Mês (junto com a tab "Resumo").

### 3.1 Conteúdo da tab
```
┌──────────────────────────────────────────────────────────────┐
│  Section: Cartão                          Total: R$ 1.234,56 │
│                                          [+ Adicionar tabela]│
├──────────────────────────────────────────────────────────────┤
│  ▼ Cartão Nubank                                 R$ 567,89  │
│  (Tabela com transações)                                    │
├──────────────────────────────────────────────────────────────┤
│  ▼ Cartão Itaú                                   R$ 666,67  │
│  (Tabela com transações)                                    │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 Header da tab
- Nome da Section.
- Total da section (calculado por todas as tabelas filhas com `countInMonth=true`).
- Botão "+ Adicionar tabela" no canto superior direito (abre modal de criação de FinanceTable com a section pré-selecionada).

### 3.3 Estado vazio
- Se a section não tem tabelas no mês: ainda mostra header + botão "+ Adicionar tabela".
- Mensagem central: "Nenhuma tabela nesta seção. Crie uma para começar."

## 4. Count Types (cálculo do total)

Já mencionado em `06-months.md` §6. Recapitulando com exemplos:

### 4.1 `add`
Soma os valores ao total do Mês, **independente do sinal**.

> Exemplo: Section "Entradas" com transação de `+R$ 5.000` (salário) e `-R$ 200` (estorno).
> Soma da section: `5000 - 200 = 4800`.
> Contribuição ao mês: `+4800`.

### 4.2 `subtract`
Subtrai os valores do total do Mês, **independente do sinal**.

> Exemplo: Section "Cartão" com transações `+R$ 800` (despesa) e `+R$ 100` (despesa).
> Soma da section: `800 + 100 = 900`.
> Contribuição ao mês: `-900`.

> ⚠️ Convenção: em sections `subtract`, valores positivos representam gastos. Isso é contraintuitivo mas evita usuário ter que digitar sinal de menos em despesas. Documentar no onboarding.

### 4.3 `ignore`
Mostra a section e suas tabelas, mas **não soma** ao total do mês.

> Útil para: "Reserva de emergência", "Movimentações entre contas", etc. — coisas que registramos mas não afetam o resultado mensal.

### 4.4 `neutral`
Soma os valores **com o sinal cadastrado**.

> Útil para: "Investimentos" onde aportes são positivos (saída do caixa) e resgates são negativos (entrada).
> Exemplo: aporte de `+R$ 1.000` e resgate de `-R$ 500`. Soma: `+500`. Contribuição ao mês: `+500` (que conceitualmente significa "fluxo líquido para investimentos no mês").

## 5. Section Active vs Inactive

### 5.1 Section Active
- Aparece em todos os Meses (criados e futuros) como tab.
- Pode-se criar novas Finance Tables nela.
- Total computa normalmente.

### 5.2 Section Inactive
Comportamento por Mês:

**Caso A** — Mês NÃO tem tabelas nessa Section:
- A tab **não aparece** no Mês.
- Como se a section não existisse para esse mês.

**Caso B** — Mês JÁ tem tabelas nessa Section:
- A tab **aparece** (com badge "inativa" ou estilo diferente).
- Modo **somente leitura**: não pode criar/editar/deletar tabelas nem transações.
- Total **ainda é computado** (afeta o total do mês).

> Racional: permitir "aposentar" uma section sem corromper dados antigos.

### 5.3 Reativar
- Ao reativar, volta ao comportamento normal em todos os meses (passa a aparecer mesmo onde não tem tabelas).

## 6. Section como descrita em Transaction

O campo `Transaction.sectionId` é **desnormalizado** (vem de `Transaction.table.section`). Isso facilita:
- Queries de agregação por section sem join.
- Dashboard "totais por section".

**Consistência**:
- Ao criar/mover uma transação, `sectionId` é populado a partir do `tableId`.
- Ao mudar uma `FinanceTable.sectionId` (futuro: mover tabela entre sections), `sectionId` de todas as transações filhas precisa ser atualizado em transação SQL.

> MVP: não permitir mover tabela entre sections. Simplifica.

## 7. Ordenação

- `Section.order` define a ordem das tabs (asc).
- Reordenação via drag-and-drop em `/settings/sections`.
- Tab "Resumo" sempre primeira (não vem da config).

## 8. Server-side considerations

### 8.1 Listagem ao abrir um Mês

```ts
async function getMonthSections(accountId: string, monthId: string) {
  // 1. Sections active da Account
  const activeSections = await prisma.section.findMany({
    where: { accountId, isActive: true },
    orderBy: { order: "asc" },
  });

  // 2. Sections inactive que têm tabelas neste mês
  const inactiveWithTables = await prisma.section.findMany({
    where: {
      accountId,
      isActive: false,
      financeTables: { some: { monthId } },
    },
    orderBy: { order: "asc" },
  });

  // 3. Merge (active primeiro, depois inactive)
  return [...activeSections, ...inactiveWithTables];
}
```

### 8.2 Total da Section em um Mês

```ts
async function getSectionTotal(accountId: string, monthId: string, sectionId: string) {
  const result = await prisma.transaction.aggregate({
    where: {
      accountId,
      monthId,
      sectionId,
      table: { countInMonth: true },
    },
    _sum: { amountCents: true },
  });
  return result._sum.amountCents ?? 0n;
}
```

## 9. Edge cases

- **Section deletada por mistake** (em vez de desativada): impossível se há FinanceTables (FK restrict). UI deve direcionar para desativar.
- **Transação com `sectionId` mas tabela mudou de section**: não pode acontecer no MVP (não permitimos mover tabela entre sections).
- **Section com `countType` mudado**: total do mês recalcula em real-time (não há denormalização do total).

## 10. Decisões em aberto

- [ ] Mover FinanceTable entre Sections? — **MVP: não**, complica consistência de `sectionId` em Transaction.
- [ ] Section com hierarquia (sub-sections)? — **Não**, fora do escopo.
- [ ] Section com filtros automáticos (ex: section "Mercado" só de transações com category=Alimentação)? — **v2, viewModel**.
