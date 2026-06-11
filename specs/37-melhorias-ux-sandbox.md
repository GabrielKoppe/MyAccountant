# Spec 37 — Melhorias de UX no Sandbox de Análise

> Status: draft
> Insumo: revisão de código em `src/components/dashboards/sandbox/` · feedback de uso: análises com período fixo exibidas estaticamente em todos os meses no dashboard mensal
> Skills: [`design-system`](../skills/design-system/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`server-actions`](../skills/server-actions/SKILL.md) · [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md)

---

## 1. Problema

- **SAND-01** — **Período fixo no dashboard mensal**: em `src/components/dashboards/sandbox/SavedAnalysisList.tsx:58–74`, `handleSave()` chama `saveSandboxAnalysisAction` sem nenhuma verificação de compatibilidade entre `dashboardContext` e `periodType`. Quando o usuário salva uma análise com `dashboardContext: "monthly"` e `periodType: "months"` (ex.: Maio 2026 fixo), essa análise aparece em todos os dashboards mensais — Abril, Março, etc. — sempre exibindo dados de Maio, o que não faz sentido. A infraestrutura para resolver isso já existe: `periodType: "current_month"` resolve dinamicamente para o mês visualizado (implementado em `src/lib/queries/sandbox.ts:94`), mas a UI não orienta nem alerta o usuário sobre isso. O seletor de período em `src/components/dashboards/sandbox/SandboxControls.tsx:188–189` já exibe a opção "Mês atual (dinâmico)", mas não há conexão com o contexto de dashboard selecionado no formulário de salvar.

- **SAND-02** — **Nome 100% manual, sem sugestão automática**: em `SavedAnalysisList.tsx:54`, `saveName` inicia como `""`. O usuário precisa inventar um nome sem nenhuma referência ao que está sendo salvo. O componente já recebe `currentConfig: SandboxConfig` via `src/components/dashboards/sandbox/SandboxPage.tsx:169`, que contém todas as informações necessárias (métrica, agrupamento, período) para gerar uma sugestão descritiva.

- **SAND-03** — **Sem modo de edição/atualização de análise existente**: em `SavedAnalysisList.tsx:61–65`, `handleSave()` nunca inclui `id` na chamada. O schema `saveSandboxAnalysisSchema` em `src/lib/schemas/sandbox.ts:67` tem campo `id?: string` para upsert, mas a UI nunca o usa. Quando o usuário carrega uma análise (`SavedAnalysisList.tsx:219`), ajusta a configuração e clica em "Salvar", uma nova análise duplicada é criada em vez de atualizar a original. Não há nenhum indicador visual de que uma análise está atualmente "em edição".

- **SAND-04** — **`periodType: "current_month"` retorna gráfico vazio no sandbox standalone**: em `SandboxPage.tsx:64`, `getSandboxDataClientAction(accountId, cfg)` nunca passa o terceiro argumento `currentMonthId`. A query em `src/lib/queries/sandbox.ts:94` retorna `[]` quando `periodType === "current_month"` sem `currentMonthId`. Resultado: clicar em "Abrir no Sandbox" de uma análise com `current_month` — link que agora inclui `?analysisId=` (spec corrigida) — exibe um gráfico completamente vazio sem mensagem explicativa.

- **SAND-05** — **Lista de análises não mostra metadados de configuração**: em `SavedAnalysisList.tsx:228`, o `Chip` de contexto exibe o valor bruto `a.dashboardContext` (ex.: `"monthly"`) em vez do label localizado (`"Dashboard mensal"`). Além disso, cada item da lista mostra apenas o nome, sem indicação do período, métrica ou agrupamento da análise — impossível distinguir duas análises de nomes similares sem carregá-las uma a uma.

---

## 2. Solução

### 2.1 Aviso de incompatibilidade período × contexto mensal (SAND-01)

Quando `dashboardContext` for `"monthly"` ou `"both"` **e** `currentConfig.periodType !== "current_month"`, exibir um `Alert severity="warning"` inline imediatamente abaixo do seletor de contexto. O alerta inclui:
- Texto explicativo curto sobre o comportamento dinâmico do dashboard mensal
- Botão de ação "Usar mês atual" que chama `onConfigChange({ ...currentConfig, periodType: "current_month" })` via novo prop adicionado a `SavedAnalysisList`

O aviso é **informativo, não bloqueante** — o usuário pode ignorá-lo e salvar com período fixo (caso de uso válido: análise histórica que deve sempre mostrar um mês específico).

### 2.2 Sugestão automática de nome (SAND-02)

Criar utilitário `generateAnalysisName(config, allMonths)` em `src/lib/sandbox-name.ts` que produz um nome no formato `{Métrica} por {Agrupamento} · {Período}`.

No `SavedAnalysisList`, o campo `saveName` inicia com a sugestão gerada. Um estado booleano `nameDirty` controla se o campo foi editado manualmente:
- `nameDirty = false` → campo atualiza com a nova sugestão quando `currentConfig` muda
- `nameDirty = true` → campo não é sobrescrito
- `nameDirty` é resetado para `false` após salvar ou ao carregar uma análise da lista

`SavedAnalysisList` recebe novo prop `allMonths` de `SandboxPage` para que `generateAnalysisName` possa traduzir Month IDs para labels de exibição.

### 2.3 Modo de edição e atualização de análise existente (SAND-03)

`SandboxPage` rastreará `activeAnalysisId: string | null` e passará como prop a `SavedAnalysisList` junto com `onClearActiveAnalysis: () => void`. Quando o usuário clica em uma análise para carregá-la, `handleLoad` em `SandboxPage` define `activeAnalysisId`.

Quando `activeAnalysisId` não é `null`, o formulário de salvar entra em **modo de edição**:
- Exibe indicador "Editando: [nome]" com botão `×` (chama `onClearActiveAnalysis`)
- Botão primário muda de "Salvar análise" para "Atualizar"
- "Atualizar" chama `saveSandboxAnalysisAction` com `id: activeAnalysisId`, `name`, `config`, `dashboardContext`
- Link secundário "Salvar como novo" limpa `activeAnalysisId` e salva normalmente

Quando `activeAnalysisId` é `null`, o formulário exibe o modo de criação normal.

### 2.4 Seletor de mês de prévia para `current_month` (SAND-04)

`SandboxPage` ganha estado `previewMonthId: string` — inicializado com o ID do mês mais recente de `allMonths`. Quando `config.periodType === "current_month"`, a área do gráfico exibe um seletor de mês "Prévia para →" posicionado no topo da área de conteúdo (acima do chart). `runQuery` passa `previewMonthId` como terceiro argumento para `getSandboxDataClientAction` quando o período for `current_month`.

### 2.5 Metadados de config na lista de análises (SAND-05)

Em cada item da lista de análises:
- Chip de contexto: substituir `a.dashboardContext` por `ms.context[a.dashboardContext]` para exibir label localizado
- Adicionar `ListItemText.secondary` com `summarizeConfig(a.config, allMonths)` mostrando `{período} · {agrupamento} · {métrica}` em texto compacto

A função `summarizeConfig` é colocada em `src/lib/sandbox-name.ts` junto com `generateAnalysisName`.

---

## 3. User Stories

- Como usuário, quero ser alertado quando salvo uma análise com período fixo para o dashboard mensal, para entender o comportamento e ter a opção de corrigir com um clique.
- Como usuário, quero que o campo de nome venha preenchido com uma sugestão baseada na minha configuração atual, para economizar tempo e ter nomes consistentes entre análises.
- Como usuário, quero poder atualizar uma análise já salva sem criar duplicatas, para manter minha lista de análises organizada à medida que refino minha configuração.
- Como usuário, quero ver o gráfico ao abrir no sandbox uma análise com "mês atual (dinâmico)" e poder escolher para qual mês prévia os dados, para validar a análise antes de fixá-la no dashboard.
- Como usuário, quero ver o período, agrupamento e métrica de cada análise na lista sem precisar carregá-la, para identificar rapidamente qual análise quero usar.

---

## 4. Critérios de Aceitação

**SAND-01:**
- QUANDO `dashboardContext` for `"monthly"` ou `"both"` E `currentConfig.periodType` não for `"current_month"`, O FORMULÁRIO DEVE exibir um `Alert severity="warning"` com botão de ação "Usar mês atual".
- QUANDO o usuário clica em "Usar mês atual", O CONFIG DO SANDBOX DEVE ser atualizado para `periodType: "current_month"` e O `Alert` DEVE desaparecer.
- SE `dashboardContext` for `"yearly"`, O `Alert` NÃO DEVE aparecer para nenhum `periodType`.
- O usuário DEVE conseguir salvar com `dashboardContext: "monthly"` e `periodType` fixo sem aprovação obrigatória — o aviso é informativo.

**SAND-02:**
- QUANDO o sandbox carrega ou `currentConfig` muda, O CAMPO DE NOME DEVE exibir a sugestão de `generateAnalysisName(currentConfig, allMonths)`, desde que `nameDirty` seja `false`.
- SE o usuário editar o campo de nome manualmente, O CAMPO NÃO DEVE ser substituído por nova sugestão durante a mesma sessão de edição.
- QUANDO uma análise é carregada da lista ou a análise é salva, O CAMPO DEVE ser re-populado com a sugestão gerada e `nameDirty` DEVE ser resetado para `false`.
- A sugestão gerada DEVE seguir o padrão `{Métrica} por {Agrupamento} · {Período}` conforme tabela abaixo:

| Config | Sugestão esperada |
|---|---|
| `metric=total, groupBy=month, periodType=year, year=2026` | `"Total por Meses · 2026"` |
| `metric=expense, groupBy=category, periodType=current_month` | `"Saídas por Categorias · Mês atual"` |
| `metric=income, groupBy=section, periodType=months, monthIds=[id-junho]` | `"Entradas por Seções · Jun 2026"` |
| `metric=count, groupBy=institution, periodType=last_3_months` | `"Transações por Instituições · Últ. 3 meses"` |

**SAND-03:**
- QUANDO o usuário clica em uma análise na lista, O FORMULÁRIO DEVE entrar em modo de edição exibindo "Editando: [nome da análise]" e os botões "Atualizar" e "Salvar como novo".
- QUANDO o usuário clica em "Atualizar", A ACTION DEVE ser chamada com `id: activeAnalysisId` e A LISTA NÃO DEVE criar nova entrada.
- QUANDO "Atualizar" é bem-sucedido, O SNACKBAR DEVE exibir `ms.analysisUpdated`.
- QUANDO o usuário clica em `×` (descartar edição) ou em "Salvar como novo", O FORMULÁRIO DEVE voltar ao modo de criação normal e `activeAnalysisId` DEVE ser `null`.
- SE o usuário editar o config sem ter carregado uma análise da lista, O FORMULÁRIO DEVE permanecer no modo de criação normal.

**SAND-04:**
- QUANDO `config.periodType === "current_month"`, A ÁREA DO GRÁFICO DEVE exibir o seletor "Prévia para →" acima do chart.
- O SELETOR DEVE inicializar com o mês mais recente de `allMonths`.
- QUANDO o usuário muda o mês de prévia, O GRÁFICO DEVE ser re-renderizado com os dados desse mês.
- QUANDO `config.periodType !== "current_month"`, O SELETOR NÃO DEVE aparecer.
- O GRÁFICO NÃO DEVE exibir conteúdo vazio para `current_month` quando `previewMonthId` estiver definido.

**SAND-05:**
- O chip de contexto de cada análise DEVE exibir `"Dashboard anual"`, `"Dashboard mensal"` ou `"Ambos"` — nunca `"yearly"`, `"monthly"` ou `"both"`.
- Cada item da lista DEVE ter linha secundária no formato `"{período} · {agrupamento} · {métrica}"` (ex.: `"2026 · Meses · Total"` ou `"Mês atual · Categorias · Saídas"`).

---

## 5. Fora de Escopo

- Reordenação drag-and-drop das análises salvas (mencionado no spec 17 §4.3 como pendente — fica para spec futura).
- Paginação ou busca/filtro na lista de análises salvas.
- Exportação de análises (CSV, imagem do gráfico).
- Edição inline do nome diretamente na lista (sem abrir o formulário).
- Compartilhamento seletivo de análises entre members específicos (análises já são por Account e visíveis a todos os members).
- Validação bloqueante que impede salvar com configuração que retorna dados vazios — qualquer config schema-válida pode ser salva.
- Migração de análises já salvas com período fixo — o aviso SAND-01 só se aplica ao momento do salvamento.

---

## 6. Decisões de Design

| Decisão | Escolha | Motivo |
|---|---|---|
| Aviso SAND-01 bloqueante vs. informativo | Informativo (não bloqueia o save) | Análise histórica de mês específico no dashboard mensal é caso de uso válido; forçar `current_month` seria paternalista |
| Auto-sugestão de nome sempre vs. flag dirty | Flag `nameDirty` | Evita sobrescrever texto enquanto o usuário digita; respeita intenção editorial |
| Preview month state em `SandboxPage` vs. `SandboxControls` | Em `SandboxPage` | `SandboxPage` é o orquestrador de `runQuery`; manter em `SandboxControls` exigiria callback ascendente extra |
| `generateAnalysisName` em `sandbox-name.ts` vs. `sandbox.ts` | Arquivo separado `sandbox-name.ts` | `sandbox.ts` é schema Zod; funções de formatação de UI têm responsabilidade diferente |
| Modo edição tracking em `SandboxPage` vs. `SavedAnalysisList` | Em `SandboxPage` como `activeAnalysisId` state | O load já passa pelo `handleLoad` de `SandboxPage`; centralizar evita estado duplicado |

---

## 7. Referências Técnicas

| Item | Arquivo(s) a tocar |
|---|---|
| SAND-01 (aviso + callback) | `src/components/dashboards/sandbox/SavedAnalysisList.tsx` |
| SAND-02 (sugestão de nome) | `src/components/dashboards/sandbox/SavedAnalysisList.tsx` · `src/lib/sandbox-name.ts` _(novo)_ |
| SAND-03 (modo edição) | `src/components/dashboards/sandbox/SavedAnalysisList.tsx` · `src/components/dashboards/sandbox/SandboxPage.tsx` |
| SAND-04 (preview month) | `src/components/dashboards/sandbox/SandboxPage.tsx` |
| SAND-05 (metadados lista) | `src/components/dashboards/sandbox/SavedAnalysisList.tsx` · `src/lib/sandbox-name.ts` _(novo)_ |
| Mensagens novas | `src/lib/messages/pt-BR.ts` |
| (nenhuma migração de DB necessária) | — |

### Utilitário `sandbox-name.ts` (SAND-02, SAND-05)

```typescript
// src/lib/sandbox-name.ts

type MonthMeta = { id: string; label: string };
type Config = {
  periodType: string;
  year?: number;
  monthIds?: string[];
  metric: string;
  groupBy: string;
};

const METRIC_LABEL: Record<string, string> = {
  total: "Total",
  income: "Entradas",
  expense: "Saídas",
  count: "Transações",
  avg: "Média",
};

const GROUPBY_LABEL: Record<string, string> = {
  month: "Meses",
  section: "Seções",
  category: "Categorias",
  institution: "Instituições",
  table_type: "Tipos de Tabela",
};

function resolvePeriodLabel(config: Config, allMonths: MonthMeta[]): string {
  if (config.periodType === "year") return String(config.year ?? "");
  if (config.periodType === "last_3_months") return "Últ. 3 meses";
  if (config.periodType === "last_6_months") return "Últ. 6 meses";
  if (config.periodType === "current_month") return "Mês atual";
  if (config.periodType === "months" && config.monthIds?.length) {
    const found = allMonths.find((m) => m.id === config.monthIds![0]);
    return found?.label ?? "";
  }
  return "";
}

// Usado no campo de nome do formulário de salvar (SAND-02)
// Saída: "Total por Meses · 2026", "Saídas por Categorias · Mês atual"
export function generateAnalysisName(config: Config, allMonths: MonthMeta[]): string {
  const metric = METRIC_LABEL[config.metric] ?? config.metric;
  const groupBy = GROUPBY_LABEL[config.groupBy] ?? config.groupBy;
  const period = resolvePeriodLabel(config, allMonths);
  return period ? `${metric} por ${groupBy} · ${period}` : `${metric} por ${groupBy}`;
}

// Usado na linha secundária de cada item da lista (SAND-05)
// Saída: "2026 · Meses · Total", "Mês atual · Categorias · Saídas"
export function summarizeConfig(config: Config, allMonths: MonthMeta[]): string {
  const parts = [
    resolvePeriodLabel(config, allMonths),
    GROUPBY_LABEL[config.groupBy] ?? config.groupBy,
    METRIC_LABEL[config.metric] ?? config.metric,
  ].filter(Boolean);
  return parts.join(" · ");
}
```

### Aviso de incompatibilidade SAND-01

```tsx
// ✅ Correto — Alert informativo abaixo do ToggleButtonGroup de contexto
// SavedAnalysisList.tsx — novo prop: onConfigChange?: (config: SandboxConfig) => void

{(dashboardContext === "monthly" || dashboardContext === "both") &&
  currentConfig.periodType !== "current_month" && (
  <Alert
    severity="warning"
    sx={{ mt: 0.75, py: 0.5, "& .MuiAlert-message": { fontSize: "0.75rem" } }}
    action={
      <Button
        size="small"
        onClick={() => onConfigChange?.({ ...currentConfig, periodType: "current_month" })}
      >
        {ms.useDynamicMonth}
      </Button>
    }
  >
    {ms.monthlyPeriodWarning}
  </Alert>
)}

// ❌ Anti-padrão — não desabilitar o botão "Salvar" nem tornar a seleção obrigatória
```

### Modo de edição SAND-03

```tsx
// ✅ Correto — SandboxPage.tsx
const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null);

function handleLoad(cfg: SandboxConfig, analysisId: string) {
  setConfig(cfg);
  setActiveAnalysisId(analysisId);
  runQuery(cfg);
}

// SavedAnalysisList — props adicionados:
// activeAnalysisId: string | null
// onClearActiveAnalysis: () => void
// onConfigChange: (config: SandboxConfig) => void  ← também usado em SAND-01

// No formulário, quando activeAnalysisId !== null:
{activeAnalysisId ? (
  <>
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.75 }}>
      <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
        {ms.editingIndicator(activeAnalysisName)}
      </Typography>
      <IconButton size="small" aria-label={ms.discardEdit} onClick={onClearActiveAnalysis}>
        <CloseIcon sx={{ fontSize: 14 }} />
      </IconButton>
    </Box>
    <Button variant="contained" size="small" fullWidth onClick={handleUpdate}>
      {ms.updateAnalysis}
    </Button>
    <Button size="small" fullWidth onClick={() => { setActiveAnalysisId(null); }}>
      {ms.saveAsNew}
    </Button>
  </>
) : (
  <Button variant="contained" size="small" fullWidth onClick={handleSave}>
    {ms.saveAnalysis}
  </Button>
)}
```

### Seletor de prévia SAND-04

```tsx
// ✅ Correto — SandboxPage.tsx
const [previewMonthId, setPreviewMonthId] = useState<string>(
  allMonths[allMonths.length - 1]?.id ?? "",
);

// runQuery passa o previewMonthId quando periodType é current_month
const runQuery = useCallback(
  (cfg: SandboxConfig, overridePreviewMonthId?: string) => {
    const monthId =
      cfg.periodType === "current_month"
        ? (overridePreviewMonthId ?? previewMonthId)
        : undefined;
    startTransition(async () => {
      const res = await getSandboxDataClientAction(accountId, cfg, monthId);
      // ...
    });
  },
  [accountId, previewMonthId],
);

// No JSX da área do gráfico:
{config.periodType === "current_month" && (
  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
    <Typography variant="caption" color="text.secondary">
      {ms.previewForMonth}
    </Typography>
    <FormControl size="small">
      <Select
        value={previewMonthId}
        onChange={(e) => {
          setPreviewMonthId(e.target.value);
          runQuery(config, e.target.value);
        }}
        sx={{ fontSize: "0.8125rem", minWidth: 140 }}
      >
        {[...allMonths].reverse().map((m) => (
          <MenuItem key={m.id} value={m.id} sx={{ fontSize: "0.8125rem" }}>
            {m.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  </Box>
)}
```

### Metadados na lista SAND-05

```tsx
// ✅ Correto — Chip com label localizado
<Chip
  label={ms.context[a.dashboardContext]}   // "Dashboard mensal", não "monthly"
  size="small"
  variant="outlined"
  sx={{ height: 14, fontSize: "0.6rem", ...contextChipSx[a.dashboardContext] }}
/>

// ✅ ListItemText com linha secundária
<ListItemText
  primary={<Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>…</Box>}
  secondary={summarizeConfig(a.config, allMonths)}
  secondaryTypographyProps={{
    component: "span",
    sx: { fontSize: "0.7rem", color: "text.tertiary", display: "block", mt: 0.25 },
  }}
/>

// ❌ Anti-padrão — exibir valor raw da enum
<Chip label={a.dashboardContext} />  // exibe "monthly", "yearly", "both"
```

### Mensagens novas em `pt-BR.ts` (dentro de `m.dashboards.sandbox`)

```ts
monthlyPeriodWarning:
  "O dashboard mensal mostra o mês que está sendo visualizado. Para funcionar em qualquer mês, use 'Mês atual (dinâmico)'.",
useDynamicMonth: "Usar mês atual",
editingIndicator: (name: string) => `Editando: ${name}`,
discardEdit: "Descartar edição",
saveAsNew: "Salvar como novo",
previewForMonth: "Prévia para →",
```
