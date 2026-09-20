"use client";

import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import type { ReactNode, SyntheticEvent } from "react";

import { SETTINGS_GUTTER } from "@/components/settings/settings-layout";
import { typography } from "@/lib/design-tokens";

/**
 * Altura da faixa de abas.
 *
 * 38px, não os 44px que o tema dá ao `MuiTab`: a faixa fica entre o cabeçalho da
 * página e o conteúdo do detalhe, e nessa posição 44px lê como uma segunda barra de
 * navegação. A referência de densidade é a tabela da Spec 68 — cabeçalho de coluna
 * 30px, linha 36px; a aba fica logo acima disso, e não o dobro.
 */
const TABS_HEIGHT = 38;

export type SettingsTabItem = {
  value: string;
  label: string;
  /** Contagem ao lado do rótulo (§7.4 — `Chip size="small"`). `0` é exibido. */
  count?: number;
};

/**
 * Ids de aba e de painel, gerados pela MESMA função nos dois lados.
 *
 * `aria-controls` só liga a aba ao painel se as duas pontas concordarem na string.
 * Com o id montado à mão em cada página, a ligação quebra silenciosamente — o
 * leitor de tela continua anunciando "aba", só que sem dizer o que ela controla.
 */
export function settingsTabId(value: string): string {
  return `settings-tab-${value}`;
}

export function settingsTabPanelId(value: string): string {
  return `settings-tabpanel-${value}`;
}

export type SettingsTabsProps = {
  tabs: SettingsTabItem[];
  value: string;
  onChange: (value: string) => void;
  /** Nome acessível do `tablist` — "Abas do tipo de tabela", não "abas". */
  ariaLabel: string;
};

/**
 * Abas do detalhe das páginas de arquétipo C (Spec 69 §11.1 / §7.4).
 *
 * `Tabs`/`Tab` do MUI, na densidade das Configurações. O `role="tablist"` e a
 * navegação por seta vêm do próprio MUI; o que este componente acrescenta é a
 * densidade, o chip de contagem e o par de ids que amarra aba ↔ painel.
 *
 * `variant="scrollable"`: três abas cabem em qualquer largura, mas a página de
 * Modelos pode ganhar uma quarta — e o default (`standard`) esmaga os rótulos em
 * vez de rolar.
 */
export function SettingsTabs({ tabs, value, onChange, ariaLabel }: SettingsTabsProps) {
  function handleChange(_event: SyntheticEvent, next: string) {
    onChange(next);
  }

  return (
    <Tabs
      value={value}
      onChange={handleChange}
      aria-label={ariaLabel}
      variant="scrollable"
      scrollButtons="auto"
      allowScrollButtonsMobile
      sx={{
        flexShrink: 0,
        minHeight: TABS_HEIGHT,
        px: SETTINGS_GUTTER,
        borderBottom: 1,
        borderColor: "divider",
        bgcolor: "background.surface",
      }}
    >
      {tabs.map((tab) => (
        <Tab
          key={tab.value}
          value={tab.value}
          id={settingsTabId(tab.value)}
          aria-controls={settingsTabPanelId(tab.value)}
          label={<TabLabel label={tab.label} count={tab.count} />}
          sx={{
            minHeight: TABS_HEIGHT,
            px: 1.5,
            py: 0,
            fontSize: "0.77rem",
            "&.Mui-selected": { fontWeight: typography.fontWeight.semibold },
          }}
        />
      ))}
    </Tabs>
  );
}

/**
 * `component="span"` no wrapper e no `Chip`: o rótulo da aba vive dentro de um
 * `<button>`, e o `Chip` do MUI é um `<div>` por padrão — `<div>` dentro de
 * `<button>` é HTML inválido e o React avisa na hidratação.
 */
function TabLabel({ label, count }: { label: string; count?: number }) {
  if (count === undefined) return <>{label}</>;

  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
      {label}
      <Chip
        component="span"
        size="small"
        variant="outlined"
        label={count}
        // Mesma receita do chip de contagem do `SettingsPageShell` (mono, tom
        // terciário, fundo sutil), reduzida para caber numa faixa de 38px: o
        // tema dá 24px de altura ao `MuiChip`, o que empurraria a aba inteira.
        sx={{
          height: 18,
          fontSize: "0.62rem",
          fontFamily: typography.fontFamily.mono,
          color: "text.tertiary",
          borderColor: "border.subtle",
          bgcolor: "background.subtle",
          "& .MuiChip-label": { px: 0.75 },
        }}
      />
    </Box>
  );
}

export type SettingsTabPanelProps = {
  /** Valor da aba a que este painel pertence. */
  value: string;
  /** Valor da aba ATIVA — o painel se esconde quando os dois divergem. */
  activeValue: string;
  children: ReactNode;
};

/**
 * Painel de uma aba.
 *
 * Desmonta o conteúdo quando a aba não está ativa (`{active && children}`) em vez
 * de só escondê-lo: as abas hospedam formulários e pré-visualizações ao vivo, e
 * manter três montadas significa três árvores recalculando a cada tecla digitada
 * em qualquer uma delas.
 */
export function SettingsTabPanel({ value, activeValue, children }: SettingsTabPanelProps) {
  const active = value === activeValue;

  return (
    <Box
      role="tabpanel"
      hidden={!active}
      id={settingsTabPanelId(value)}
      aria-labelledby={settingsTabId(value)}
      sx={active ? { flex: 1, minHeight: 0, minWidth: 0 } : undefined}
    >
      {active && children}
    </Box>
  );
}
