/**
 * Tema MUI — MyAccountant
 *
 * Aplica os design tokens ao MUI via createTheme.
 * Inclui temas light e dark, overrides de componentes,
 * tipografia customizada e palette estendida.
 *
 * Ver: src/lib/design-tokens.ts e skills/design-system/SKILL.md
 */

import { createTheme, type ThemeOptions, type PaletteOptions } from "@mui/material/styles";
import { ptBR } from "@mui/material/locale";

import {
  lightColors,
  darkColors,
  typography as t,
  spacing,
  radius,
  elevation,
  elevationDark,
  motion,
  type ColorTokens,
  type ThemeMode,
} from "@/lib/design-tokens";
import { type AccentPreset, type AccentColorKey, getAccentPreset } from "@/lib/accent-colors";

// ============================================================================
// EXTENSÃO DA PALETTE DO MUI
// ============================================================================

declare module "@mui/material/styles" {
  interface Palette {
    surface: {
      canvas: string;
      surface: string;
      subtle: string;
      muted: string;
    };
    border: {
      subtle: string;
      default: string;
      strong: string;
      focus: string;
    };
    accent: {
      primary: string;
      primaryHover: string;
      primarySubtle: string;
    };
    danger: { main: string; subtle: string };
    neutral: { main: string; subtle: string };
  }
  interface PaletteOptions {
    surface?: Palette["surface"];
    border?: Palette["border"];
    accent?: Palette["accent"];
    danger?: Palette["danger"];
    neutral?: Palette["neutral"];
  }
  interface TypographyVariants {
    kpi: React.CSSProperties;
    mono: React.CSSProperties;
  }
  interface TypographyVariantsOptions {
    kpi?: React.CSSProperties;
    mono?: React.CSSProperties;
  }
}

declare module "@mui/material/Typography" {
  interface TypographyPropsVariantOverrides {
    kpi: true;
    mono: true;
  }
}

// ============================================================================
// CONSTRUTOR DE PALETTE
// ============================================================================

function buildPalette(mode: ThemeMode, c: ColorTokens, ac: AccentPreset): PaletteOptions {
  return {
    mode,
    primary: {
      main: ac.primary,
      dark: ac.hover,
      light: ac.subtle,
      // contrastText: auto-computed by MUI based on luminance
    },
    success: {
      main: c.success.main,
      light: c.success.subtle,
      contrastText: c.text.inverse,
    },
    warning: {
      main: c.warning.main,
      light: c.warning.subtle,
      contrastText: c.text.inverse,
    },
    error: {
      main: c.danger.main,
      light: c.danger.subtle,
      contrastText: c.text.inverse,
    },
    info: {
      main: ac.primary,
      light: ac.subtle,
    },
    text: {
      primary: c.text.primary,
      secondary: c.text.secondary,
      disabled: c.text.disabled,
    },
    background: {
      default: c.background.canvas,
      paper: c.background.surface,
    },
    divider: c.border.subtle,
    // Tokens customizados
    surface: c.background,
    border: { ...c.border, focus: ac.primary },
    accent: { primary: ac.primary, primaryHover: ac.hover, primarySubtle: ac.subtle },
    danger: c.danger,
    neutral: c.neutral,
  };
}

// ============================================================================
// CONSTRUTOR DE THEME OPTIONS
// ============================================================================

function buildThemeOptions(mode: ThemeMode, accentOverride?: AccentPreset): ThemeOptions {
  const c = mode === "light" ? lightColors : darkColors;
  const elev = mode === "light" ? elevation : elevationDark;
  const ac: AccentPreset = accentOverride ?? {
    primary: c.accent.primary,
    hover: c.accent.primaryHover,
    subtle: c.accent.primarySubtle,
  };

  return {
    palette: buildPalette(mode, c, ac),

    spacing: 4, // base unit = 4px → theme.spacing(4) = 16px

    shape: {
      borderRadius: radius.md,
    },

    typography: {
      fontFamily: t.fontFamily.sans,
      htmlFontSize: 16,
      fontSize: 14,
      fontWeightRegular: t.fontWeight.regular,
      fontWeightMedium: t.fontWeight.medium,
      fontWeightBold: t.fontWeight.semibold,

      h1: {
        fontSize: t.fontSize["3xl"],
        fontWeight: t.fontWeight.semibold,
        lineHeight: t.lineHeight.tight,
        letterSpacing: t.letterSpacing.tight,
        color: c.text.primary,
      },
      h2: {
        fontSize: t.fontSize["2xl"],
        fontWeight: t.fontWeight.semibold,
        lineHeight: t.lineHeight.tight,
        letterSpacing: t.letterSpacing.tight,
        color: c.text.primary,
      },
      h3: {
        fontSize: t.fontSize.xl,
        fontWeight: t.fontWeight.semibold,
        lineHeight: t.lineHeight.tight,
        color: c.text.primary,
      },
      h4: {
        fontSize: t.fontSize.lg,
        fontWeight: t.fontWeight.semibold,
        lineHeight: t.lineHeight.normal,
        color: c.text.primary,
      },
      h5: {
        fontSize: t.fontSize.base,
        fontWeight: t.fontWeight.semibold,
        lineHeight: t.lineHeight.normal,
        color: c.text.primary,
      },
      h6: {
        fontSize: t.fontSize.sm,
        fontWeight: t.fontWeight.semibold,
        lineHeight: t.lineHeight.normal,
        color: c.text.primary,
      },
      subtitle1: {
        fontSize: t.fontSize.base,
        fontWeight: t.fontWeight.medium,
        lineHeight: t.lineHeight.normal,
        color: c.text.secondary,
      },
      subtitle2: {
        fontSize: t.fontSize.sm,
        fontWeight: t.fontWeight.medium,
        lineHeight: t.lineHeight.normal,
        color: c.text.secondary,
      },
      body1: {
        fontSize: t.fontSize.base,
        fontWeight: t.fontWeight.regular,
        lineHeight: t.lineHeight.normal,
        color: c.text.primary,
      },
      body2: {
        fontSize: t.fontSize.sm,
        fontWeight: t.fontWeight.regular,
        lineHeight: t.lineHeight.normal,
        color: c.text.secondary,
      },
      caption: {
        fontSize: t.fontSize.xs,
        fontWeight: t.fontWeight.regular,
        lineHeight: t.lineHeight.normal,
        color: c.text.tertiary,
      },
      overline: {
        fontSize: t.fontSize.xs,
        fontWeight: t.fontWeight.medium,
        lineHeight: t.lineHeight.normal,
        letterSpacing: t.letterSpacing.wide,
        textTransform: "uppercase",
        color: c.text.tertiary,
      },
      button: {
        fontSize: t.fontSize.sm,
        fontWeight: t.fontWeight.medium,
        lineHeight: t.lineHeight.normal,
        textTransform: "none",
      },

      // Variantes customizadas
      kpi: {
        fontFamily: t.fontFamily.mono,
        fontSize: t.fontSize["4xl"],
        fontWeight: t.fontWeight.medium,
        lineHeight: t.lineHeight.tight,
        letterSpacing: t.letterSpacing.tight,
        fontVariantNumeric: "tabular-nums",
        color: c.text.primary,
      },
      mono: {
        fontFamily: t.fontFamily.mono,
        fontSize: t.fontSize.sm,
        fontWeight: t.fontWeight.regular,
        fontVariantNumeric: "tabular-nums",
        color: c.text.primary,
      },
    },

    shadows: [
      "none",
      elev[1],
      elev[2],
      elev[2],
      elev[3],
      elev[3],
      elev[3],
      elev[3],
      elev[3],
      elev[3],
      elev[3],
      elev[3],
      elev[3],
      elev[3],
      elev[3],
      elev[3],
      elev[3],
      elev[3],
      elev[3],
      elev[3],
      elev[3],
      elev[3],
      elev[3],
      elev[3],
      elev[3],
    ],

    transitions: {
      duration: {
        shortest: motion.duration.fast,
        shorter: motion.duration.fast,
        short: motion.duration.normal,
        standard: motion.duration.normal,
        complex: motion.duration.slow,
        enteringScreen: motion.duration.normal,
        leavingScreen: motion.duration.fast,
      },
      easing: {
        easeInOut: motion.easing.standard,
        easeOut: motion.easing.entrance,
        easeIn: motion.easing.exit,
        sharp: motion.easing.standard,
      },
    },

    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: c.background.canvas,
            color: c.text.primary,
            fontFamily: t.fontFamily.sans,
            WebkitFontSmoothing: "antialiased",
            MozOsxFontSmoothing: "grayscale",
            // Scrollbar acompanha o tema (Firefox via scrollbar-color; demais via
            // pseudo-elementos WebKit) — sem isso a barra fica cinza do SO, quebrando
            // a paridade light/dark em qualquer container com overflow.
            scrollbarColor: `${c.border.strong} ${c.background.canvas}`,
          },
          "*": {
            scrollbarColor: `${c.border.strong} transparent`,
          },
          "*::-webkit-scrollbar": {
            width: 10,
            height: 10,
          },
          "*::-webkit-scrollbar-track": {
            backgroundColor: "transparent",
          },
          "*::-webkit-scrollbar-thumb": {
            backgroundColor: c.border.strong,
            borderRadius: radius.full,
          },
          "*::-webkit-scrollbar-thumb:hover": {
            backgroundColor: c.text.tertiary,
          },
        },
      },

      MuiButton: {
        defaultProps: {
          disableElevation: true,
          disableRipple: false,
        },
        styleOverrides: {
          root: {
            borderRadius: radius.md,
            textTransform: "none",
            fontWeight: t.fontWeight.medium,
            padding: `${spacing[2]}px ${spacing[4]}px`,
            transition: `all ${motion.duration.fast}ms ${motion.easing.standard}`,
            "&:focus-visible": {
              outline: `2px solid ${ac.primary}`,
              outlineOffset: 2,
            },
          },
          containedPrimary: {
            backgroundColor: ac.primary,
            "&:hover": {
              backgroundColor: ac.hover,
            },
          },
          outlined: {
            borderColor: c.border.default,
            color: c.text.primary,
            "&:hover": {
              backgroundColor: c.background.subtle,
              borderColor: c.border.strong,
            },
          },
          text: {
            color: c.text.primary,
            "&:hover": {
              backgroundColor: c.background.subtle,
            },
          },
        },
      },

      MuiTextField: {
        defaultProps: {
          size: "small",
          variant: "outlined",
        },
      },

      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: radius.md,
            backgroundColor: c.background.surface,
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: c.border.default,
              transition: `border-color ${motion.duration.fast}ms`,
            },
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: c.border.strong,
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: ac.primary,
              borderWidth: 2,
            },
          },
        },
      },

      MuiInputLabel: {
        styleOverrides: {
          root: {
            color: c.text.secondary,
            fontWeight: t.fontWeight.medium,
            fontSize: t.fontSize.sm,
          },
        },
      },

      MuiCard: {
        defaultProps: {
          elevation: 0,
        },
        styleOverrides: {
          root: {
            backgroundColor: c.background.surface,
            border: `1px solid ${c.border.subtle}`,
            borderRadius: radius.lg,
            backgroundImage: "none",
            boxShadow: "none",
          },
        },
      },

      MuiCardContent: {
        styleOverrides: {
          root: {
            padding: spacing[5],
            "&:last-child": {
              paddingBottom: spacing[5],
            },
          },
        },
      },

      MuiPaper: {
        defaultProps: {
          elevation: 0,
        },
        styleOverrides: {
          root: {
            backgroundColor: c.background.surface,
            backgroundImage: "none",
          },
          outlined: {
            borderColor: c.border.subtle,
          },
        },
      },

      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: radius.sm,
            fontWeight: t.fontWeight.medium,
            fontSize: t.fontSize.xs,
            height: 24,
          },
          colorSuccess: {
            backgroundColor: c.success.subtle,
            color: c.success.main,
          },
          colorWarning: {
            backgroundColor: c.warning.subtle,
            color: c.warning.main,
          },
          colorError: {
            backgroundColor: c.danger.subtle,
            color: c.danger.main,
          },
        },
      },

      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottom: `1px solid ${c.border.subtle}`,
            padding: `${spacing[3]}px ${spacing[4]}px`,
            color: c.text.primary,
            fontSize: t.fontSize.sm,
          },
          head: {
            color: c.text.tertiary,
            fontWeight: t.fontWeight.medium,
            fontSize: t.fontSize.xs,
            letterSpacing: t.letterSpacing.wide,
            textTransform: "uppercase",
            backgroundColor: c.background.subtle,
          },
        },
      },

      MuiTableRow: {
        styleOverrides: {
          root: {
            "&:hover": {
              backgroundColor: c.background.subtle,
            },
          },
        },
      },

      MuiDialog: {
        defaultProps: { disableScrollLock: true },
        styleOverrides: {
          paper: {
            borderRadius: radius.lg,
            border: `1px solid ${c.border.subtle}`,
          },
        },
      },

      MuiDrawer: {
        defaultProps: { disableScrollLock: true },
        styleOverrides: {
          paper: {
            backgroundColor: c.background.surface,
            borderColor: c.border.subtle,
          },
        },
      },

      // Desabilita o scroll-lock em todos os componentes overlay para evitar o
      // layout shift que ocorre quando o MUI compensa a largura do scrollbar.
      // Cada componente precisa do seu próprio defaultProp porque cada um chama
      // useThemeProps com seu próprio nome antes de repassar ao Modal interno.
      MuiModal: {
        defaultProps: { disableScrollLock: true },
      },
      MuiPopover: {
        defaultProps: { disableScrollLock: true },
      },
      MuiMenu: {
        defaultProps: { disableScrollLock: true },
      },

      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: c.text.primary,
            color: c.text.inverse,
            fontSize: t.fontSize.xs,
            fontWeight: t.fontWeight.regular,
            borderRadius: radius.md,
            padding: `${spacing[2]}px ${spacing[3]}px`,
          },
        },
      },

      MuiDivider: {
        styleOverrides: {
          root: {
            borderColor: c.border.subtle,
          },
        },
      },

      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: radius.md,
            border: "1px solid",
          },
          standardSuccess: {
            backgroundColor: c.success.subtle,
            borderColor: c.success.main,
            color: c.success.main,
          },
          standardWarning: {
            backgroundColor: c.warning.subtle,
            borderColor: c.warning.main,
            color: c.warning.main,
          },
          standardError: {
            backgroundColor: c.danger.subtle,
            borderColor: c.danger.main,
            color: c.danger.main,
          },
        },
      },

      MuiSwitch: {
        styleOverrides: {
          track: {
            backgroundColor: c.border.strong,
          },
        },
      },

      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: "none",
            fontWeight: t.fontWeight.medium,
            fontSize: t.fontSize.sm,
            minHeight: 44,
            color: c.text.tertiary,
            "&.Mui-selected": {
              color: c.text.primary,
            },
          },
        },
      },

      MuiTabs: {
        styleOverrides: {
          indicator: {
            backgroundColor: ac.primary,
            height: 2,
            borderRadius: 2,
          },
        },
      },
    },
  };
}

// ============================================================================
// TEMAS EXPORTADOS
// ============================================================================

export const lightTheme = createTheme(buildThemeOptions("light"), ptBR);
export const darkTheme = createTheme(buildThemeOptions("dark"), ptBR);

export function getTheme(mode: ThemeMode) {
  return mode === "light" ? lightTheme : darkTheme;
}

export function buildThemeWithAccent(mode: ThemeMode, accentKey: AccentColorKey) {
  const preset = getAccentPreset(accentKey, mode);
  return createTheme(buildThemeOptions(mode, preset), ptBR);
}
