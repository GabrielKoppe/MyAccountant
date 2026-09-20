/**
 * Spec 69 §2.1 (APR-03) / §7.2 — densidade da tabela de transações.
 *
 * O contrato é: **enum no `TableType` → atributo `data-density` na raiz da
 * tabela → 3 variáveis CSS**. Os componentes leem `var(--row-h)`,
 * `var(--row-fs)` e `var(--ctrl-h)`; ninguém mede nem recalcula altura de linha
 * em JS (anti-padrão explícito da §7.2).
 *
 * As três variáveis são declaradas UMA vez, no `MuiCssBaseline` do tema
 * (`src/lib/theme.ts`), a partir de `densityGlobalStyles()` — este módulo é a
 * fonte única dos números.
 *
 * `Density` é declarado aqui (e não importado de `@/lib/schemas/settings`) pelo
 * mesmo motivo que `RowLayout` em `components/transactions/row-layout.ts`: este
 * módulo é consumido pelo tema e por componentes Client, e não deve arrastar o
 * bundle de schemas/Zod para essa fronteira. Os dois espelham o mesmo domínio —
 * se um valor entrar aqui, entra em `DENSITIES` de `schemas/settings.ts` junto.
 */

export const DENSITIES = ["compact", "default", "comfortable"] as const;
export type Density = (typeof DENSITIES)[number];

/** Densidade usada quando o tipo de tabela não tem valor válido gravado. */
export const DEFAULT_DENSITY: Density = "default";

export type DensityMetrics = {
  /** Altura da linha. Em `<tr>` o CSS trata `height` como MÍNIMO — o layout de
   *  pílulas (2 linhas) cresce naturalmente, o de colunas fica exatamente aqui. */
  rowHeight: string;
  /** Tamanho de fonte da célula. */
  fontSize: string;
  /** Altura dos controles da linha (botões de ação, campos de edição, gaveta). */
  controlHeight: string;
};

/** Nomes das 3 variáveis CSS — um lugar só, para não divergirem entre tema e componentes. */
export const DENSITY_CSS_VAR = {
  rowHeight: "--row-h",
  fontSize: "--row-fs",
  controlHeight: "--ctrl-h",
} as const;

/**
 * Escala recalibrada pelo usuário em 2026-08-11, **substituindo** o 28/36/44 do
 * frame 05 (§2.1/§7.2). O motivo foi a medição da tabela real: ela nunca teve
 * 36px — mede **52,5px / 13px / 30px** hoje. Manter o frame teria encolhido a
 * linha de todo mundo em 31% de uma vez, já que o P0 gravou `default` em todos
 * os tipos existentes.
 *
 * - `compact` **36px** é o piso aceito; abaixo disso a linha fica apertada demais.
 * - `default` **44px** é o meio-termo, e é o que todo tipo existente tem. A
 *   mudança visível ao abrir o mês cai de −16,5px para −8,5px.
 * - `comfortable` **52px / 13px / 30px** é **clone exato da medida de hoje** —
 *   quem não quiser mudança nenhuma tem um nome para escolher. É por isso que a
 *   fonte aqui é `0.8125rem`, e não um degrau acima.
 *
 * **Nesta escala quem varia é o respiro vertical, não o texto.** `default` e
 * `comfortable` compartilham `0.8125rem` (= 13px, a fonte de sempre) de
 * propósito: três tamanhos de fonte numa tabela de NÚMEROS faria os valores
 * "pularem" de tamanho ao trocar de densidade — pior que o degrau que se
 * ganharia. `compact` é a única exceção, e só porque em 36px o texto de 13px
 * encosta nas bordas.
 */
export const DENSITY_METRICS: Record<Density, DensityMetrics> = {
  compact: { rowHeight: "36px", fontSize: "0.78rem", controlHeight: "26px" },
  default: { rowHeight: "44px", fontSize: "0.8125rem", controlHeight: "28px" },
  comfortable: { rowHeight: "52px", fontSize: "0.8125rem", controlHeight: "30px" },
};

/**
 * As 3 variáveis CSS de uma densidade, prontas para virar `sx`/`style`. Usado
 * pelo tema (blocos `[data-density=...]`) e por qualquer superfície que precise
 * fixar a densidade localmente (ex.: a pré-visualização do P3, que não vive
 * dentro de uma tabela real).
 */
export function densityCssVars(density: Density): Record<string, string> {
  const metrics = DENSITY_METRICS[density];
  return {
    [DENSITY_CSS_VAR.rowHeight]: metrics.rowHeight,
    [DENSITY_CSS_VAR.fontSize]: metrics.fontSize,
    [DENSITY_CSS_VAR.controlHeight]: metrics.controlHeight,
  };
}

/** Os 3 blocos `[data-density=...]` — declaração global única (tema). */
export function densityGlobalStyles(): Record<string, Record<string, string>> {
  return Object.fromEntries(
    DENSITIES.map((density) => [`[data-density="${density}"]`, densityCssVars(density)]),
  );
}

/**
 * O que os componentes consomem. O fallback dentro do `var()` é o valor de
 * `default`: uma linha renderizada fora de um contêiner com `data-density`
 * (teste isolado, storybook, preview) não desaba.
 */
export const DENSITY_VAR = {
  rowHeight: `var(${DENSITY_CSS_VAR.rowHeight}, ${DENSITY_METRICS.default.rowHeight})`,
  fontSize: `var(${DENSITY_CSS_VAR.fontSize}, ${DENSITY_METRICS.default.fontSize})`,
  controlHeight: `var(${DENSITY_CSS_VAR.controlHeight}, ${DENSITY_METRICS.default.controlHeight})`,
} as const;

const DENSITY_SET: ReadonlySet<string> = new Set<string>(DENSITIES);

/** Leitura tolerante do campo `density` do banco / de props serializadas. */
export function parseDensity(raw: unknown): Density {
  return typeof raw === "string" && DENSITY_SET.has(raw) ? (raw as Density) : DEFAULT_DENSITY;
}
