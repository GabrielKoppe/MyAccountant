# Spec 35 — Análise de Gastos por Membro

> Status: approved
> Insumo: docs/wave-2.md §5 (Análise por membro) · revisão de código em `prisma/schema.prisma` (`Transaction.responsibleUserId`, `AccountMember`, `User`) e `src/lib/queries/dashboards.ts` · entrevista de refinamento de produto (decisões registradas na §6)
> Skills: [`money-handling`](../skills/money-handling/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`date-timezone`](../skills/date-timezone/SKILL.md) · [`dashboard-widgets`](../skills/dashboard-widgets/SKILL.md) · [`dashboards-charts`](../skills/dashboards-charts/SKILL.md) · [`rsc-client-boundary`](../skills/rsc-client-boundary/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`design-system`](../skills/design-system/SKILL.md) · [`logging`](../skills/logging/SKILL.md) · [`testing`](../skills/testing/SKILL.md)

---

## 1. Problema

O MyAccountant é colaborativo (múltiplos membros por Account) e a transação já registra **quem é o responsável** (`Transaction.responsibleUserId`, schema linha 338). Esse dado, porém, só é consumido como **filtro de meta** no spec 25 — não existe nenhuma visualização que responda à pergunta central de uma conta compartilhada: *quem gastou o quê?*

- **MBR-01**: Em `src/lib/queries/dashboards.ts`, não há nenhuma query que **agregue despesas por `responsibleUserId`**. O dashboard mensal mostra distribuição por seção e por categoria, mas nunca por membro.
- **MBR-02**: Não há nenhum componente que mostre a **distribuição de gastos entre membros** no mês, nem um ranking de "quem mais gastou". Em uma conta de casal/família, não há como ver o equilíbrio (ou desequilíbrio) de gastos.
- **MBR-03**: Não há visão de **evolução por membro ao longo do tempo** — saber se o gasto de um membro vem subindo mês a mês exige inspecionar cada mês manualmente.
- **MBR-04**: Transações **sem responsável** (`responsibleUserId = null`) não têm tratamento de agrupamento definido para análise — hoje simplesmente não são contadas em lugar nenhum por membro.
- **MBR-05**: `Transaction.responsibleUserId` tem `onDelete: SetNull` e referencia `User` (schema linha 354), **não** `AccountMember`. Logo existe o caso real de uma despesa cujo responsável **já saiu da Account** (o `AccountMember` foi removido, mas a transação continua apontando para um `User` existente). Essa despesa tem `responsibleUserId != null` — não é "Sem responsável" — mas o nome não resolve por um simples join em `account_members`.

---

## 2. Solução

Adicionar uma camada de **análise por membro** ao módulo de dashboards, reusando o `responsibleUserId` já existente. A análise entra como **widgets** (sistema do spec 33, já `approved`): um painel de **distribuição + ranking no contexto `monthly`** e um gráfico de **tendência por membro no contexto `yearly`**. Sem página nova.

A despesa por membro usa a mesma base de "despesa" do resto do app (seções `subtract`, `amountCents > 0`, `table.countInMonth = true`). Transações sem responsável são agrupadas em um bucket explícito **"Sem responsável"**; responsáveis que não são mais membros aparecem como linha própria marcada **"(ex-membro)"**.

### 2.1 Queries (MBR-01, MBR-04, MBR-05)

- `getMemberMonthlyBreakdown(accountId, monthId)`: despesa total por responsável no mês + categoria de maior gasto de cada um + share percentual. Inclui o bucket "Sem responsável" quando houver transações sem `responsibleUserId`. **Duas** agregações `groupBy` (uma por responsável, uma por responsável+categoria) + resolução de nomes — sem N+1.
- `getMemberYearlyTrend(accountId, year)`: série de despesa por responsável por mês do ano, restrita aos **meses que têm despesa** e às **top-5 séries** (resto agregado em "Outros") — para o multi-line.
- Ambas filtram por `accountId`, agregam com `groupBy` e são envolvidas em `React.cache()` (skill `rsc-client-boundary`). BigInt serializado como `string` na fronteira RSC → Client.

#### Resolução de identidade do responsável (vale para ambas as queries)

> **Delta pendente (Spec 60, ready):** a atribuição passa a ser por `responsiblePartyId` (party), não `responsibleUserId`. `groupBy` agrega por party — invariante do `sharePercent` (shares somam 100%) preservado (cardinalidade 1). Uma party `group` ("Casal") é **uma linha/série**, sem fan-out para membros (non-goal). A resolução "(ex-membro)" abaixo é substituída pela precedência de nome da Spec 60 §2.4 (party pessoal de membro atual = nome ao vivo; external/group/desanexada = `party.name` snapshot). Ver `specs/60-...md`.

A partir do conjunto de `responsibleUserId` distintos retornados pelas agregações:

1. `responsibleUserId = null` → bucket único **"Sem responsável"** (`m.dashboards.members.unassigned`).
2. `responsibleUserId` que **é** `AccountMember` atual → nome via `account_members`/`User` (`User.name`, fallback `User.email`).
3. `responsibleUserId` que **não é** membro atual mas o `User` existe → nome via `User` (`name`, fallback `email`) + sufixo **"(ex-membro)"** (`m.dashboards.members.formerMemberSuffix`). Resolver buscando os `User` faltantes em **uma** query `findMany({ where: { id: { in } } })`.

### 2.2 Distribuição + ranking no mensal (MBR-02)

- Componente `MemberBreakdownChart` (Client): widget `member-breakdown` no contexto `monthly`.
- **Duas visualizações alternáveis** via `ToggleButtonGroup` (estado local, não persistido):
  - **Donut** (pizza) — visualização **padrão**, com `PieLegend` (idioma de distribuição do app).
  - **Barras horizontais** — ordenadas por total decrescente.
  - Ambas exibem apenas os responsáveis com **despesa > 0** no mês.
- **Lista-ranking** ("Quem mais gastou") sempre visível, exibindo por linha: nome (com sufixo "(ex-membro)" quando aplicável), total formatado, share % e categoria-top. A lista inclui **todos os `AccountMember` atuais** — quem não gastou aparece ao final com R$ 0 / 0% e categoria-top "—".
- `kind: "panel"`, `span: "full"`, `defaultVisible: false`.

### 2.3 Tendência por membro no anual (MBR-03)

- Componente `MemberTrendChart` (Client): widget `member-trend` no contexto `yearly`.
- Multi-line de despesa mensal por responsável, eixo X = **meses do ano que têm despesa**. Membro sem gasto em um mês presente no eixo tem ponto **0** (linha contínua, não gap).
- **Top-5 séries** por gasto total no ano; o restante (incluindo eventualmente "Sem responsável" e "(ex-membro)") é agregado em uma linha **"Outros"** (`m.dashboards.members.others`).
- `kind: "panel"`, `span: "full"`, `defaultVisible: false`.

### 2.4 Bucket "Sem responsável" (MBR-04)

- Transações com `responsibleUserId = null` formam um grupo próprio, rotulado "Sem responsável", presente no breakdown mensal (gráfico + ranking) e candidato a série na tendência anual. Participa do cálculo de share % como qualquer outro grupo.

### 2.5 Registro no sistema de widgets (spec 33)

- Como o spec 33 está `approved` e `src/components/dashboards/widget-registry.ts` já existe, registrar:
  - `member-breakdown` no array `monthly` do `WIDGET_REGISTRY`.
  - `member-trend` no array `yearly` do `WIDGET_REGISTRY`.
- Ambos `defaultVisible: false` (regra da skill `dashboard-widgets` para widgets pós-lançamento): nascem em "Disponíveis"; o `resolveLayout` os mantém fora dos ativos até o usuário adicioná-los pelo editor de layout (`Configurações → Visualização`).
- Seguir o checklist de 6 passos da skill `dashboard-widgets` (registry, mensagens, ícone, query, componente, nodeMap). O guard "sem dados → não renderiza" é preservado pelos componentes.

---

## 3. User Stories

- Como membro de uma conta compartilhada, quero ver quanto cada pessoa gastou no mês, para entender o equilíbrio de gastos da família.
- Como usuário, quero um ranking de "quem mais gastou" no mês, para ter a leitura rápida sem ler gráfico.
- Como usuário, quero alternar a distribuição entre donut e barras, para escolher a leitura que prefiro.
- Como usuário, quero ver a evolução do gasto de cada membro ao longo do ano, para identificar tendências individuais.
- Como usuário, quero que transações sem responsável apareçam em um grupo claro, para não sumirem da análise.
- Como usuário, quero que gastos de quem saiu da conta ainda apareçam (marcados como ex-membro), para a análise histórica não mentir.
- Como usuário, quero adicionar/remover esses painéis pelo editor de widgets, para incluí-los só se fizerem sentido para mim.
- Como viewer, quero apenas visualizar essas análises, respeitando meu papel de leitura.

---

## 4. Critérios de Aceitação

### MBR-01 — Agregação por membro

- A query de breakdown DEVE agregar despesa por `responsibleUserId` usando `groupBy` (sem N+1) e filtrar por `accountId`.
- A despesa por membro DEVE considerar apenas transações em seções `countType = "subtract"`, com `amountCents > 0` e `table.countInMonth = true` (mesma base do spec 11 §7.2).
- Cada linha retornada DEVE conter: `userId` (ou `null`), nome de exibição, flag `isFormerMember`, total em centavos (string), share percentual e a categoria de maior gasto (`topCategoryName`).
- A categoria-top DEVE vir de uma segunda agregação `groupBy(["responsibleUserId", "categoryId"])`, tomando a categoria de maior soma por responsável; QUANDO a maior soma for de transações sem categoria, `topCategoryName` DEVE ser `m.dashboards.members.uncategorized` ("Sem categoria").
- O share % de cada linha DEVE ser `total / somaDeTodasAsLinhas × 100`, incluindo "Sem responsável" e ex-membros no denominador; exibido com 1 casa decimal (não é forçado a somar exatamente 100%).
- As funções de query DEVEM ser envolvidas em `React.cache()` e retornar BigInt como `string`.

### MBR-02 — Distribuição e ranking (mensal)

- QUANDO houver ao menos uma despesa com responsável (incluindo "Sem responsável"/ex-membro) no mês, O WIDGET `member-breakdown` DEVE renderizar a distribuição (donut por padrão) e o ranking ordenado por total decrescente.
- O WIDGET DEVE oferecer um `ToggleButtonGroup` que alterna a visualização entre **donut** e **barras horizontais**; o estado é local (não persistido) e o padrão é donut.
- O GRÁFICO (donut ou barras) DEVE exibir apenas responsáveis com total > 0.
- O RANKING DEVE listar **todos os `AccountMember` atuais**, exibindo por linha nome, total formatado, share % e categoria-top; membros sem despesa no mês DEVEM aparecer ao final com R$ 0, 0% e categoria-top "—".
- QUANDO um responsável com despesa não for membro atual da Account (mas o `User` existir), A LINHA DEVE exibir o nome do `User` (fallback email) com sufixo "(ex-membro)".
- QUANDO não houver nenhuma despesa no mês, O WIDGET NÃO DEVE renderizar (guard padrão de widget sem dados).

### MBR-03 — Tendência (anual)

- O WIDGET `member-trend` DEVE renderizar uma linha por responsável com a despesa mensal ao longo dos meses do ano **que possuem despesa** (não os 12 fixos).
- Membro sem despesa em um mês presente no eixo X DEVE ter ponto de valor 0 naquele mês (linha contínua).
- O GRÁFICO DEVE exibir no máximo as **5 séries** de maior gasto no ano; as demais (incluindo eventualmente "Sem responsável" e ex-membros) DEVEM ser agregadas em uma linha "Outros".
- QUANDO o ano não tiver nenhum mês com despesa, O WIDGET NÃO DEVE renderizar.

### MBR-04 — Sem responsável

- QUANDO existirem transações de despesa com `responsibleUserId = null`, ELAS DEVEM ser agregadas em um grupo único rotulado "Sem responsável", presente no breakdown mensal e candidato a série na tendência anual.
- O grupo "Sem responsável" DEVE participar do cálculo de share % como qualquer outro grupo.

### MBR-05 — Responsável que não é mais membro

- QUANDO uma despesa tiver `responsibleUserId` que não corresponde a nenhum `AccountMember` atual mas o `User` existe, ELA DEVE formar uma linha própria (não cair em "Sem responsável"), com nome resolvido via `User` (name, fallback email) e sufixo "(ex-membro)".
- A resolução dos `User` de ex-membros DEVE usar uma única query `findMany({ where: { id: { in: [...] } } })` (sem N+1).

### Acesso e visual

- AS ANÁLISES DEVEM ser visíveis para `owner`, `editor` e `viewer` (read-only, igual ao restante de `/dashboards/*`). A inclusão/remoção dos widgets segue as permissões do editor de layout do spec 33 (`owner`/`editor` editam; `viewer` apenas vê).
- AS CORES DAS SÉRIES DEVEM vir de `getChartColors(mode)` por um mapa estável por id de série (`userId` | `"unassigned"` | `"others"`), reaproveitado entre donut, barras e tendência no mesmo render; validadas em light **e** dark mode — nunca hardcoded.

---

## 5. Fora de Escopo

- **Página dedicada `/dashboards/people`** — a análise entra como widgets nas áreas existentes (mensal e anual); página própria fica para spec futura se necessário.
- **Metas por membro** — já cobertas pela dimensão "membro" do spec 25; aqui é apenas análise descritiva.
- **Análise por membro de receitas** (seções `add`) — apenas despesas nesta versão.
- **Drill-down de transações por membro** (drawer com a lista) — pode reusar o `DrillDownDrawer` em spec futura; fora do escopo aqui.
- **Comparação entre membros com variação percentual mês a mês** — apenas valores absolutos/share nesta versão.
- **Configurar N do top-N ou o tipo de gráfico padrão pela UI** — N = 5 e donut são fixos no código; configuração interna de widget é a Spec 36.
- **Cor de série por `UserSettings.accentColor`** — usa a paleta de gráficos padrão; accent color por membro é melhoria futura.
- **Convidar/atribuir responsável em massa** — é fluxo de transações (specs 09/20), não de análise.

---

## 6. Decisões de Design

| Decisão | Escolha | Motivo |
|---|---|---|
| Onde exibir | Widgets `member-breakdown` (monthly) e `member-trend` (yearly) no `WIDGET_REGISTRY` do spec 33 (já `approved`) | Reusa o sistema de widgets existente; sem fork de "renderizar direto". |
| `defaultVisible` | `false` para ambos | Regra da skill `dashboard-widgets` para widgets pós-lançamento; usuário inclui pelo editor. |
| `span` | `full` para ambos | Espaço para gráfico + ranking lado a lado e para as linhas da tendência; consistente com `monthly-bar-chart`/`top-categories`. |
| Base de despesa | Seções `subtract`, `amountCents > 0`, `countInMonth = true` | Consistência total com spec 11 §7.2 e `calcSpent` do spec 25. |
| Membros no gráfico vs ranking | Gráfico só com despesa > 0; ranking lista todos os membros atuais (zerados ao fim) | Gráfico fica limpo; ranking responde "quem não lançou nada". |
| Visualização do breakdown | Donut **e** barras horizontais, alternáveis por toggle (padrão donut) | Donut comunica proporção; barras comunicam ranking visual; usuário escolhe. |
| Sem responsável | Bucket explícito "Sem responsável" | Garante que nenhum gasto suma da análise (MBR-04). |
| Responsável ex-membro | Linha própria, nome via `User`, sufixo "(ex-membro)" | `responsibleUserId` é `SetNull`/refere `User`; ex-membro tem gasto real e não deve virar "Sem responsável" (MBR-05). |
| Categoria-top | 2ª `groupBy(responsibleUserId, categoryId)`; topo sem categoria → "Sem categoria"; membro zerado → "—" | Sempre mostra algo informativo sem N+1. |
| Tendência: nº de linhas | Top-5 + "Outros" | Evita poluição com muitos membros; mantém legibilidade. |
| Tendência: eixo X | Meses com despesa; ausência de gasto = ponto 0 | Alinhado a "meses que possuem dados"; linha contínua. |
| Share % | `total / somaGeral × 100`, 1 casa decimal, sem forçar soma 100% | Simples; denominador inclui todos os grupos. |
| Cor por série | `getChartColors(mode)` via mapa estável por id de série | Consistência entre donut, barras e tendência; light + dark. |

---

## 7. Referências Técnicas

| Item | Arquivo(s) a tocar / criar |
|---|---|
| MBR-01/04/05 | `src/lib/queries/member-analytics.ts` (`getMemberMonthlyBreakdown`, `getMemberYearlyTrend`) + `.test.ts` (multi-tenancy + bucket null + ex-membro + topCategory) |
| MBR-02 | `src/components/dashboards/MemberBreakdownChart.tsx` (toggle donut/barras + ranking) |
| MBR-03 | `src/components/dashboards/MemberTrendChart.tsx` (multi-line top-5 + "Outros") |
| Registro de widgets (spec 33) | `src/components/dashboards/widget-registry.ts` (`member-breakdown` em `monthly`, `member-trend` em `yearly`; `kind: "panel"`, `span: "full"`, `defaultVisible: false`) |
| Ícones do editor | `src/components/settings/widget-icons.tsx` (ícone para `member-breakdown` e `member-trend`) |
| Integração mensal | `src/components/dashboards/MonthlyDashboardClient.tsx` (nodeMap: `member-breakdown`) + `src/app/(app)/[accountId]/dashboards/monthly/[monthId]/page.tsx` (carregar query) |
| Integração anual | `src/app/(app)/[accountId]/dashboards/yearly/[year]/page.tsx` (carregar query + nodeMap: `member-trend`) |
| Lazy charts | `src/components/dashboards/charts/lazy.ts` (dynamic import dos dois componentes, conforme skill `rsc-client-boundary`) |
| Mensagens | `src/lib/messages/pt-BR.ts` sob `dashboards.members.*` e labels/descrições de widget em `dashboards.widgets.{monthly,yearly}.*` + `dashboards.widgets.descriptions.*` |

### 7.1 Mensagens (chaves novas)

```ts
// src/lib/messages/pt-BR.ts → dashboards.members
members: {
  unassigned: "Sem responsável",
  formerMemberSuffix: "(ex-membro)",
  uncategorized: "Sem categoria",
  others: "Outros",
  whoSpentMost: "Quem mais gastou",
  viewDonut: "Rosca",
  viewBars: "Barras",
  shareLabel: "Participação",
  emptyTopCategory: "—",
},
// dashboards.widgets.monthly.memberBreakdown = "Gastos por membro"
// dashboards.widgets.yearly.memberTrend = "Tendência por membro"
// dashboards.widgets.descriptions["member-breakdown"] = "Distribuição e ranking de despesas por pessoa no mês."
// dashboards.widgets.descriptions["member-trend"]     = "Evolução da despesa de cada pessoa ao longo do ano."
```

### 7.2 Definição de despesa por membro

> Idêntica à base de despesa usada no app: `section.countType = "subtract"`, `amountCents > 0`, `table.countInMonth = true`. **Não** somar seções `add`/`neutral`/`ignore`. O share % de cada linha é `totalDaLinha / somaDeTodasAsLinhas × 100`, incluindo "Sem responsável" e ex-membros no denominador; exibido com 1 casa decimal.

### 7.3 Query de breakdown mensal (groupBy, sem N+1)

```ts
// src/lib/queries/member-analytics.ts
import { cache } from "react";
import { prisma } from "@/lib/prisma";

export type MemberBreakdownRow = {
  userId: string | null;          // null = "Sem responsável"
  name: string;                   // resolvido via account_members / User; fallback email
  isFormerMember: boolean;        // true = User existe mas não é AccountMember atual
  totalCents: string;             // BigInt serializado
  sharePercent: number;           // 1 casa decimal
  topCategoryName: string | null; // null/"—" quando membro sem despesa
};

export const getMemberMonthlyBreakdown = cache(async (
  accountId: string,
  monthId: string,
): Promise<MemberBreakdownRow[]> => {
  const where = {
    accountId,                                   // ✅ multi-tenancy
    monthId,
    amountCents: { gt: 0n },
    section: { is: { countType: "subtract" as const } },
    table:   { is: { countInMonth: true } },
  };

  // 1ª query: soma por responsável (inclui null como grupo)
  const byMember = await prisma.transaction.groupBy({
    by: ["responsibleUserId"],
    where,
    _sum: { amountCents: true },
  });

  // 2ª query: soma por (responsável, categoria) → categoria-top por membro
  const byMemberCategory = await prisma.transaction.groupBy({
    by: ["responsibleUserId", "categoryId"],
    where,
    _sum: { amountCents: true },
  });

  // Resolver identidades:
  //  - null → m.dashboards.members.unassigned
  //  - membros atuais → AccountMember/User (1 query findMany por accountId)
  //  - ex-membros (id presente em byMember, ausente em members) → User.findMany({ id: { in } }) + sufixo
  //  - categorias → categoria.findMany({ id: { in } }); categoryId null → m.dashboards.members.uncategorized
  // Montar share % com soma de todas as linhas no denominador.
  // Ranking final inclui TODOS os AccountMember atuais (zerados ao fim, topCategory "—").
  // ...
});

// ❌ Anti-padrão — uma query de agregação por membro (N+1) dentro de um map sobre os membros
```

### 7.4 Query de tendência anual (top-5 + "Outros")

```ts
export type MemberTrendSeries = {
  seriesId: string;               // userId | "unassigned" | "others"
  name: string;                   // com sufixo "(ex-membro)" quando aplicável
  points: { monthLabel: string; totalCents: string }[]; // só meses com despesa; ausência = "0"
};

export const getMemberYearlyTrend = cache(async (
  accountId: string,
  year: number,
): Promise<MemberTrendSeries[]> => {
  // groupBy(["responsibleUserId", "monthId"]) filtrando por accountId + base de despesa + meses do ano.
  // Determinar meses com despesa (eixo X). Calcular total anual por responsável.
  // Manter as 5 maiores séries; agregar o restante em "Outros" (somando por mês).
  // Preencher meses sem ponto com "0". Resolver nomes/ex-membro igual à 7.3.
  // ...
});
```

> Conversão para chart apenas na borda: `Number(BigInt(totalCents)) / 100` (skill `dashboards-charts`). Cores via `getChartColors(mode)` por mapa estável de `seriesId`. Componentes `"use client"`, importados via `charts/lazy.ts`.
