# Spec 35 — Análise de Gastos por Membro

> Status: draft
> Insumo: docs/wave-2.md §5 (Análise por membro) · revisão de código em `prisma/schema.prisma` (`Transaction.responsibleUserId`, `AccountMember`) e `src/lib/queries/dashboards.ts`
> Skills: [`money-handling`](../skills/money-handling/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`date-timezone`](../skills/date-timezone/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`design-system`](../skills/design-system/SKILL.md) · [`logging`](../skills/logging/SKILL.md) · [`testing`](../skills/testing/SKILL.md)

---

## 1. Problema

O MyAccountant é colaborativo (múltiplos membros por Account) e a transação já registra **quem é o responsável** (`Transaction.responsibleUserId`, schema linha 333). Esse dado, porém, só é consumido como **filtro de meta** no spec 25 — não existe nenhuma visualização que responda à pergunta central de uma conta compartilhada: *quem gastou o quê?*

- **MBR-01**: Em `src/lib/queries/dashboards.ts`, não há nenhuma query que **agregue despesas por `responsibleUserId`**. O dashboard mensal mostra distribuição por seção e por categoria, mas nunca por membro.
- **MBR-02**: Não há nenhum componente que mostre a **distribuição de gastos entre membros** no mês, nem um ranking de "quem mais gastou". Em uma conta de casal/família, não há como ver o equilíbrio (ou desequilíbrio) de gastos.
- **MBR-03**: Não há visão de **evolução por membro ao longo do tempo** — saber se o gasto de um membro vem subindo mês a mês exige inspecionar cada mês manualmente.
- **MBR-04**: Transações **sem responsável** (`responsibleUserId = null`) não têm tratamento de agrupamento definido para análise — hoje simplesmente não são contadas em lugar nenhum por membro.

---

## 2. Solução

Adicionar uma camada de **análise por membro** ao módulo de dashboards, reusando o `responsibleUserId` já existente. A análise entra como widgets nas áreas analíticas já existentes (sem página nova): um painel de **distribuição + ranking no contexto mensal** e um gráfico de **tendência por membro no contexto anual**.

A despesa por membro usa a mesma base de "despesa" do resto do app (seções `subtract`, `amountCents > 0`, `table.countInMonth = true`). Transações sem responsável são agrupadas em um bucket explícito **"Sem responsável"**.

### 2.1 Queries (MBR-01, MBR-04)

- `getMemberMonthlyBreakdown(accountId, monthId)`: despesa total por membro no mês + categoria de maior gasto de cada membro + share percentual. Inclui o bucket "Sem responsável" quando houver transações sem `responsibleUserId`.
- `getMemberYearlyTrend(accountId, year)`: série de despesa por membro por mês do ano (para multi-line).
- Ambas agregam com `groupBy` (sem N+1) e filtram por `accountId`.

### 2.2 Distribuição + ranking no mensal (MBR-02)

- Componente `MemberBreakdownChart`: gráfico (pizza/barras) da distribuição de despesa por membro no mês + lista-ranking ("quem mais gastou") com total, share % e categoria-top por membro.
- Entra como widget `member-breakdown` (kind `panel`) no contexto `monthly`.

### 2.3 Tendência por membro no anual (MBR-03)

- Componente `MemberTrendChart`: multi-line de despesa mensal por membro ao longo do ano.
- Entra como widget `member-trend` (kind `panel`) no contexto `yearly`.

### 2.4 Bucket "Sem responsável" (MBR-04)

- Transações com `responsibleUserId = null` formam um grupo próprio, rotulado "Sem responsável", presente tanto no breakdown mensal quanto na tendência anual.

---

## 3. User Stories

- Como membro de uma conta compartilhada, quero ver quanto cada pessoa gastou no mês, para entender o equilíbrio de gastos da família.
- Como usuário, quero um ranking de "quem mais gastou" no mês, para ter a leitura rápida sem ler gráfico.
- Como usuário, quero ver a evolução do gasto de cada membro ao longo do ano, para identificar tendências individuais.
- Como usuário, quero que transações sem responsável apareçam em um grupo claro, para não sumirem da análise.
- Como viewer, quero apenas visualizar essas análises, respeitando meu papel de leitura.

---

## 4. Critérios de Aceitação

### MBR-01 — Agregação por membro

- A query de breakdown DEVE agregar despesa por `responsibleUserId` usando `groupBy` (uma query, sem N+1) e filtrar por `accountId`.
- A despesa por membro DEVE considerar apenas transações em seções `countType = "subtract"`, com `amountCents > 0` e `table.countInMonth = true` (mesma base do spec 11 §7.2).
- Cada membro retornado DEVE conter: `userId` (ou `null`), nome de exibição, total em centavos (string), share percentual e a categoria de maior gasto.

### MBR-02 — Distribuição e ranking (mensal)

- QUANDO houver ao menos uma despesa com responsável no mês, O WIDGET `member-breakdown` DEVE renderizar a distribuição por membro (gráfico) e o ranking ordenado por total decrescente.
- O RANKING DEVE exibir, por membro: nome, total formatado, share % e a categoria-top.
- QUANDO não houver nenhuma despesa no mês, O WIDGET NÃO DEVE renderizar (guard padrão de widget sem dados).

### MBR-03 — Tendência (anual)

- O WIDGET `member-trend` DEVE renderizar uma linha por membro com a despesa mensal ao longo dos meses do ano **que possuem dados** (não os 12 fixos).
- QUANDO o ano não tiver nenhum mês com dados, O WIDGET NÃO DEVE renderizar.

### MBR-04 — Sem responsável

- QUANDO existirem transações de despesa com `responsibleUserId = null`, ELAS DEVEM ser agregadas em um grupo único rotulado "Sem responsável", presente no breakdown mensal e na tendência anual.
- O grupo "Sem responsável" DEVE participar do cálculo de share % como qualquer outro membro.

### Acesso e visual

- AS ANÁLISES DEVEM ser visíveis para `owner`, `editor` e `viewer` (read-only, igual ao restante de `/dashboards/*`).
- As cores das séries DEVEM vir de tokens/paleta de gráficos (`getChartColors(mode)` ou `theme.palette.*`), validadas em light **e** dark mode — nunca hardcoded.

---

## 5. Fora de Escopo

- **Página dedicada `/dashboards/people`** — a análise entra como widgets nas áreas existentes (mensal e anual); página própria fica para spec futura se necessário.
- **Metas por membro** — já cobertas pela dimensão "membro" do spec 25; aqui é apenas análise descritiva.
- **Análise por membro de receitas** (seções `add`) — apenas despesas nesta versão.
- **Drill-down de transações por membro** (drawer com a lista) — pode reusar o `DrillDownDrawer` em spec futura; fora do escopo aqui.
- **Comparação entre membros com variação percentual mês a mês** — apenas valores absolutos/share nesta versão.
- **Convidar/atribuir responsável em massa** — é fluxo de transações (specs 09/20), não de análise.

---

## 6. Decisões de Design

| Decisão | Escolha | Motivo |
|---|---|---|
| Onde exibir | Widgets nos contextos `monthly` e `yearly` do spec 33 | Reusa as áreas existentes; evita custo de página nova ("cheap + high value"). |
| Base de despesa | Seções `subtract`, `amountCents > 0`, `countInMonth = true` | Consistência total com spec 11 §7.2 e `calcSpent` do spec 25. |
| Sem responsável | Bucket explícito "Sem responsável" | Garante que nenhum gasto suma da análise (MBR-04). |
| Nome de exibição | `User.name` via join em `account_members`, fallback para email | `responsibleUserId` referencia `User`; o nome canônico vem do membro da account. |
| Cor por membro | Paleta de gráficos padrão (opcional: `UserSettings.accentColor`) | Mantém consistência; usar accent color do membro é melhoria futura, não requisito. |

> **Dependência do spec 33** (mesma situação do spec 34): o registry de widgets ainda é `draft`. Se o spec 33 for implementado antes, registrar `member-breakdown` (monthly) e `member-trend` (yearly) no `WIDGET_REGISTRY`. Se esta spec vier antes, renderizar os componentes diretamente no `MonthlyDashboardClient` e na página do dashboard anual, e o spec 33 deve adicioná-los ao catálogo ao ser implementado. O guard "sem dados → não renderiza" é preservado nos dois casos.

---

## 7. Referências Técnicas

| Item | Arquivo(s) a tocar / criar |
|---|---|
| MBR-01/04 | `src/lib/queries/member-analytics.ts` (`getMemberMonthlyBreakdown`, `getMemberYearlyTrend`) + `.test.ts` (multi-tenancy + bucket null) |
| MBR-02 | `src/components/dashboards/MemberBreakdownChart.tsx` (pizza/barras + ranking) |
| MBR-03 | `src/components/dashboards/MemberTrendChart.tsx` (multi-line) |
| Integração mensal | `src/components/dashboards/MonthlyDashboardClient.tsx` + `src/app/(app)/[accountId]/dashboards/monthly/[monthId]/page.tsx` |
| Integração anual | `src/app/(app)/[accountId]/dashboards/yearly/[year]/page.tsx` |
| Spec 33 | `src/components/dashboards/widget-registry.ts` (registrar `member-breakdown` em `monthly`, `member-trend` em `yearly`) |
| Mensagens | `src/lib/messages/pt-BR.ts` sob `dashboards.members.*` (rótulos, "Sem responsável", "Quem mais gastou") |

### 7.1 Query de breakdown mensal (groupBy, sem N+1)

```ts
// src/lib/queries/member-analytics.ts
export type MemberBreakdownRow = {
  userId: string | null;          // null = "Sem responsável"
  name: string;                   // resolvido via account_members; fallback email
  totalCents: string;             // BigInt serializado
  sharePercent: number;
  topCategoryName: string | null;
};

export async function getMemberMonthlyBreakdown(
  accountId: string,
  monthId: string,
): Promise<MemberBreakdownRow[]> {
  // 1 query: soma por responsável (inclui null como grupo)
  const rows = await prisma.transaction.groupBy({
    by: ["responsibleUserId"],
    where: {
      accountId,                                   // ✅ multi-tenancy
      monthId,
      amountCents: { gt: 0n },
      section: { countType: "subtract" },
      table: { countInMonth: true },
    },
    _sum: { amountCents: true },
  });
  // resolver nomes via account_members (1 query), montar share % e categoria-top.
  // responsibleUserId === null → rótulo m.dashboards.members.unassigned
  // ...
}

// ❌ Anti-padrão — uma query de agregação por membro (N+1) dentro de um map sobre os membros
```

### 7.2 Definição de despesa por membro

> Idêntica à base de despesa usada no app: `section.countType = "subtract"`, `amountCents > 0`, `table.countInMonth = true`. **Não** somar seções `add`/`neutral`/`ignore`. O share % de cada membro é `totalMembro / somaDeTodosOsMembros × 100`, incluindo o bucket "Sem responsável" no denominador.
