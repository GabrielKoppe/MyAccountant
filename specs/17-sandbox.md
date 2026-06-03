# Spec 17 — Sandbox de Análise

## 1. Propósito

Define a feature **Sandbox de Análise** — uma página interativa onde o usuário seleciona dimensões, métricas e tipos de gráfico para construir análises ad-hoc sobre os dados financeiros da Account. As análises configuradas podem ser salvas com nome para reutilização futura.

## 2. Rota

```
/[accountId]/dashboards/sandbox        — sandbox (nova análise ou carrega salva via UI)
```

Acesso via botão **"Sandbox"** no dashboard anual (`/dashboards/yearly/[year]`), posicionado ao lado do `MonthCardGrid`.

## 3. Conceitos

### 3.1 Config da análise

A config define completamente o que é renderizado. É serializável como JSON e salva no banco via `SavedAnalysis`.

| Campo | Tipo | Descrição |
|---|---|---|
| `periodType` | `"year" \| "months" \| "current_month"` | Tipo de filtro de período |
| `year` | `number?` | Ano (quando `periodType="year"`) |
| `monthIds` | `string[]?` | IDs específicos de meses (quando `periodType="months"`) |
| `groupBy` | `"month" \| "section" \| "category" \| "institution" \| "table_type"` | Eixo X / dimensão de agrupamento |
| `seriesBy` | `"section" \| "category" \| "member" \| "institution" \| "table_type" \| "none"` | Dimensão das séries (cores/legenda) |
| `metric` | `"total" \| "income" \| "expense" \| "count" \| "avg"` | O que medir no eixo Y |
| `chartType` | `"bar_grouped" \| "bar_stacked" \| "line" \| "area" \| "pie" \| "donut"` | Tipo de visualização |
| `filterSectionIds` | `string[]?` | Seções a incluir — `null` = todas |
| `filterCategoryIds` | `string[]?` | Categorias a incluir — `null` = todas |
| `filterMemberIds` | `string[]?` | Membros a incluir — `null` = todos |

### 3.2 Combinações válidas

**Regra geral**: qualquer `groupBy` pode ser combinado com qualquer `seriesBy` diferente. As 5 dimensões são `month`, `section`, `category`, `institution`, `table_type`.

| groupBy | seriesBy (qualquer que não seja o mesmo) | Métricas | Gráficos |
|---|---|---|---|
| `month` | section, category, member, institution, table_type, none | todas | bar_grouped, bar_stacked, line, area |
| `section` | category, member, institution, table_type, none | todas | bar_grouped, bar_stacked, line, area, pie\*, donut\* |
| `category` | section, member, institution, table_type, none | total, count, avg | bar_grouped, bar_stacked, line, area, pie\*, donut\* |
| `institution` | section, category, member, table_type, none | todas | bar_grouped, bar_stacked, line, area, pie\*, donut\* |
| `table_type` | section, category, member, institution, none | todas | bar_grouped, bar_stacked, line, area, pie\*, donut\* |

> \* `pie` e `donut` disponíveis apenas quando `seriesBy=none`.
> **Scatter**: previsto para v2 — requer 2 métricas simultâneas.

### 3.3 Métricas

| Métrica | Cálculo |
|---|---|
| `total` | Soma de `amountCents` aplicando `countType`: `add` → +valor, `subtract` → −valor, `neutral` → sinal próprio, `ignore` → excluído |
| `income` | Soma de `amountCents` apenas de seções com `countType=add` |
| `expense` | Soma de `amountCents` apenas de seções com `countType=subtract` (valor absoluto) |
| `count` | Contagem de transações (inclui `ignore`) |
| `avg` | `total / count` por grupo |

### 3.4 `periodType: "current_month"` — período dinâmico

Quando `periodType="current_month"`, a análise não tem período fixo: resolve dinamicamente para o mês sendo visualizado no momento da renderização.

- No **dashboard mensal**: resolve para o `monthId` da página atual.
- No **sandbox standalone**: mostra um seletor de mês para visualizar.
- Não faz sentido em `groupBy: "month"` (resultado sempre de 1 ponto) — a UI sugere `groupBy: "section"` quando este período é selecionado.
- Análises com `current_month` devem ter `dashboardContext: "monthly"` ou `"both"` (a UI força isso automaticamente).

**Princípio de auto-refresh**: como a config armazena parâmetros de query (não resultados), toda análise salva reflete sempre os dados mais recentes. Por exemplo, uma análise com `periodType: "year", year: 2026` inclui automaticamente novos meses adicionados ao ano 2026 sem nenhuma ação do usuário.

### 3.5 Membro (`seriesBy=member`)

Usa o campo `responsibleUserId` da `Transaction`. Transações sem responsável aparecem como série **"Não atribuído"**. Nomes dos membros buscados via join `AccountMember → User.name`.

### 3.6 Instituição (`groupBy=institution` / `seriesBy=institution`)

Usa o campo `institutionId` da `Transaction`. Transações sem instituição aparecem como **"Sem instituição"**. Caso de uso: "quanto gastei em cada banco/corretora?", "por mês, quais instituições dominaram os gastos?".

### 3.7 Tipo de tabela (`groupBy=table_type` / `seriesBy=table_type`)

Usa `Transaction.tableId → FinanceTable.tableTypeId → TableType.name`. Como `tableTypeId` não está diretamente na Transaction, a query agrupa por `tableId` e remapeia para `tableTypeId` em memória via um lookup `{ tableId → tableTypeId }`. Tabelas sem tipo (`tableTypeId=null`) aparecem como **"Manual"**. Caso de uso: "Cartão de crédito vs Manual vs Investimentos — qual tipo movimenta mais?".

## 4. Modelo de dados

### 4.1 `SavedAnalysis` (nova entidade)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String` (cuid) | PK |
| `accountId` | `String` | FK → Account |
| `createdById` | `String` | FK → User |
| `name` | `String` | nome dado pelo usuário (único por Account) |
| `config` | `Json` | config serializada (`sandboxConfigSchema`) |
| `isPinned` | `Boolean` | `true` = aparece como mini-gráfico nos dashboards |
| `pinnedOrder` | `Int` | ordem de exibição no dashboard (0-based) |
| `dashboardContext` | `String` | `"yearly"` \| `"monthly"` \| `"both"` — onde aparece quando fixada |
| `createdAt` | `DateTime` | default `now()` |
| `updatedAt` | `DateTime` | auto-update |

**Regras**:
- Qualquer membro (owner/editor/viewer) pode criar e salvar análises.
- Análises são **visíveis para todos os membros** da Account.
- Apenas o criador ou um `owner` pode deletar.
- **Máximo 4 análises fixadas por Account** (`isPinned=true`). Ao tentar fixar a 5ª, a UI pede para desafixar outra primeiro. Limite existe para manter o carregamento do dashboard anual razoável (4 queries em paralelo).

### 4.2 Adição ao `prisma/schema.prisma`

```prisma
model SavedAnalysis {
  id          String   @id @default(cuid())
  accountId   String   @map("account_id")
  createdById String   @map("created_by_id")
  name        String
  config      Json
  isPinned    Boolean  @default(false) @map("is_pinned")
  pinnedOrder Int      @default(0)     @map("pinned_order")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt      @map("updated_at")

  account   Account @relation(fields: [accountId], references: [id], onDelete: Cascade)
  createdBy User    @relation("AnalysisCreatedBy", fields: [createdById], references: [id], onDelete: Restrict)

  @@unique([accountId, name])
  @@index([accountId])
  @@index([accountId, isPinned])
  @@map("saved_analyses")
}
```

Adicionar também em `Account`:
```prisma
savedAnalyses  SavedAnalysis[]
```

E em `User`:
```prisma
analysesCreated  SavedAnalysis[]  @relation("AnalysisCreatedBy")
```

## 5. Layout

### 5.1 Desktop (md+)

```
┌──────────────────────────────────────────────────────────────────────┐
│ ← Dashboard Anual          Sandbox de Análise                        │
├────────────────┬─────────────────────────────────────────────────────┤
│  CONTROLES     │                                                      │
│  (240px fixo)  │         ÁREA DO GRÁFICO                             │
│                │         (recharts ResponsiveContainer)              │
│  Período       │                                                      │
│  [2026 ▼]      │                                                      │
│                ├─────────────────────────────────────────────────────┤
│  Agrupar por   │         TABELA PIVÔ                                 │
│  ◉ Meses       │         (dados do gráfico em formato tabular)       │
│  ○ Seções      │                                                      │
│  ○ Categorias  │                                                      │
│                │                                                      │
│  Séries por    │                                                      │
│  ◉ Seções      │                                                      │
│  ○ Categorias  │                                                      │
│  ○ Membros     │                                                      │
│  ○ Nenhuma     │                                                      │
│                │                                                      │
│  Métrica       │                                                      │
│  [Total ▼]     │                                                      │
│                │                                                      │
│  Tipo de Gráfico│                                                     │
│  [Barras ▼]    │                                                      │
│                │                                                      │
│  ── Filtros ── │                                                      │
│  Seções [▼]    │                                                      │
│  Categorias[▼] │                                                      │
│  Membros [▼]   │                                                      │
│                │                                                      │
│  ── Salvas ──  │                                                      │
│  [+ Salvar]    │                                                      │
│  > Gastos 2026 │                                                      │
│  > Por membro  │                                                      │
└────────────────┴─────────────────────────────────────────────────────┘
```

### 5.2 Mobile (xs/sm)

Em telas pequenas, o painel de controles colapsa para um bloco no topo (accordeon com `<Accordion>` do MUI). Gráfico ocupa largura total abaixo.

## 6. Arquitetura

### 6.1 Componentes

```
src/app/(app)/[accountId]/dashboards/sandbox/
  page.tsx                       — RSC: carrega lista de análises salvas + metadados
                                   (sections, categories, members da Account)

src/components/dashboards/sandbox/
  SandboxPage.tsx                — "use client", orquestrador principal
  SandboxControls.tsx            — "use client", painel de configuração (sidebar)
  SandboxChart.tsx               — "use client", renderizador recharts (troca de tipo)
  SandboxDataTable.tsx           — "use client", tabela pivô dos dados do gráfico
  SavedAnalysisList.tsx          — "use client", lista + botão salvar/carregar/deletar
```

### 6.2 Query

```ts
// src/lib/queries/sandbox.ts

export type SandboxSeries = { key: string; label: string };

export type SandboxResult = {
  series: SandboxSeries[];
  rows: Array<{
    xKey: string;   // key para recharts dataKey
    xLabel: string; // label humana do eixo X
    [seriesKey: string]: string | number; // sectionId/categoryId/userId → valor
  }>;
  totalFormatted: string;
};

export async function getSandboxData(
  accountId: string,
  config: SandboxConfig,
): Promise<SandboxResult>
```

**Estratégia da query**:

```
1. Resolver monthIds do período (se periodType="year" → buscar todos os meses do ano)
2. Buscar transactions com where: { accountId, monthId: { in: monthIds }, table: { countInMonth: true } }
   - Filtros adicionais de section/category/member se fornecidos
3. groupBy: [dimensão do groupBy, dimensão do seriesBy (se != none)]
4. _sum: { amountCents } + _count: { id }
5. Join em memória com nomes (section.name, category.name, user.name)
6. Aplicar transformação de countType para total/income/expense
7. Pivotear para formato recharts: rows[i] = { xKey, xLabel, [seriesKey]: value, ... }
```

### 6.3 Server Actions

```ts
// src/actions/sandbox.ts

export const getSandboxDataAction    // defineAction — executa getSandboxData
export const saveSandboxAnalysis     // defineAction — cria ou atualiza SavedAnalysis
export const deleteSandboxAnalysis   // defineAction — deleta (verifica owner/creator)
export const togglePinAnalysis       // defineAction — alterna isPinned (verifica limite de 4)
export const reorderPinnedAnalyses   // defineAction — atualiza pinnedOrder após drag-and-drop
```

### 6.4 Schema Zod

```ts
// src/lib/schemas/sandbox.ts

export const sandboxConfigSchema = z.object({
  periodType:        z.enum(["year", "months"]),
  year:              z.number().int().min(2000).max(2100).optional(),
  monthIds:          z.array(z.string()).optional(),
  groupBy:           z.enum(["month", "section", "category"]),
  seriesBy:          z.enum(["section", "category", "member", "none"]),
  metric:            z.enum(["total", "income", "expense", "count", "avg"]),
  chartType:         z.enum(["bar_grouped", "bar_stacked", "line", "area", "pie", "donut"]),
  filterSectionIds:  z.array(z.string()).optional(),
  filterCategoryIds: z.array(z.string()).optional(),
  filterMemberIds:   z.array(z.string()).optional(),
}).refine(
  (c) => c.periodType === "year" ? c.year != null : (c.monthIds?.length ?? 0) > 0,
  { message: "Período inválido" }
);

export type SandboxConfig = z.infer<typeof sandboxConfigSchema>;

export const saveSandboxAnalysisSchema = z.object({
  name:   z.string().min(1).max(100),
  config: sandboxConfigSchema,
});
```

## 7. Estado e data flow

```
RSC page.tsx
  └─ carrega: savedAnalyses, accountSections, accountCategories, accountMembers
  └─ passa como props para ↓

SandboxPage.tsx  (client)
  └─ useState: config (SandboxConfig)
  └─ useState: sandboxResult (SandboxResult | null)
  └─ useTransition: para chamar getSandboxDataAction quando config muda
  │
  ├─ SandboxControls ← props: config, onChange, sections, categories, members, savedAnalyses
  ├─ SandboxChart    ← props: result, config
  ├─ SandboxDataTable ← props: result, config
  └─ SavedAnalysisList ← props: savedAnalyses, onLoad, onDelete, currentConfig
```

> Config em `useState` (não URL). Shareabilidade via URL state é v2.

## 8. Renderização dos tipos de gráfico

Todos implementados com `recharts`:

| chartType | Componente recharts | Notas |
|---|---|---|
| `bar_grouped` | `<BarChart>` + `<Bar>` por série | `layout="vertical"` quando groupBy=section/category |
| `bar_stacked` | `<BarChart>` + `<Bar stackId="a">` por série | mesmo acima |
| `line` | `<LineChart>` + `<Line>` por série | |
| `area` | `<AreaChart>` + `<Area stackId="a">` por série | stacked por default |
| `pie` | `<PieChart>` + `<Pie>` com `<Cell>` | só quando seriesBy=none |
| `donut` | igual pie mas `innerRadius={60}` | só quando seriesBy=none |

**Cores**: `getChartColors(mode)` de `design-tokens.ts` — uma cor por série.

## 9. Seção "Análises Salvas" no Dashboard Anual

### 9.1 Layout

A seção aparece no dashboard anual **abaixo do gráfico "Totais por Mês"**, antes da lista de top categorias:

```
Dashboard Anual (/yearly/[year])
  ├─ KPI cards
  ├─ MonthCardGrid ("Ir para um mês específico")
  ├─ Divider
  ├─ Gráfico "Totais por Mês" (MonthlyBarChart — existente)
  │
  ├─ ✨ Paper "Análises Salvas"                    ← novo
  │     Header: "Análises Salvas"  [Abrir Sandbox →]
  │     Grid 2 colunas (md) / 1 coluna (xs):
  │     ┌──────────────────┐  ┌──────────────────┐
  │     │ "Gastos por membro"│ │ "Categorias 2026" │
  │     │ [mini gráfico]   │  │ [mini gráfico]   │
  │     │ [⭐ Fixado] [→]  │  │ [⭐ Fixado] [→]  │
  │     └──────────────────┘  └──────────────────┘
  │     (empty state se nenhuma fixada)
  │
  └─ Top Categorias
```

### 9.2 Componente `PinnedAnalysesSection`

```tsx
// src/components/dashboards/PinnedAnalysesSection.tsx
// Props: accountId, pinnedAnalyses: PinnedAnalysis[]
// PinnedAnalysis = SavedAnalysis + sandboxResult já calculado no RSC
```

Cada card da análise fixada:
- Nome da análise como título (`Typography variant="subtitle2"`)
- Mini gráfico: `SandboxChart` com `height={200}` e sem legenda
- Rodapé: badge do tipo de gráfico + botão "Abrir →" que leva para `/sandbox?analysisId=<id>`
- Botão desafixar (ícone pin) no canto superior direito

### 9.3 Carregamento no RSC

```ts
// No YearlyDashboardPage RSC:
const pinnedAnalyses = await prisma.savedAnalysis.findMany({
  where: { accountId, isPinned: true },
  orderBy: { pinnedOrder: "asc" },
});

// Para cada análise, calcular os dados em paralelo:
const pinnedResults = await Promise.all(
  pinnedAnalyses.map((a) => getSandboxData(accountId, a.config as SandboxConfig)),
);
```

> Os dados são calculados no RSC (Server Component) — sem custo de hydration para os mini-gráficos. O componente `PinnedAnalysesSection` recebe os resultados prontos e renderiza com recharts no cliente.

### 9.4 Empty state

```
┌──────────────────────────────────────────────────────────────────────┐
│  Análises Salvas                             [Abrir Sandbox →]       │
│                                                                      │
│  Nenhuma análise fixada.                                             │
│  Crie análises no Sandbox e fixe as favoritas para ver aqui.         │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## 10. Acesso

| Papel | Criar/salvar análise | Ver análises | Deletar análise |
|---|---|---|---|
| owner | ✅ | ✅ | ✅ (qualquer) |
| editor | ✅ | ✅ | ✅ (própria) |
| viewer | ✅ | ✅ | ✅ (própria) |

> Viewer pode criar análises ad-hoc e salvar as próprias. Não pode deletar de outros.

## 11. Validação anti-combinações inválidas

No `SandboxControls`, quando o usuário muda uma opção que invalida a configuração atual:

- Mudar `groupBy` para `section` ou `category` → forçar `seriesBy=none`, desabilitar pie se tiver série.
- Mudar `chartType` para `pie`/`donut` → forçar `seriesBy=none`.
- `metric=income` com `groupBy=category` → mostrar aviso "Métrica income mostra só seções do tipo entrada".

## 12. Edge cases

| Situação | Comportamento |
|---|---|
| Sem transações no período | Gráfico vazio com mensagem "Sem dados para o período selecionado." |
| Membro com `name=null` | Exibir email truncado. Se email também null: "Membro desconhecido" |
| `countType=ignore` em `metric=total/income/expense` | Excluídas do cálculo |
| Análise salva com seções deletadas | Seções ausentes ficam com valor 0; legenda mostra "(removida)" |
| Config inválida salva (schema evolve) | Zod `.safeParse()` na carga; se inválida → mensagem "Análise incompatível com versão atual" |
| Nome duplicado ao salvar | Zod + Prisma `@@unique` → erro traduzido no toast |

## 13. Roadmap (v2)

- [ ] URL state para config (links compartilháveis apontando para análise específica).
- [ ] Scatter chart (2 métricas simultâneas no mesmo eixo).
- [ ] Export: PNG do gráfico (`html-to-image`) e CSV dos dados pivô.
- [ ] Comparação overlay: 2 análises sobrepostas no mesmo gráfico (linha A vs linha B).
- [ ] Análises públicas com slug (compartilhar fora da Account via link).
