/**
 * Auditoria de contraste WCAG 2.x dos pares texto/fundo do design system.
 *
 * Roda contra os TOKENS REAIS (`src/lib/design-tokens.ts`) — nao ha hex
 * duplicado aqui, exceto a referencia historica declarada em `LEGACY` abaixo,
 * que existe so para imprimir a coluna "antes".
 *
 *   docker compose exec app pnpm exec tsx scripts/contrast-audit.ts
 *
 * A guarda permanente e o teste `src/lib/theme-contrast.test.ts`; este script
 * e a ferramenta de inspecao (mostra a tabela inteira, inclusive pares fora do
 * escopo travado pelo teste).
 */
import { contrastRatio, WCAG_AA_LARGE_TEXT, WCAG_AA_NORMAL_TEXT } from "../src/lib/contrast";
import {
  darkColors,
  lightColors,
  type ColorTokens,
  type ThemeMode,
} from "../src/lib/design-tokens";

/**
 * Valores ANTERIORES a esta correcao, usados apenas para a coluna "antes".
 * `main`/`subtle` nao mudaram, entao o par antigo dos tons de estado e
 * reconstruido dos tokens vivos; so `text.tertiary` (dark) precisou do valor
 * historico.
 */
const LEGACY = {
  darkTextTertiary: "#8B847A",
} as const;

type Row = {
  pair: string;
  before: { fg: string; bg: string };
  after: { fg: string; bg: string };
  min: number;
};

function rows(c: ColorTokens, mode: ThemeMode): Row[] {
  const tones = ["success", "warning", "danger"] as const;

  return [
    ...tones.map((tone) => ({
      pair: `StatusBadge ${tone} — texto sobre ${tone}.subtle`,
      before: { fg: c[tone].main, bg: c[tone].subtle },
      after: { fg: c[tone].onSubtle, bg: c[tone].subtle },
      min: WCAG_AA_NORMAL_TEXT,
    })),
    {
      pair: "StatusBadge neutral — texto sobre neutral.subtle",
      before: { fg: c.text.secondary, bg: c.neutral.subtle },
      after: { fg: c.neutral.onSubtle, bg: c.neutral.subtle },
      min: WCAG_AA_NORMAL_TEXT,
    },
    {
      pair: "text.tertiary sobre background.surface",
      before: {
        fg: mode === "dark" ? LEGACY.darkTextTertiary : c.text.tertiary,
        bg: c.background.surface,
      },
      after: { fg: c.text.tertiary, bg: c.background.surface },
      min: WCAG_AA_NORMAL_TEXT,
    },
    // Fora do escopo da correcao — impressos para vigilancia.
    ...tones.map((tone) => ({
      pair: `(icone/borda) ${tone}.main sobre ${tone}.subtle`,
      before: { fg: c[tone].main, bg: c[tone].subtle },
      after: { fg: c[tone].main, bg: c[tone].subtle },
      min: WCAG_AA_LARGE_TEXT,
    })),
    {
      pair: "(fora de escopo) accent.primary sobre accent.primarySubtle",
      before: { fg: c.accent.primary, bg: c.accent.primarySubtle },
      after: { fg: c.accent.primary, bg: c.accent.primarySubtle },
      min: WCAG_AA_NORMAL_TEXT,
    },
    {
      pair: "(fora de escopo) text.secondary sobre warning.subtle",
      before: { fg: c.text.secondary, bg: c.warning.subtle },
      after: { fg: c.text.secondary, bg: c.warning.subtle },
      min: WCAG_AA_NORMAL_TEXT,
    },
    {
      pair: "(fora de escopo) text.tertiary sobre background.subtle",
      before: {
        fg: mode === "dark" ? LEGACY.darkTextTertiary : c.text.tertiary,
        bg: c.background.subtle,
      },
      after: { fg: c.text.tertiary, bg: c.background.subtle },
      min: WCAG_AA_NORMAL_TEXT,
    },
  ];
}

function fmt(ratio: number, min: number) {
  return `${ratio.toFixed(2).padStart(5)}:1 ${ratio >= min ? "OK " : "FALHA"}`;
}

let failures = 0;

for (const [mode, c] of [
  ["light", lightColors],
  ["dark", darkColors],
] as const) {
  console.log(`\n===== MODO ${mode.toUpperCase()} =====`);
  console.log(
    "par".padEnd(58) + "min   antes".padEnd(28) + "depois".padEnd(28) + "cores (antes -> depois)",
  );

  for (const row of rows(c, mode)) {
    const before = contrastRatio(row.before.fg, row.before.bg);
    const after = contrastRatio(row.after.fg, row.after.bg);
    const inScope = !row.pair.startsWith("(");
    if (inScope && after < row.min) failures++;

    console.log(
      row.pair.padEnd(58) +
        String(row.min).padEnd(6) +
        fmt(before, row.min).padEnd(22) +
        fmt(after, row.min).padEnd(22) +
        `${row.before.fg} sobre ${row.before.bg} -> ${row.after.fg} sobre ${row.after.bg}`,
    );
  }
}

console.log(
  failures === 0
    ? "\nTodos os pares em escopo passam o minimo."
    : `\n${failures} par(es) em escopo abaixo do minimo.`,
);
process.exit(failures === 0 ? 0 : 1);
