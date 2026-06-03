/**
 * Design Tokens — MyAccountant
 *
 * Fonte única de tokens do design system "Warm Calm".
 * Inspiração: Notion, Things 3, Linear (versão warm).
 *
 * Princípios:
 *  - Tokens semânticos (background.canvas, não #FAFAF7).
 *  - Cores quentes desaturadas, off-white em vez de branco puro.
 *  - Bordas em vez de sombras.
 *  - Hierarquia por tipografia e espaço, não por cor.
 *
 * Ver: skills/design-system/SKILL.md
 */

// ============================================================================
// CORES — LIGHT MODE
// ============================================================================

export const lightColors = {
  background: {
    canvas: "#FAFAF7",   // fundo da página (off-white quente)
    surface: "#FFFFFF",  // cards, paineis
    subtle: "#F5F4F0",   // hover, áreas secundárias
    muted: "#EDEBE5",    // divisores suaves
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
  success: {
    main: "#4B7F52",
    subtle: "#E8F0E9",
  },
  warning: {
    main: "#B8862A",
    subtle: "#F5EDD5",
  },
  danger: {
    main: "#B54545",
    subtle: "#F5E4E4",
  },
  neutral: {
    main: "#7A7368",
    subtle: "#EDEBE5",
  },
} as const;

// ============================================================================
// CORES — DARK MODE (Sepia Escuro)
// ============================================================================

export const darkColors = {
  background: {
    canvas: "#1A1815",   // carvão quente, NÃO preto puro
    surface: "#221F1B",  // cards (mais claro = elevado)
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
    primary: "#F0EDE5",  // off-white quente, NÃO branco puro
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
  success: {
    main: "#7AAE83",
    subtle: "#1F2D24",
  },
  warning: {
    main: "#D4A551",
    subtle: "#2E2818",
  },
  danger: {
    main: "#D47373",
    subtle: "#2E1F1F",
  },
  neutral: {
    main: "#8B847A",
    subtle: "#322D26",
  },
} as const;

// ============================================================================
// PALETA DE GRÁFICOS
// ============================================================================

export const chartColors = {
  light: [
    "#4E5FD9",  // 1 - índigo (accent)
    "#4B7F52",  // 2 - verde-musgo
    "#B8862A",  // 3 - mostarda
    "#B54545",  // 4 - terracota
    "#6E8FAB",  // 5 - azul-cinza
    "#8B6FA8",  // 6 - lavanda
    "#C49454",  // 7 - âmbar
    "#5C8A8A",  // 8 - teal suave
  ],
  dark: [
    "#7E8DE5",
    "#7AAE83",
    "#D4A551",
    "#D47373",
    "#9CB6CC",
    "#B8A2D4",
    "#E5B47A",
    "#85AFAF",
  ],
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
    xs: "0.75rem",      // 12px
    sm: "0.875rem",     // 14px
    base: "1rem",       // 16px
    lg: "1.125rem",     // 18px
    xl: "1.25rem",      // 20px
    "2xl": "1.5rem",    // 24px
    "3xl": "1.875rem",  // 30px
    "4xl": "2.25rem",   // 36px
    "5xl": "3rem",      // 48px
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
// ESPAÇAMENTO (sistema de 4px)
// ============================================================================

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,   // ★ unidade padrão
  5: 24,   // ★ gap entre cards
  6: 32,
  8: 48,
  10: 64,
} as const;

// ============================================================================
// RADIUS
// ============================================================================

export const radius = {
  none: 0,
  sm: 4,
  md: 8,    // ★ inputs, botões
  lg: 12,   // ★ cards, modais
  xl: 16,
  full: 9999,
} as const;

// ============================================================================
// ELEVAÇÃO
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
// TIPOS EXPORTADOS
// ============================================================================

// Widened: accepts both lightColors and darkColors (which have incompatible literal string types)
type DeepStrings<T> = T extends string
  ? string
  : { readonly [K in keyof T]: DeepStrings<T[K]> };

export type ColorTokens = DeepStrings<typeof lightColors>;
export type ThemeMode = "light" | "dark";

export function getColors(mode: ThemeMode): ColorTokens {
  return mode === "light" ? lightColors : darkColors;
}

export function getChartColors(mode: ThemeMode): readonly string[] {
  return mode === "light" ? chartColors.light : chartColors.dark;
}
