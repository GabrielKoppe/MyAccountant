"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSnackbar } from "notistack";

import { updateDashboardLayoutAction } from "@/actions/dashboard-layout";
import { m } from "@/lib/messages";
import {
  GRID_CONFIG,
  WIDGET_REGISTRY,
  type DashboardContext,
} from "@/components/dashboards/_core/widget-registry";
import type { StoredWidget } from "@/lib/schemas/dashboard-layout";
import { DashboardGridCanvas } from "./DashboardGridCanvas";

const DEBOUNCE_MS = 600;

type Props = {
  accountId: string;
  context: DashboardContext;
  initialWidgets: StoredWidget[];
};

export function DashboardGridEditor({ accountId, context, initialWidgets }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [widgets, setWidgets] = useState<StoredWidget[]>(initialWidgets);
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
        enqueueSnackbar(detail ? `${m.settings.dashboards.saveError} ${detail}` : m.settings.dashboards.saveError, {
          variant: "error",
        });
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

  return (
    <DashboardGridCanvas
      widgets={widgets}
      registry={WIDGET_REGISTRY[context]}
      cols={cols}
      maxRows={maxRows}
      initialRows={initialRows}
      context={context}
      onLayoutChange={handleLayoutChange}
    />
  );
}
