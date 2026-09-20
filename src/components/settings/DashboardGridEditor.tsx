"use client";

import AddIcon from "@mui/icons-material/Add";
import RedoIcon from "@mui/icons-material/Redo";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import UndoIcon from "@mui/icons-material/Undo";
import VisibilityIcon from "@mui/icons-material/Visibility";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import { useRouter } from "next/navigation";
import { useSnackbar } from "notistack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  discardDashboardLayoutAction,
  publishDashboardLayoutAction,
  updateDashboardLayoutAction,
} from "@/actions/dashboard-layout";
import { countLayoutChanges } from "@/components/dashboards/_core/grid-layout";
import {
  GRID_CONFIG,
  WIDGET_REGISTRY,
  resolveLayout,
  type DashboardContext,
} from "@/components/dashboards/_core/widget-registry";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { SettingsPageShell } from "@/components/settings/SettingsPageShell";
import { containers } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import type { StoredWidget } from "@/lib/schemas/dashboard-layout";
import type { WidgetConfigOptions } from "@/server/queries/widget-config-options";

import { DashboardGridCanvas } from "./DashboardGridCanvas";
import { useLayoutHistory } from "./useLayoutHistory";

const DEBOUNCE_MS = 600;

/**
 * As 3 páginas do frame (07) num `ToggleButtonGroup`. Aqui elas são 3 ROTAS de
 * verdade (URL compartilhável + `generateMetadata` correto, DIV-12), então o
 * grupo é NAVEGAÇÃO: mesma leitura visual, sem perder função.
 */
const CONTEXT_ROUTE: Record<DashboardContext, string> = {
  monthly: "monthly",
  yearly: "yearly",
  month_summary: "month-summary",
};

const CONTEXT_LABEL: Record<DashboardContext, string> = {
  monthly: m.settings.presentation.dashboards.pageMonthly,
  yearly: m.settings.presentation.dashboards.pageYearly,
  month_summary: m.settings.presentation.dashboards.pageMonthSummary,
};

type Props = {
  accountId: string;
  context: DashboardContext;
  /** O que o editor abre: rascunho quando existe, senão o publicado. */
  initialWidgets: StoredWidget[];
  /** Último layout publicado — base do "Descartar" e da contagem do rodapé. */
  initialPublished: StoredWidget[];
  configOptions: WidgetConfigOptions;
  /** Cabeçalho do shell (a página é RSC; o rodapé de publicar é estado de cliente). */
  title: string;
  purpose: string;
  /** "Ver a página": destino real deste dashboard; ausente quando não há mês ainda. */
  viewPageHref?: string;
};

export function DashboardGridEditor({
  accountId,
  context,
  initialWidgets,
  initialPublished,
  configOptions,
  title,
  purpose,
  viewPageHref,
}: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const router = useRouter();
  const [widgets, setWidgets] = useState<StoredWidget[]>(initialWidgets);
  const [published, setPublished] = useState<StoredWidget[]>(initialPublished);
  const [publishing, setPublishing] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Último estado confirmado no servidor — usado para reverter em caso de falha.
  const savedRef = useRef<StoredWidget[]>(initialWidgets);
  const history = useLayoutHistory();

  const { cols, maxRows, initialRows } = GRID_CONFIG[context];
  const dirtyCount = useMemo(() => countLayoutChanges(published, widgets), [published, widgets]);
  const usedRows = widgets.reduce((max, w) => Math.max(max, w.y + w.h), 0);

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

  /**
   * Grava o layout (otimista + debounce). NÃO mexe no histórico — é o que
   * permite que undo/redo apliquem um estado sem empilhá-lo de novo.
   *
   * O `clearTimeout` no início é o que reconcilia undo/redo com o autosave em
   * voo: se havia um save agendado para o estado que acabou de ser desfeito,
   * ele é cancelado antes de disparar, e o save do undo (sempre `immediate`)
   * é o que chega ao servidor. Um save já DESPACHADO segue seu curso; como o
   * seguinte é enviado depois e o servidor grava o layout inteiro, o último a
   * chegar é o correto.
   */
  const commitLayout = useCallback(
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

  // Toda alteração vinda do canvas passa por aqui → o histórico cobre mover,
  // redimensionar, adicionar, duplicar, remover e ocultar sem exceção.
  const handleLayoutChange = useCallback(
    (next: StoredWidget[], opts?: { immediate?: boolean }) => {
      history.push(widgets);
      commitLayout(next, opts);
    },
    [commitLayout, history, widgets],
  );

  const handleUndo = useCallback(() => {
    const previous = history.undo(widgets);
    if (!previous) return;
    commitLayout(previous, { immediate: true });
    enqueueSnackbar(m.settings.presentation.dashboards.undone, { variant: "info" });
  }, [commitLayout, enqueueSnackbar, history, widgets]);

  const handleRedo = useCallback(() => {
    const next = history.redo(widgets);
    if (!next) return;
    commitLayout(next, { immediate: true });
    enqueueSnackbar(m.settings.presentation.dashboards.redone, { variant: "info" });
  }, [commitLayout, enqueueSnackbar, history, widgets]);

  // Atalhos: Ctrl/Cmd+Z desfaz, Ctrl/Cmd+Shift+Z refaz. Ignora quando o foco
  // está num campo de texto (o inspetor tem formulários).
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName ?? ""))
      ) {
        return;
      }
      event.preventDefault();
      if (event.shiftKey) handleRedo();
      else handleUndo();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleRedo, handleUndo]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  /** Publicar: o rascunho gravado vira o layout que as 3 páginas reais leem. */
  const handlePublish = useCallback(async () => {
    setPublishing(true);
    // Um save em voo tem de chegar ANTES da publicação, senão publicaríamos o
    // rascunho anterior. Cancela o debounce e grava o estado atual na hora.
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
      await saveLayout(widgets, savedRef.current);
    }
    const result = await publishDashboardLayoutAction(accountId, { context });
    setPublishing(false);
    if (result.ok) {
      const publishedWidgets = result.data?.widgets ?? widgets;
      setPublished(publishedWidgets);
      setWidgets(publishedWidgets);
      savedRef.current = publishedWidgets;
      history.reset();
      enqueueSnackbar(m.settings.presentation.dashboards.published, { variant: "success" });
      // As páginas reais são RSC: sem refresh, o cache do cliente seguiria com o
      // layout antigo até uma navegação dura.
      router.refresh();
    } else {
      const detail = result.error?.message;
      enqueueSnackbar(
        detail ? `${m.settings.dashboards.saveError} ${detail}` : m.settings.dashboards.saveError,
        { variant: "error" },
      );
    }
  }, [accountId, context, enqueueSnackbar, history, router, saveLayout, widgets]);

  /** Descartar: volta ao último publicado; a página real nunca foi tocada. */
  const handleDiscard = useCallback(async () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    const result = await discardDashboardLayoutAction(accountId, { context });
    if (result.ok) {
      const publishedWidgets = result.data?.widgets ?? published;
      setPublished(publishedWidgets);
      setWidgets(publishedWidgets);
      savedRef.current = publishedWidgets;
      history.reset();
      enqueueSnackbar(m.settings.presentation.dashboards.discarded, { variant: "info" });
    } else {
      const detail = result.error?.message;
      enqueueSnackbar(
        detail ? `${m.settings.dashboards.saveError} ${detail}` : m.settings.dashboards.saveError,
        { variant: "error" },
      );
    }
  }, [accountId, context, enqueueSnackbar, history, published]);

  const handleResetConfirm = useCallback(async () => {
    setResetting(true);
    const defaultWidgets = resolveLayout(context, null);
    // Restaurar padrão também vira RASCUNHO (Spec 69 §2.3): a página real só
    // volta ao padrão quando o usuário publicar. Até lá o rodapé mostra as
    // movimentações pendentes e "Descartar" desfaz o reset.
    const result = await updateDashboardLayoutAction(accountId, {
      context,
      widgets: defaultWidgets,
    });
    setResetting(false);
    setResetDialogOpen(false);
    if (result.ok) {
      setWidgets(defaultWidgets);
      savedRef.current = defaultWidgets;
      // Restaurar padrão é um ponto de partida novo: desfazer para um layout
      // anterior ao reset confundiria mais do que ajudaria.
      history.reset();
      enqueueSnackbar(m.settings.dashboards.resetToDefaultSuccess, { variant: "success" });
    } else {
      const detail = result.error?.message;
      enqueueSnackbar(
        detail ? `${m.settings.dashboards.saveError} ${detail}` : m.settings.dashboards.saveError,
        { variant: "error" },
      );
    }
  }, [accountId, context, enqueueSnackbar, history]);

  const secondaryActions = [
    ...(viewPageHref
      ? [
          {
            label: m.settings.presentation.dashboards.viewPage,
            icon: <VisibilityIcon fontSize="small" />,
            onClick: () => router.push(viewPageHref),
          },
        ]
      : []),
    {
      label: m.settings.dashboards.resetToDefault,
      icon: <RestartAltIcon fontSize="small" />,
      onClick: () => setResetDialogOpen(true),
    },
  ];

  return (
    <SettingsPageShell
      family="Apresentação"
      title={title}
      count={m.settings.presentation.dashboards.summary(widgets.length, usedRows)}
      purpose={purpose}
      secondaryActions={secondaryActions}
      // Rodapé de publicação: `dirtyCount` = movimentações desde o último
      // publicado. Enquanto for 0 a barra aparece com os botões desabilitados —
      // é o contrato do shell (Spec 67 D7) e diz ao usuário que existe um passo
      // de publicação, mesmo quando não há nada pendente.
      dirtyCount={dirtyCount}
      saveLabel={m.settings.presentation.dashboards.publishLabel}
      saving={publishing}
      onSave={handlePublish}
      onDiscard={handleDiscard}
    >
      {/*
        Barra de ferramentas do editor (frame 07): navegação entre as 3 páginas e
        desfazer/refazer à esquerda, adicionar widget à direita. O seletor de
        "dados de amostra" do frame NÃO entra, e não é esquecimento: o canvas
        desenha cards de widget, não os dados reais (que vêm de queries RSC das
        páginas de dashboard), então um seletor de período aqui não teria o que
        parametrizar — seria enfeite. Volta junto com o dia em que o editor
        renderizar widgets de verdade.
      */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          flexWrap: "wrap",
        }}
      >
        <ToggleButtonGroup
          size="small"
          exclusive
          value={context}
          aria-label={m.settings.presentation.dashboards.pagesLabel}
          onChange={(_, next: DashboardContext | null) => {
            if (next && next !== context) {
              router.push(`/${accountId}/settings/dashboards/${CONTEXT_ROUTE[next]}`);
            }
          }}
        >
          {(Object.keys(CONTEXT_ROUTE) as DashboardContext[]).map((key) => (
            <ToggleButton key={key} value={key} sx={{ fontSize: "0.75rem", py: 0.5, px: 1.5 }}>
              {CONTEXT_LABEL[key]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Tooltip title={m.settings.presentation.dashboards.undo}>
          {/* span: Tooltip precisa de um filho que aceite ref e eventos mesmo desabilitado */}
          <span>
            <IconButton
              size="small"
              aria-label={m.settings.presentation.dashboards.undo}
              disabled={!history.canUndo}
              onClick={handleUndo}
            >
              <UndoIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={m.settings.presentation.dashboards.redo}>
          <span>
            <IconButton
              size="small"
              aria-label={m.settings.presentation.dashboards.redo}
              disabled={!history.canRedo}
              onClick={handleRedo}
            >
              <RedoIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Box sx={{ flex: 1 }} />

        <Button
          size="small"
          variant="outlined"
          startIcon={<AddIcon fontSize="small" />}
          onClick={() => setPaletteOpen(true)}
          sx={{ fontSize: "0.75rem" }}
        >
          {m.settings.presentation.dashboards.addWidget}
        </Button>
      </Box>

      {/*
        Teto de largura: sem ele o grid estica indefinidamente em telas ultralargas
        (o `PageSettingsContainer` fazia isso antes do shell da Spec 67).
      */}
      <Box sx={{ maxWidth: containers.lg, mt: 2 }}>
        <DashboardGridCanvas
          widgets={widgets}
          registry={WIDGET_REGISTRY[context]}
          configOptions={configOptions}
          cols={cols}
          maxRows={maxRows}
          initialRows={initialRows}
          context={context}
          onLayoutChange={handleLayoutChange}
          paletteOpen={paletteOpen}
          onPaletteOpenChange={setPaletteOpen}
        />
      </Box>

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
    </SettingsPageShell>
  );
}
