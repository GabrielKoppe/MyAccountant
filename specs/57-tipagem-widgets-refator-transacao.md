# Spec 57 — Tipagem de Widgets e Refator de Transação

> Status: draft
> Insumo: revisão de código em `src/components/dashboards/_core/` e `src/components/transactions/` (2026-06-29)
> Skills: [`dashboard-widgets`](../skills/dashboard-widgets/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md)

---

## 1. Problema

- **DEBT-01**: O registro de widgets é fracamente tipado. Em `src/components/dashboards/_core/widget-registry.ts:33`, `WidgetSizeVariant.renderMode` é `string` — "string opaca passada como prop ao componente" (comentário no próprio código). Em `:57-58`, `WidgetDef.configSchema` é `z.ZodTypeAny` e `defaultConfig` é `unknown`; e em `src/lib/schemas/dashboard-layout.ts:20` o `config` do `StoredWidget` é `z.unknown().optional()`. Como a config de cada widget não tem um tipo discriminado por `type`/`id`, o componente que recebe a config faz casts e os erros de configuração só aparecem em **runtime** — esse padrão se espalha pelos componentes de widget (ex.: callbacks de recharts tipados como `any` em `src/components/dashboards/panels/MemberBreakdownChart.tsx:158,160` e `MemberRadarWidget.tsx:240,284`).
- **DEBT-02**: Os componentes de transação são grandes e duplicam lógica. `src/components/transactions/TransactionRowEditor.tsx` (840 linhas), `TransactionTable.tsx` (690), `TransactionRow.tsx` (579) e `NewTransactionRow.tsx` (539) repetem validação e formatação. Concretamente, `TransactionRowEditor.tsx:39` e `NewTransactionRow.tsx:30` importam separadamente `reaisToCents`/`centsToReais`, cada um mantém seu próprio `useState` para os mesmos campos (`amountCents`, `description`, `expenseType`, `notes`, FX) e reimplementa o cálculo de `exchangeRate` (`TransactionRowEditor.tsx:125-131`). Não existe `src/lib/validators/transaction.ts` — a validação está espalhada por componente.

---

## 2. Solução

### 2.1 Tipos discriminados por `type` para widgets (DEBT-01)

- Definir uma interface base genérica `Widget<TConfig>` e uma **union discriminada** por `type` (ou `id`), onde cada variante amarra seu `configSchema` (Zod) ao seu tipo de config inferido (`z.infer`). O `renderMode` passa de `string` para um union literal por widget (ex.: `"default" | "compact" | "expanded"`), eliminando a "string opaca".
- `WidgetDef.defaultConfig` deixa de ser `unknown` e passa a ser tipado por `TConfig` da variante; `StoredWidget.config` passa a ser validado e tipado contra o `configSchema` do widget (não mais `z.unknown()`).
- Os componentes de widget recebem props tipadas a partir da union; os callbacks de recharts tipados como `any` recebem os tipos corretos do recharts ou tipos locais explícitos.

### 2.2 Extração de lógica compartilhada de transação (DEBT-02)

- Criar o hook **`useTransactionEditor()`** que centraliza o estado de edição (campos, FX, cálculo de `exchangeRate`) hoje duplicado entre `TransactionRowEditor.tsx` e `NewTransactionRow.tsx`.
- Extrair um **componente de célula reutilizável** para os campos repetidos (valor, descrição, categoria, responsável) usado por ambas as linhas.
- Criar **`src/lib/validators/transaction.ts`** como ponto único de validação/derivação (ex.: validação de valor, derivação de `exchangeRate` a partir de `amountCents` + `originalAmountCents`), reusando os schemas Zod existentes (skill `forms-zod-rhf`).
- Componentes grandes encolhem ao consumir o hook + o validador + a célula compartilhada, sem mudança de comportamento de UI.

---

## 3. User Stories

- Como desenvolvedor, quero que a config de cada widget seja tipada por `type`, para que um campo de config errado seja erro de compilação e não bug em runtime.
- Como desenvolvedor, quero `renderMode` como union literal por widget, para o editor não autocompletar `"compact"` num widget que não suporta.
- Como desenvolvedor, quero um `useTransactionEditor()` e um validador único, para corrigir uma regra de validação num lugar só em vez de em quatro componentes.
- Como mantenedor, quero `TransactionRowEditor` e `NewTransactionRow` menores e sem lógica duplicada, para reduzir o risco de divergência entre criar e editar.

---

## 4. Critérios de Aceitação

**DEBT-01:**
- O registro de widgets DEVE expor uma union discriminada por `type` com `configSchema` e config tipados; `WidgetDef.defaultConfig` NÃO DEVE permanecer `unknown`.
- `StoredWidget.config` DEVE ser tipado/validado contra o `configSchema` do widget, NÃO DEVE permanecer `z.unknown().optional()`.
- `WidgetSizeVariant.renderMode` DEVE ser um union de literais por widget, NÃO DEVE ser `string`.
- QUANDO um componente de widget recebe sua config, ELE NÃO DEVE precisar de `as any` para lê-la.
- Os callbacks de recharts hoje tipados como `any` (`MemberBreakdownChart.tsx`, `MemberRadarWidget.tsx`) DEVEM receber um tipo explícito.

**DEBT-02:**
- `useTransactionEditor()` DEVE existir e ser consumido por `TransactionRowEditor.tsx` e `NewTransactionRow.tsx`; nenhum dos dois DEVE manter cópia própria do cálculo de `exchangeRate`.
- `src/lib/validators/transaction.ts` DEVE existir e centralizar a validação/derivação de valor e FX.
- O comportamento de criação e edição de transação NÃO DEVE mudar para o usuário final (mesma UI, mesmos resultados).
- A célula reutilizável DEVE ser usada por ambas as linhas para os campos comuns.

---

## 5. Fora de Escopo

- Eliminar **todas** as ~361 ocorrências de `any` do projeto — esta spec foca no registro de widgets e nos componentes de transação citados.
- Redesenhar a UI das transações ou dos widgets — é refator interno, sem mudança visual.
- Migrar o sistema de layout de dashboard (specs 36/38) para outra estrutura.
- Alterar os schemas Zod de transação em `src/lib/schemas/` além do necessário para extrair o validador.
- Adicionar novos widgets ou novos campos de transação.

---

## 6. Decisões de Design

| ID | Decisão | Escolha | Motivo |
|---|---|---|---|
| DD-01 | Tipagem de widgets | Union discriminada `Widget<TConfig>` por `type` | TypeScript estreita a config pelo `type`; erros viram tempo de compilação |
| DD-02 | `renderMode` | Union de literais por widget | Remove a "string opaca" e habilita autocomplete correto |
| DD-03 | Lógica de transação | Hook `useTransactionEditor()` + validador único + célula compartilhada | Fonte única; encolhe os 4 componentes sem mudar UX |

---

## 7. Referências Técnicas

| Item | Arquivo(s) a tocar |
|---|---|
| Registro/tipos de widgets | `src/components/dashboards/_core/widget-registry.ts` |
| Config do widget armazenado | `src/lib/schemas/dashboard-layout.ts` |
| Callbacks recharts `any` | `src/components/dashboards/panels/MemberBreakdownChart.tsx` · `MemberRadarWidget.tsx` |
| Hook de edição | `src/components/transactions/useTransactionEditor.ts` (novo) |
| Validador | `src/lib/validators/transaction.ts` (novo) |
| Célula reutilizável | `src/components/transactions/TransactionCell.tsx` (novo) |
| Linhas consumidoras | `TransactionRowEditor.tsx` · `NewTransactionRow.tsx` · `TransactionRow.tsx` |

```ts
// ❌ Hoje (widget-registry.ts:33,57-58 + dashboard-layout.ts:20) — fracamente tipado
export type WidgetSizeVariant = { renderMode: string; /* ... */ };
export type WidgetDef = { configSchema?: z.ZodTypeAny; defaultConfig?: unknown; /* ... */ };
// StoredWidget: config: z.unknown().optional()
// componente faz: const cfg = stored.config as CategoryBreakdownConfig; // cast cego

// ✅ Union discriminada por type — config e renderMode amarrados ao widget
type CategoryBreakdownConfig = z.infer<typeof categoryBreakdownConfigSchema>;

interface Widget<TConfig, TRenderMode extends string> {
  type: string;
  configSchema: z.ZodType<TConfig>;
  defaultConfig: TConfig;
  variants: { id: string; renderMode: TRenderMode; w: number; h: number }[];
}

type AnyWidget =
  | Widget<CategoryBreakdownConfig, "default" | "compact" | "expanded">
  | Widget<MemberBreakdownConfig, "default" | "compact">;
// ... discriminado por `type`; o componente recebe a config já estreitada, sem `as any`
```
