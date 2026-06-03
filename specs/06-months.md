# Spec 06 — Meses

> Skills: [`server-actions`](../skills/server-actions/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md) · [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md) · [`date-timezone`](../skills/date-timezone/SKILL.md) · [`money-handling`](../skills/money-handling/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`design-system`](../skills/design-system/SKILL.md) · [`testing`](../skills/testing/SKILL.md)

## 1. Propósito

Define como o conceito de **Mês** funciona: criação, navegação, exibição e regras de competência financeira (afetadas por `monthStartDay`).

## 2. Conceito

Um **Mês** representa uma competência financeira de uma Account. É a estrutura onde dados são inseridos. Cada Mês:
- Existe dentro de uma Account.
- É único por `(accountId, year, month)`.
- Contém N Finance Tables (uma por section, no máximo).
- Não pode ser duplicado.
- É criado vazio.

## 3. Estrutura visual

```
┌──────────────────────────────────────────────────────────────┐
│  [<] [Jan/2026 ▼] [>]            [+ Novo mês]                │  ← Header
├──────────────────────────────────────────────────────────────┤
│  [ Resumo ]  [ Entradas ]  [ Saídas ]  [ Cartão ]  [ Invest ]│  ← Tabs (Sections)
├──────────────────────────────────────────────────────────────┤
│                                                              │
│           (Conteúdo da Section selecionada)                  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 3.1 Header
- **Label do mês**: formato `MMM/YYYY` em pt-BR (ex: "Jan/2026").
- **Seletor**: dropdown com todos os meses criados, ordenados por data DESC.
- **Setas**: navegação para mês anterior/próximo (entre os criados, não no calendário).
- **Botão "+ Novo mês"**: abre modal de criação.

### 3.2 Tabs
- Primeira tab é **"Resumo"** (sempre presente).
- Demais tabs são as Sections **active** + Sections **inactive que têm tabelas neste mês** (modo read-only).
- Ordem das tabs segue `Section.order`.

### 3.3 Default ao abrir
- Sempre abre no **Mês mais recente criado**.
- Tab default é **Resumo**.
- Cookie `lastMonthId` para preservar entre sessões? — **MVP: não** (sempre o mais recente).

## 4. Fluxos

### 4.1 Criar Mês

**Trigger**: Botão "+ Novo mês" no header.

**Modal**:
- Primeira opção: **próximo mês após o último criado** (ex: se último é Dez/2025, sugere Jan/2026).
- Segunda opção: select de mês/ano específico.
- Validação: não pode duplicar `(year, month)`.

**Server Action**:
1. `requireAccountAccess(accountId)` com role editor+.
2. Validar não duplicado.
3. Criar `Month`.
4. **Não cria** Finance Tables automaticamente. Mês é criado vazio.
5. Redirecionar para o mês criado.

### 4.2 Navegar entre meses

**Comportamento**:
- Setas `[<] [>]` movem entre meses **existentes**, ordenados por `(year, month)`.
- Setas ficam desabilitadas nas pontas.
- Dropdown mostra todos os meses criados.

### 4.3 Deletar Mês

**Trigger**: Ellipsis menu no header → "Deletar mês".

**Regras**:
- Apenas owner.
- Confirmação por digitação ("digite o nome do mês para confirmar").
- Cascade delete: Finance Tables + Transactions.
- Após deletar, redireciona para o mês mais recente restante (ou tela vazia se for o último).

### 4.4 Duplicar Mês (atalho)

> Conforme spec original: "É permitido duplicar tabelas entre meses." Mas duplicar o **mês inteiro** seria um atalho útil.

**MVP: NÃO**. Usuário cria mês vazio + duplica tabelas individualmente (via source method `copy` em cada tabela).

> Avaliar em v2 se "duplicar mês" como atalho vale o esforço.

## 5. Tab "Resumo"

Conteúdo:
- **Card grande no topo**: Total do mês (calculado com base no `countType` de cada section).
- **Cards por Section**: nome + total da section + número de tabelas.
- **Lista de tabelas** agrupadas por section (read-only, click leva para a tab da section).

**Estado vazio**:
- Se o mês não tem tabelas: mostrar mensagem + botão "+ Adicionar Tabela Financeira" no **centro da tela**.
- Modal abre com select de section pré-vazio (usuário escolhe onde criar).

## 6. Cálculo do total do Mês

```
total_mes = soma de (soma_secao(s) * sign(s)) para todas sections s active onde s.section_count_type != ignore
```

Onde `sign(s)`:
- `add` → +1
- `subtract` → -1
- `neutral` → +1 (o sinal vem do valor da transação)
- `ignore` → 0 (não entra na soma)

**Soma da seção**:
- Inclui só Finance Tables com `countInMonth=true`.
- Inclui todas as Transactions da tabela (independente de `isPending`).

> A flag `isPending` é informativa, não afeta cálculos (decisão do MVP). Possível mudança futura: total separado "Realizado" vs "Pendente".

## 7. Relação com `monthStartDay`

> ⚠️ **Importante**: o conceito de "mês fiscal" vs "mês calendário".

Se `monthStartDay = 5`, o mês "Jan/2026" representa o período de **05/01/2026 a 04/02/2026**.

**Implicações**:
1. **Filtros de dashboards**: usar `monthStartDay` para definir o range.
2. **Criação automática de Mês**: ao sugerir "próximo mês", baseia em `(year, month)` e não no calendário do dia atual.
3. **Filtro de transações por mês**: ver `skills/date-timezone/SKILL.md`.

**Mês corrente** (para dashboard "este mês"):
- Se hoje é dia 03/02/2026 e `monthStartDay=5`, mês corrente é **Janeiro/2026** (ainda dentro do range 05/01 a 04/02).
- Se hoje é dia 10/02/2026, mês corrente é **Fevereiro/2026**.

## 8. UI components

```
src/components/months/
├── MonthHeader.tsx        — label + setas + dropdown + botão novo
├── MonthSelector.tsx      — dropdown
├── CreateMonthModal.tsx   — modal de criação
├── MonthTabs.tsx          — tabs de sections
├── MonthSummary.tsx       — tab Resumo
└── EmptyMonthState.tsx    — mensagem + botão central
```

## 9. Server Actions

```ts
// src/actions/months.ts

export async function createMonth(accountId: string, data: { year: number; month: number });
export async function deleteMonth(accountId: string, monthId: string);
export async function listMonths(accountId: string): Promise<Month[]>;
export async function getMonth(accountId: string, monthId: string);
// total do mês via query agregada
export async function getMonthSummary(accountId: string, monthId: string);
```

## 10. Edge cases

- **Criar mês muito antigo** (ex: 1990): permitir, sem restrição. Validação só de range plausível (year 2000-2400).
- **Criar mês muito futuro** (ex: 2100): permitir.
- **Section criada após o mês**: o mês passa a mostrar a section automaticamente (sem migration de dados, é só a UI iterando sobre `account.sections`).
- **Section deletada após o mês ter tabelas**: tabelas órfãs são impossíveis (FK `restrict` em Section). Caminho é desativar a section.

## 11. Decisões em aberto

- [ ] Limite máximo de meses por Account? — **MVP: não**.
- [ ] Arquivar meses antigos (ocultar do dropdown mas manter)? — **v2**.
- [ ] Suporte a meses parciais (criar metade de Janeiro)? — **Não, fora do escopo**.
