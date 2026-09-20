import type { WidgetDef, WidgetSizeVariant } from "./widget-registry";

// ─────────────────────────────────────────────────────────────────────────────
// Spec 69 §2.3 / APR-07 — Matriz tamanho → visualização (tela 07b).
//
// Módulo PURO (sem React, sem MUI): é a fonte única de "qual visualização este
// widget mostra em cada largura". A UI (inspetor, paleta, canvas) só lê daqui.
//
// ── Como isto se encaixa no modelo que já existe (D1) ────────────────────────
// O editor de grade das Specs 33/36/38 não tem um conceito de "visualização":
// cada `WidgetSizeVariant` declara um `renderMode` (string opaca) e é ele que
// a página real consome (`getRenderMode`). Portanto:
//
//   **visualização == renderMode**.
//
// A matriz de 07b é a projeção "quais renderModes são válidos em cada largura".
// `WidgetDef.viz` apenas dá NOME (e um mínimo de colunas) a esses renderModes;
// quando ausente, a matriz é DERIVADA das próprias `sizeVariants` — um widget
// com um único renderMode tem uma visualização só, e isso está correto.
//
// ── Conversão da tabela normativa 07b (grid de 12) para as 6 colunas (D1) ────
// O frame desenha um grid de 12 colunas; este projeto tem 6 e as mantém (D1).
// A conversão usada nas declarações abaixo e no §11.3 da spec é:
//
//   frame  3 col →  2 col
//   frame  4 col →  2 col
//   frame  6 col →  3 col
//   frame  8 col →  4 col
//   frame 12 col →  6 col
//
// Matriz 07b convertida (minCols na escala de 6):
//
//   | Visualização         | frame | aqui |
//   |----------------------|-------|------|
//   | Medidor único        |  3    |  2   |
//   | Barras de progresso  |  4    |  2   |
//   | Rosca com legenda    |  6    |  3   |
//   | Tabela compacta      |  4    |  2   |
//   | Linha temporal       |  6 ⚠  |  3 ⚠ |  (⚠ = aceita com dados reduzidos)
//   | Mapa de calor        | 12    |  6   |
//
// ⚠ INVARIANTE: `minCols` de uma visualização nunca pode ser maior que a menor
// variante que a produz — senão a visualização ficaria inalcançável. Quando o
// mínimo do frame é maior que a variante real, **a variante real manda** (D1:
// "larguras seguem as variantes de cada widget"). É por isso que, por exemplo,
// a rosca dos widgets de pizza entra com `minCols: 2` (variante `compact` 2×2)
// e não com os 3 da tabela acima.
// ─────────────────────────────────────────────────────────────────────────────

/** Chaves de visualização do frame 07b — rótulos em `m.settings.presentation.dashboards.viz`. */
export type VizKey =
  | "gauge"
  | "progressBars"
  | "donut"
  | "table"
  | "line"
  | "heatmap"
  | "bars"
  | "list";

export type WidgetVizEntry = {
  /** renderMode canônico desta visualização (o que a página real recebe). */
  renderMode: string;
  /** Menor largura (em colunas de 6) em que a visualização é legível. */
  minCols: number;
  /** true = na largura mínima ela funciona, mas com dados reduzidos (⚠ do 07b). */
  reduced?: boolean;
  /**
   * **Eixo de configuração.** Nos widgets em que quem troca o desenho é
   * `config.chartType` (rosca ↔ barras), e não o tamanho, a visualização é
   * escolhida gravando este valor no config da instância. Um widget é
   * "config-driven" quando QUALQUER entrada declara `chartType` — nesse caso o
   * renderMode continua sendo só o preset de densidade.
   */
  chartType?: string;
};

/**
 * Mapa declarado no `WidgetDef`. `Partial` porque nenhum widget suporta as seis
 * visualizações — declarar só as que o componente realmente renderiza.
 */
export type WidgetVizMap = Partial<Record<VizKey, WidgetVizEntry>>;

/**
 * Visualização já resolvida (declarada ou derivada das variantes).
 * `key` é uma `VizKey` quando declarada; quando derivada, é o próprio renderMode.
 */
export type ResolvedViz = {
  key: string;
  renderMode: string;
  minCols: number;
  reduced: boolean;
  /** true = veio de `def.viz` (tem rótulo em `m…dashboards.viz`). */
  declared: boolean;
  /**
   * Chave de rótulo. Declarada → a própria `VizKey`. Derivada → o `labelKey` da
   * variante que produz o renderMode (`m.settings.dashboards.variants`), que é
   * como o usuário já lê aquele modo no bloco "Tamanho".
   */
  labelKey: string;
  /** Valor de `config.chartType` desta visualização, quando o eixo é o config. */
  chartType?: string;
  /** Ordem de declaração — critério de desempate estável. */
  index: number;
};

export type VizState = "ok" | "reduced" | "unavailable";

export type VizAvailability = {
  viz: ResolvedViz;
  state: VizState;
  /** Motivo do indisponível — sempre visível na UI, nunca escondido (§7.3). */
  reason: { kind: "needsColumns"; cols: number } | { kind: "onlyAtSize"; size: string } | null;
};

export type VizPick = {
  /** Visualização em vigor no tamanho pedido. `null` só se o widget não tiver variantes. */
  viz: string | null;
  changed: boolean;
  /** Motivo da troca. Hoje só existe um: o tamanho escolhido. */
  reason: "size" | null;
};

type Size = { w: number; h: number };

// ─── Resolução da matriz ─────────────────────────────────────────────────────

/**
 * Lista de visualizações do widget, em ordem de declaração.
 *
 * 1. `def.viz` declarado → uma entrada por chave declarada.
 * 2. KPI sem `viz` → medidor único (regra única, evita repetir a mesma
 *    declaração em ~25 defs de KPI que compartilham `KPI_VARIANTS`).
 * 3. Caso geral → uma entrada por renderMode distinto das `sizeVariants`,
 *    com `minCols` = menor largura que produz aquele renderMode.
 */
export function resolveVizOptions(def: WidgetDef): ResolvedViz[] {
  if (def.viz) {
    return Object.entries(def.viz).map(([key, entry], index) => ({
      key,
      renderMode: entry!.renderMode,
      minCols: entry!.minCols,
      reduced: entry!.reduced === true,
      declared: true,
      labelKey: key,
      chartType: entry!.chartType,
      index,
    }));
  }

  if (def.sizeVariants.length === 0) return [];

  if (def.kind === "kpi") {
    const first = def.sizeVariants[0];
    const minCols = Math.min(...def.sizeVariants.map((v) => v.w));
    return [
      {
        key: "gauge" satisfies VizKey,
        renderMode: first.renderMode,
        minCols,
        reduced: false,
        declared: true,
        labelKey: "gauge" satisfies VizKey,
        index: 0,
      },
    ];
  }

  const byRenderMode = new Map<string, { minCols: number; labelKey: string }>();
  for (const v of def.sizeVariants) {
    const current = byRenderMode.get(v.renderMode);
    byRenderMode.set(v.renderMode, {
      minCols: current === undefined ? v.w : Math.min(current.minCols, v.w),
      labelKey: current?.labelKey ?? v.labelKey,
    });
  }
  return [...byRenderMode.entries()].map(([renderMode, { minCols, labelKey }], index) => ({
    key: renderMode,
    renderMode,
    minCols,
    reduced: false,
    declared: false,
    labelKey,
    index,
  }));
}

/** Visualização default do widget: a declarada em `defaultViz`, senão a primeira. */
export function defaultVizKey(def: WidgetDef): string | null {
  const options = resolveVizOptions(def);
  if (options.length === 0) return null;
  if (def.defaultViz) {
    const declared = options.find((o) => o.key === def.defaultViz);
    if (declared) return declared.key;
  }
  return options[0].key;
}

function pickForRenderMode(
  options: ResolvedViz[],
  renderMode: string,
  width: number,
): ResolvedViz | null {
  if (options.length === 0) return null;
  const exact = options.find((o) => o.renderMode === renderMode);
  if (exact) return exact;
  // renderMode sem entrada própria (ex.: a variante `large` de um gráfico de
  // pizza continua sendo uma rosca): herda a visualização declarada mais rica
  // que ainda cabe nessa largura.
  const fits = options.filter((o) => o.minCols <= width);
  const pool = fits.length > 0 ? fits : options;
  return [...pool].sort((a, b) => b.minCols - a.minCols || a.index - b.index)[0];
}

/** Visualização que uma variante produz — `renderMode` é a fonte da verdade. */
export function vizKeyForVariant(def: WidgetDef, variant: WidgetSizeVariant): string | null {
  return pickForRenderMode(resolveVizOptions(def), variant.renderMode, variant.w)?.key ?? null;
}

/** Visualização em vigor numa instância salva (a da sua variante atual). */
export function vizKeyForSizeVariantId(def: WidgetDef, sizeVariantId: string): string | null {
  const variant =
    def.sizeVariants.find((v) => v.id === sizeVariantId) ?? def.sizeVariants[0] ?? null;
  return variant ? vizKeyForVariant(def, variant) : null;
}

/**
 * Eixo da visualização deste widget:
 * - `"config"` — quem troca o desenho é `config.chartType` (rosca ↔ barras);
 *   o tamanho só decide o que é legível.
 * - `"variant"` — o desenho vem do `renderMode` da variante (caso geral).
 */
export function vizAxis(def: WidgetDef): "config" | "variant" {
  return resolveVizOptions(def).some((o) => o.chartType !== undefined) ? "config" : "variant";
}

function readChartType(config: unknown): string | undefined {
  if (config && typeof config === "object" && "chartType" in config) {
    const value = (config as { chartType?: unknown }).chartType;
    if (typeof value === "string") return value;
  }
  return undefined;
}

/**
 * Visualização em vigor numa instância — o único ponto que a UI deve consultar.
 * Consulta o config quando o eixo é o config, e a variante no caso geral.
 */
export function currentVizKey(
  def: WidgetDef,
  instance: { sizeVariantId: string; config?: unknown },
): string | null {
  if (vizAxis(def) === "config") {
    const chartType = readChartType(instance.config) ?? readChartType(def.defaultConfig);
    const match = resolveVizOptions(def).find((o) => o.chartType === chartType);
    return match?.key ?? defaultVizKey(def);
  }
  return vizKeyForSizeVariantId(def, instance.sizeVariantId);
}

/**
 * Config da instância com a visualização aplicada (eixo config). Devolve o
 * config original quando a visualização não é do eixo config — quem manda ali
 * é a variante, e mexer no config seria efeito colateral silencioso.
 */
export function configWithViz(def: WidgetDef, config: unknown, vizKey: string): unknown {
  const option = resolveVizOptions(def).find((o) => o.key === vizKey);
  if (!option?.chartType) return config;
  const base =
    config && typeof config === "object"
      ? (config as Record<string, unknown>)
      : ((def.defaultConfig as Record<string, unknown> | undefined) ?? {});
  return { ...base, chartType: option.chartType };
}

/**
 * Variante a aplicar quando o usuário escolhe uma visualização no inspetor:
 * entre as variantes que produzem essa visualização, a mais próxima do tamanho
 * atual (distância de Manhattan) — trocar de visualização não deve teletransportar
 * o widget para outro tamanho sem necessidade.
 */
export function variantForViz(
  def: WidgetDef,
  vizKey: string,
  currentSize: Size,
): WidgetSizeVariant | null {
  const candidates = def.sizeVariants.filter((v) => vizKeyForVariant(def, v) === vizKey);
  if (candidates.length === 0) return null;
  return [...candidates].sort(
    (a, b) =>
      Math.abs(a.w - currentSize.w) +
      Math.abs(a.h - currentSize.h) -
      (Math.abs(b.w - currentSize.w) + Math.abs(b.h - currentSize.h)),
  )[0];
}

/**
 * Estado de cada visualização num tamanho: aceita · aceita com dados reduzidos ·
 * indisponível **com o motivo**. É o que o inspetor mostra (07b, §7.3): a opção
 * inválida aparece desabilitada e explicada, nunca some da lista.
 */
export function vizAvailabilityAt(def: WidgetDef, size: Size): VizAvailability[] {
  const options = resolveVizOptions(def);
  const configDriven = vizAxis(def) === "config";
  return options.map((viz) => {
    // Eixo config: a visualização não está presa a nenhuma variante — só a
    // largura mínima decide. Falar em "só em 3×3" aqui seria falso.
    if (configDriven) {
      if (viz.minCols > size.w) {
        return {
          viz,
          state: "unavailable" as const,
          reason: { kind: "needsColumns" as const, cols: viz.minCols },
        };
      }
      if (viz.reduced && size.w <= viz.minCols) {
        return { viz, state: "reduced" as const, reason: null };
      }
      return { viz, state: "ok" as const, reason: null };
    }
    const sizes = def.sizeVariants.filter((v) => vizKeyForVariant(def, v) === viz.key);
    // Visualização que só existe num tamanho exato (ex.: medidor 1×1): fora dele
    // o motivo é "só em 1×1", mais útil que "precisa de N colunas".
    const single =
      sizes.length > 0 && sizes.every((v) => v.w === sizes[0].w && v.h === sizes[0].h)
        ? sizes[0]
        : null;

    // 1. Estreito demais — o motivo do 07b ("precisa de N colunas").
    if (viz.minCols > size.w) {
      return {
        viz,
        state: "unavailable" as const,
        reason: { kind: "needsColumns" as const, cols: viz.minCols },
      };
    }
    // 2/3. Cabe na largura, mas nenhuma variante entrega esta visualização NESTE
    // tamanho — dizer o tamanho em que ela existe é mais útil que só desabilitar.
    const nearest =
      single ??
      (sizes.some((v) => v.w === size.w)
        ? null
        : [...sizes].sort(
            (a, b) =>
              Math.abs(a.w - size.w) +
              Math.abs(a.h - size.h) -
              (Math.abs(b.w - size.w) + Math.abs(b.h - size.h)),
          )[0]);
    if (nearest && (nearest.w !== size.w || nearest.h !== size.h)) {
      return {
        viz,
        state: "unavailable" as const,
        reason: { kind: "onlyAtSize" as const, size: `${nearest.w}×${nearest.h}` },
      };
    }
    // 4. Disponível — reduzida quando está na sua largura mínima declarada.
    if (viz.reduced && size.w <= viz.minCols) {
      return { viz, state: "reduced" as const, reason: null };
    }
    return { viz, state: "ok" as const, reason: null };
  });
}

/**
 * Qual visualização fica em vigor ao levar o widget para `nextSize`, e se isso
 * é uma TROCA em relação à atual (`currentViz`).
 *
 * Ordem das regras:
 * 1. **A geometria manda.** Se existe uma variante exatamente com esse tamanho,
 *    a visualização é a que ela renderiza — é o `renderMode` que a página real
 *    consome, então qualquer outra resposta seria mentira.
 * 2. Sem variante exata (ex.: o inspetor perguntando "e se fosse 2 col?"): a
 *    atual permanece se couber na largura; senão, a válida mais próxima — a mais
 *    rica que ainda cabe (maior `minCols`), desempatando pela ordem de declaração.
 *
 * Nunca troca em silêncio: quem chama avisa por snackbar quando `changed`.
 */
export function pickNearestValidViz(
  def: WidgetDef,
  nextSize: Size,
  currentViz: string | null,
): VizPick {
  const options = resolveVizOptions(def);
  if (options.length === 0) return { viz: null, changed: false, reason: null };

  // No eixo config a geometria NÃO manda: todas as variantes desenham o mesmo
  // renderMode, e quem escolhe rosca ou barras é o config. Vale só a matriz.
  const exactVariant =
    vizAxis(def) === "config"
      ? undefined
      : def.sizeVariants.find((v) => v.w === nextSize.w && v.h === nextSize.h);
  const byGeometry = exactVariant
    ? pickForRenderMode(options, exactVariant.renderMode, exactVariant.w)
    : null;

  let chosen = byGeometry;
  if (!chosen) {
    const valid = options.filter((o) => o.minCols <= nextSize.w);
    chosen =
      (currentViz ? valid.find((o) => o.key === currentViz) : undefined) ??
      [...valid].sort((a, b) => b.minCols - a.minCols || a.index - b.index)[0] ??
      options[0];
  }

  const changed = currentViz != null && chosen.key !== currentViz;
  return { viz: chosen.key, changed, reason: changed ? "size" : null };
}
