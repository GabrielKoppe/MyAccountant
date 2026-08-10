/**
 * Design Tokens — MyAccountant
 *
 * Fonte unica de tokens do design system "Warm Calm".
 * Inspiracao: Notion, Things 3, Linear (versao warm).
 *
 * Principios:
 *  - Tokens semanticos (background.canvas, nao #FAFAF7).
 *  - Cores quentes desaturadas, off-white em vez de branco puro.
 *  - Bordas em vez de sombras.
 *  - Hierarquia por tipografia e espaco, nao por cor.
 *
 * Ver: skills/design-system/SKILL.md
 */

// ============================================================================
// CORES — LIGHT MODE
// ============================================================================

export const lightColors = {
  background: {
    canvas: "#FAFAF7",
    surface: "#FFFFFF",
    subtle: "#F5F4F0",
    muted: "#EDEBE5",
  },
  border: {
    subtle: "#E8E5DE",
    default: "#D8D3C7",
    strong: "#B8B1A0",
    focus: "#4E5FD9",
  },
  text: {
    primary: "#1A1815",
    secondary: "#4A453C",
    tertiary: "#7A7368",
    disabled: "#B8B1A0",
    inverse: "#FAFAF7",
  },
  accent: {
    primary: "#4E5FD9",
    primaryHover: "#3D4DC4",
    primarySubtle: "#EAEDFB",
  },
  success: { main: "#4B7F52", subtle: "#E8F0E9" },
  warning: { main: "#B8862A", subtle: "#F5EDD5" },
  danger: { main: "#B54545", subtle: "#F5E4E4" },
  neutral: { main: "#7A7368", subtle: "#EDEBE5" },
} as const;

// ============================================================================
// CORES — DARK MODE (Sepia Escuro)
// ============================================================================

export const darkColors = {
  background: {
    canvas: "#1A1815",
    surface: "#221F1B",
    subtle: "#2A2620",
    muted: "#322D26",
  },
  border: {
    subtle: "#322D26",
    default: "#44403A",
    strong: "#5C574E",
    focus: "#7E8DE5",
  },
  text: {
    primary: "#F0EDE5",
    secondary: "#C4BDB0",
    tertiary: "#8B847A",
    disabled: "#5C574E",
    inverse: "#1A1815",
  },
  accent: {
    primary: "#7E8DE5",
    primaryHover: "#94A1EC",
    primarySubtle: "#252840",
  },
  success: { main: "#7AAE83", subtle: "#1F2D24" },
  warning: { main: "#D4A551", subtle: "#2E2818" },
  danger: { main: "#D47373", subtle: "#2E1F1F" },
  neutral: { main: "#8B847A", subtle: "#322D26" },
} as const;

// ============================================================================
// PALETA DE GRAFICOS
// ============================================================================

export const chartColors = {
  light: ["#4E5FD9", "#4B7F52", "#B8862A", "#B54545", "#6E8FAB", "#8B6FA8", "#C49454", "#5C8A8A"],
  dark: ["#7E8DE5", "#7AAE83", "#D4A551", "#D47373", "#8FB0C8", "#AE96C8", "#D4AE78", "#7AADAD"],
} as const;

// ============================================================================
// TIPOGRAFIA
// ============================================================================

export const typography = {
  fontFamily: {
    sans: "var(--font-inter), 'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    mono: "var(--font-jetbrains-mono), 'JetBrains Mono', 'Fira Code', Menlo, monospace",
  },
  fontSize: {
    xxs: "0.625rem",
    xs: "0.75rem",
    sm: "0.875rem",
    base: "1rem",
    lg: "1.125rem",
    xl: "1.25rem",
    "2xl": "1.5rem",
    "3xl": "1.875rem",
    "4xl": "2.25rem",
    "5xl": "3rem",
  },
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.7,
  },
  letterSpacing: {
    tight: "-0.02em",
    normal: "0",
    wide: "0.05em",
  },
} as const;

// ============================================================================
// ESPACAMENTO BASE (sistema de 4px)
// ============================================================================

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 24,
  6: 32,
  8: 48,
  10: 64,
} as const;

// ============================================================================
// LAYOUT — TOKENS SEMANTICOS
// ============================================================================
//
// Tokens com SIGNIFICADO. Em vez de "p: 8", use "p: layout.page" para
// deixar claro que e padding de pagina (e nao um numero magico).
//
// Como theme.spacing(1) = 4px, multiplique por 4 para obter o valor em px.

export const layout = {
  /** Padding interno de pagina (16px) — use em <main> ou Container */
  page: 4,

  /** Gap vertical entre secoes principais de uma pagina (48px) */
  section: 12,

  /** Gap entre cards/itens relacionados em um cluster (24px) */
  cluster: 6,

  /** Padding interno de Cards (24px) */
  card: 6,

  /** Stack vertical padrao entre elementos relacionados (16px) */
  stack: 4,

  /** Gap inline entre icone + texto, ou itens proximos (8px) */
  inline: 2,

  /** Gap micro (4px) — usado raramente, detalhes muito proximos */
  micro: 1,
} as const;

// ============================================================================
// RADIUS
// ============================================================================

export const radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

// ============================================================================
// ELEVACAO
// ============================================================================

export const elevation = {
  0: "none",
  1: "0 1px 2px rgba(0,0,0,0.04)",
  2: "0 2px 6px rgba(0,0,0,0.06)",
  3: "0 8px 24px rgba(0,0,0,0.08)",
} as const;

export const elevationDark = {
  0: "none",
  1: "0 1px 2px rgba(0,0,0,0.2)",
  2: "0 2px 6px rgba(0,0,0,0.3)",
  3: "0 8px 24px rgba(0,0,0,0.4)",
} as const;

// ============================================================================
// CONTAINER MAX-WIDTHS
// ============================================================================

export const containers = {
  /** Forms estreitos, dialogs (480px) */
  xs: 480,
  /** Conteudo de leitura, dialog medio (640px) */
  sm: 640,
  /** Conteudo de pagina padrao (960px) */
  md: 960,
  /** Dashboards, listagens (1280px) */
  lg: 1280,
  /** Conteudo amplo (1440px) */
  xl: 1440,
} as const;

/**
 * Altura da barra de cabeçalho do app (px). Compartilhada entre o cabeçalho da
 * conta na `AppSidebar` e o cabeçalho de página (ex.: `MonthHeader`) para que
 * os `borderBottom` alinhem na mesma linha horizontal. Ver Spec 65 §7.
 */
export const APP_HEADER_HEIGHT = 56;

// ============================================================================
// MOTION
// ============================================================================

export const motion = {
  duration: {
    fast: 120,
    normal: 200,
    slow: 320,
  },
  easing: {
    standard: "cubic-bezier(0.2, 0, 0, 1)",
    entrance: "cubic-bezier(0, 0, 0, 1)",
    exit: "cubic-bezier(0.4, 0, 1, 1)",
  },
} as const;

// ============================================================================
// TIPOS E HELPERS
// ============================================================================

// Widen as-const hex literais (ex: "#FAFAF7") para `string`, de modo que tanto
// lightColors quanto darkColors (literais distintos) sejam atribuíveis a ColorTokens.
type WidenColorTokens<T> = {
  [K in keyof T]: T[K] extends string ? string : WidenColorTokens<T[K]>;
};

export type ColorTokens = WidenColorTokens<typeof lightColors>;
export type ThemeMode = "light" | "dark";

export function getColors(mode: ThemeMode): ColorTokens {
  return mode === "light" ? lightColors : darkColors;
}

export function getChartColors(mode: ThemeMode): readonly string[] {
  return mode === "light" ? chartColors.light : chartColors.dark;
}
