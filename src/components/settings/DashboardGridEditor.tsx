"use client";

import RestartAltIcon from "@mui/icons-material/RestartAlt";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import { useSnackbar } from "notistack";
import { useCallback, useEffect, useRef, useState } from "react";

import { updateDashboardLayoutAction } from "@/actions/dashboard-layout";
import {
  GRID_CONFIG,
  WIDGET_REGISTRY,
  resolveLayout,
  type DashboardContext,
} from "@/components/dashboards/_core/widget-registry";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { m } from "@/lib/messages";
import type { StoredWidget } from "@/lib/schemas/dashboard-layout";
import type { WidgetConfigOptions } from "@/server/queries/widget-config-options";

import { DashboardGridCanvas } from "./DashboardGridCanvas";

const DEBOUNCE_MS = 600;

type Props = {
  accountId: string;
  context: DashboardContext;
  initialWidgets: StoredWidget[];
  configOptions: WidgetConfigOptions;
};

export function DashboardGridEditor({ accountId, context, initialWidgets, configOptions }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [widgets, setWidgets] = useState<StoredWidget[]>(initialWidgets);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Último estado confirmado no servidor — usado para reverter em caso de falha.
  const savedRef = useRef<StoredWidget[]>(initialWidgets);

  const { cols, maxRows, initialRows } = GRID_CONFIG[context];

  const saveLayout = useCallback(
    async (next: StoredWidget[], previous: StoredWidget[]) => {
      const result = await updateDashboardLayoutAction(accountId, { context, widgets: next });
      if (result.ok) {
        savedRef.current = next;
        enqueueSnackbar(m.settings.dashboards.saved, { variant: "success" });
      } else {
        // Reverte o estado otimista para o último confirmado.
        setWidgets(previous);
        savedRef.current = previous;
        // Usa a mensagem específica do servidor (ex.: widget fora dos limites,
        // config inválida) quando houver — mais útil que um erro genérico.
        const detail = result.error?.message;
        enqueueSnackbar(
          detail ? `${m.settings.dashboards.saveError} ${detail}` : m.settings.dashboards.saveError,
          {
            variant: "error",
          },
        );
      }
    },
    [accountId, context, enqueueSnackbar],
  );

  const handleLayoutChange = useCallback(
    (next: StoredWidget[], opts?: { immediate?: boolean }) => {
      const previous = savedRef.current;
      setWidgets(next); // atualização otimista
      if (debounceRef.current) clearTimeout(debounceRef.current);
      // Adicionar/duplicar/remover salva na hora; reposicionar/resize/ocultar usa debounce.
      if (opts?.immediate) {
        void saveLayout(next, previous);
      } else {
        debounceRef.current = setTimeout(() => {
          void saveLayout(next, previous);
        }, DEBOUNCE_MS);
      }
    },
    [saveLayout],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleResetConfirm = useCallback(async () => {
    setResetting(true);
    const defaultWidgets = resolveLayout(context, null);
    const result = await updateDashboardLayoutAction(accountId, {
      context,
      widgets: defaultWidgets,
    });
    setResetting(false);
    setResetDialogOpen(false);
    if (result.ok) {
      setWidgets(defaultWidgets);
      savedRef.current = defaultWidgets;
      enqueueSnackbar(m.settings.dashboards.resetToDefaultSuccess, { variant: "success" });
    } else {
      const detail = result.error?.message;
      enqueueSnackbar(
        detail ? `${m.settings.dashboards.saveError} ${detail}` : m.settings.dashboards.saveError,
        { variant: "error" },
      );
    }
  }, [accountId, context, enqueueSnackbar]);

  return (
    <>
      {/*
        O `mt: -34px` daqui existia só para puxar este botão até a linha do título
        do `PageSettingsContainer` (que tinha o slot `secondary` vazio). Com o
        `SettingsPageShell` (Spec 67 §2.2) o cabeçalho é uma faixa própria, e a
        margem negativa faria o botão invadi-la — por isso saiu. O botão segue no
        topo do conteúdo, com o mesmo comportamento.
      */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <Button
          size="small"
          variant="text"
          startIcon={<RestartAltIcon fontSize="small" />}
          onClick={() => setResetDialogOpen(true)}
          sx={{ color: "text.secondary", fontSize: "0.75rem" }}
        >
          {m.settings.dashboards.resetToDefault}
        </Button>
      </Box>

      <DashboardGridCanvas
        widgets={widgets}
        registry={WIDGET_REGISTRY[context]}
        configOptions={configOptions}
        cols={cols}
        maxRows={maxRows}
        initialRows={initialRows}
        context={context}
        onLayoutChange={handleLayoutChange}
      />

      <SettingsDialog
        open={resetDialogOpen}
        onClose={() => setResetDialogOpen(false)}
        size="confirm"
        title={m.settings.dashboards.resetToDefaultConfirmTitle}
        description={m.settings.dashboards.resetToDefaultConfirmDescription}
        actions={
          <>
            <Button
              variant="outlined"
              color="inherit"
              onClick={() => setResetDialogOpen(false)}
              disabled={resetting}
            >
              {m.common.cancel}
            </Button>
            <Button
              variant="contained"
              color="warning"
              onClick={handleResetConfirm}
              disabled={resetting}
            >
              {m.settings.dashboards.resetToDefaultConfirm}
            </Button>
          </>
        }
      />
    </>
  );
}
