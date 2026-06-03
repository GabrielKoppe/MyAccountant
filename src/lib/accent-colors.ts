/**
 * Paletas de cor de destaque (accent) do usuário.
 * Cada preset tem variantes para light e dark mode.
 * O campo `swatch` é a cor representativa (usada no seletor de cor).
 */

export type AccentPreset = {
  primary: string;
  hover: string;
  subtle: string;
};

export const ACCENT_COLORS = [
  {
    key: "indigo",
    label: "Índigo",
    swatch: "#4E5FD9",
    light: { primary: "#4E5FD9", hover: "#3D4DC4", subtle: "#EAEDFB" },
    dark:  { primary: "#7E8DE5", hover: "#94A1EC", subtle: "#252840" },
  },
  {
    key: "violet",
    label: "Violeta",
    swatch: "#7C3AED",
    light: { primary: "#7C3AED", hover: "#6D28D9", subtle: "#EDE9FE" },
    dark:  { primary: "#A78BFA", hover: "#C4B5FD", subtle: "#2D1547" },
  },
  {
    key: "fuchsia",
    label: "Fúcsia",
    swatch: "#A21CAF",
    light: { primary: "#A21CAF", hover: "#86198F", subtle: "#FAE8FF" },
    dark:  { primary: "#E879F9", hover: "#F0ABFC", subtle: "#3B1040" },
  },
  {
    key: "rose",
    label: "Carmesim",
    swatch: "#B91C1C",
    light: { primary: "#B91C1C", hover: "#991B1B", subtle: "#FEE2E2" },
    dark:  { primary: "#F87171", hover: "#FCA5A5", subtle: "#3B1515" },
  },
  {
    key: "orange",
    label: "Laranja",
    swatch: "#C2410C",
    light: { primary: "#C2410C", hover: "#9A3412", subtle: "#FFEDD5" },
    dark:  { primary: "#FB923C", hover: "#FDBA74", subtle: "#3B1F0E" },
  },
  {
    key: "amber",
    label: "Âmbar",
    swatch: "#B45309",
    light: { primary: "#B45309", hover: "#92400E", subtle: "#FEF3C7" },
    dark:  { primary: "#FBBF24", hover: "#FDE68A", subtle: "#3B2E0A" },
  },
  {
    key: "green",
    label: "Verde",
    swatch: "#15803D",
    light: { primary: "#15803D", hover: "#166534", subtle: "#DCFCE7" },
    dark:  { primary: "#4ADE80", hover: "#86EFAC", subtle: "#0F2E1A" },
  },
  {
    key: "teal",
    label: "Teal",
    swatch: "#0F766E",
    light: { primary: "#0F766E", hover: "#115E59", subtle: "#CCFBF1" },
    dark:  { primary: "#2DD4BF", hover: "#5EEAD4", subtle: "#0D2E2B" },
  },
  {
    key: "sky",
    label: "Azul-céu",
    swatch: "#0369A1",
    light: { primary: "#0369A1", hover: "#075985", subtle: "#E0F2FE" },
    dark:  { primary: "#38BDF8", hover: "#7DD3FC", subtle: "#0B2A3B" },
  },
  {
    key: "slate",
    label: "Ardósia",
    swatch: "#475569",
    light: { primary: "#475569", hover: "#334155", subtle: "#F1F5F9" },
    dark:  { primary: "#94A3B8", hover: "#CBD5E1", subtle: "#1E2533" },
  },
] as const;

export type AccentColorKey = (typeof ACCENT_COLORS)[number]["key"];

export const DEFAULT_ACCENT: AccentColorKey = "indigo";

export const ACCENT_COLOR_KEYS: readonly AccentColorKey[] = ACCENT_COLORS.map(
  (c) => c.key,
) as AccentColorKey[];

export function getAccentPreset(key: AccentColorKey, mode: "light" | "dark"): AccentPreset {
  const found = ACCENT_COLORS.find((c) => c.key === key) ?? ACCENT_COLORS[0];
  return found[mode];
}
