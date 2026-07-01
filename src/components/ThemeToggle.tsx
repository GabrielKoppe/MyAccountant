"use client";

import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import BrightnessAutoIcon from "@mui/icons-material/BrightnessAuto";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";

import { useThemeMode, type ThemeMode } from "@/components/providers/ThemeContext";

const cycleMap: Record<ThemeMode, ThemeMode> = {
  system: "light",
  light: "dark",
  dark: "system",
};

const icons: Record<ThemeMode, React.ReactNode> = {
  light: <LightModeIcon fontSize="small" />,
  dark: <DarkModeIcon fontSize="small" />,
  system: <BrightnessAutoIcon fontSize="small" />,
};

const labels: Record<ThemeMode, string> = {
  light: "Modo claro — clique para escuro",
  dark: "Modo escuro — clique para automático",
  system: "Modo automático — clique para claro",
};

export function ThemeToggle() {
  const { mode, setMode } = useThemeMode();

  return (
    <Tooltip title={labels[mode]}>
      <IconButton
        onClick={() => setMode(cycleMap[mode])}
        size="small"
        aria-label={labels[mode]}
        sx={{
          color: "text.secondary",
          transition: `transform 320ms cubic-bezier(0.2, 0, 0, 1), color 120ms`,
          transform: mode === "dark" ? "rotate(180deg)" : "rotate(0deg)",
          "&:hover": {
            color: "text.primary",
            bgcolor: "action.hover",
          },
        }}
      >
        {icons[mode]}
      </IconButton>
    </Tooltip>
  );
}
