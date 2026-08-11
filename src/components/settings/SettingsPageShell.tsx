"use client";

import Box from "@mui/material/Box";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { useParams } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";

import { SETTINGS_GUTTER } from "@/components/settings/settings-layout";
import { SettingsSaveBar } from "@/components/settings/SettingsSaveBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { containers, layout, typography } from "@/lib/design-tokens";
import { m } from "@/lib/messages";

/** As 5 famílias da Spec 67 §6. String literal e não enum: é o que vai no breadcrumb. */
export type SettingsFamily =
  | "Estrutura"
  | "Apresentação"
  | "Entrada de dados"
  | "Planejamento"
  | "Conta";

export type SettingsPageAction = {
  label: string;
  icon?: ReactNode;
  /**
   * Recebe o evento de clique (opcional para quem não precisa dele — uma função
   * `() => void` continua compatível). Existe para a Spec 68 §2.2: o menu
   * "Importar / Exportar" de Categorias precisa do `currentTarget` do botão para
   * ancorar o `<Menu>` do MUI, e a ação secundária não expõe outro jeito de obter
   * uma ref para o botão que o próprio shell renderiza.
   */
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
};

export type SettingsPageShellProps = {
  family: SettingsFamily;
  title: string;
  /**
   * Contagem ao lado do título — string, não número: cada página formata a sua
   * ("18 · 47 sub", "6 · 1 inativa", "últimos 90 dias").
   */
  count?: string;
  /** Obrigatória (regra 3): é a frase que desfaz a ambiguidade entre "Modelos", "Templates" e "Tipos". */
  purpose: string;
  /** Uma única ação primária, sempre `contained`, sempre no canto superior direito (regra 4). */
  primaryAction?: SettingsPageAction;
  /** Secundárias, sempre `outlined` e sempre À ESQUERDA da primária (regra 4). */
  secondaryActions?: SettingsPageAction[];
  /**
   * Controles de escala (busca/filtro/ordenação). Renderizados SOMENTE quando
   * `itemCount > 12` — o gate é do shell, não da página (D6).
   */
  toolbar?: ReactNode;
  itemCount?: number;
  /**
   * Faixa informativa (legendas, avisos). NUNCA sujeita ao gate dos 12 (D12):
   * a legenda de tipos de Seções precisa aparecer numa lista de 6 itens.
   */
  subheader?: ReactNode;
  /** Marca a página como owner-only com um badge ao lado do título. */
  ownerOnly?: boolean;
  /**
   * Rodapé de salvar (regra 7 / D7):
   *   undefined -> sem barra (listas A/B, que salvam inline)
   *   0         -> barra visível com "Nenhuma alteração" e botões desabilitados
   *   > 0       -> "N alterações não salvas", botões habilitados
   */
  dirtyCount?: number;
  /** Rótulo da primária do rodapé; default "Salvar" (D13 — a Spec 69 usa "Salvar tipo", "Publicar layout"). */
  saveLabel?: string;
  saving?: boolean;
  onSave?: () => void;
  onDiscard?: () => void;
  /**
   * Remove o padding da área de conteúdo. Necessário no arquétipo C
   * (master-detail), em que a lista mestre encosta na borda do painel (D16).
   */
  disableContentPadding?: boolean;
  /**
   * Conteúdo de largura total, sem o cap de leitura (Spec 68, revisão de estilo).
   *
   * Ligue nas páginas de LISTA: a tabela ocupa o painel inteiro, como no frame. Deixe
   * desligado nos formulários, onde o cap existe para o campo não esticar de ponta a
   * ponta num monitor largo.
   */
  wideContent?: boolean;
  children: ReactNode;
};

/** Gate da regra 5 / SET-04, isolado para o teste unitário do §8 da spec. */
export function shouldRenderToolbar(itemCount: number | undefined): boolean {
  return itemCount !== undefined && itemCount > 12;
}

/**
 * Moldura única das 15 páginas de Configurações (Spec 67 §2.2 — SET-03).
 *
 * A página declara CONTEÚDO; a moldura (breadcrumb, título, contagem, propósito,
 * ação primária, toolbar, rodapé de salvar) vem toda daqui. Cabeçalho próprio por
 * página é exatamente o anti-padrão que a spec chama de SET-03.
 *
 * Escala tipográfica: segue o frame (decisão D5), que é mais densa que o resto do
 * app — por isso este shell NÃO reusa `@/components/ui/PageHeader` (que renderiza
 * `h3` e não tem slot para o chip de contagem).
 */
export function SettingsPageShell({
  family,
  title,
  count,
  purpose,
  primaryAction,
  secondaryActions,
  toolbar,
  itemCount,
  subheader,
  ownerOnly = false,
  dirtyCount,
  saveLabel,
  saving,
  onSave,
  onDiscard,
  disableContentPadding = false,
  wideContent = false,
  children,
}: SettingsPageShellProps) {
  // accountId vem da rota em vez de virar prop obrigatória nas 15 páginas.
  const params = useParams<{ accountId: string }>();
  const settingsHref = params?.accountId ? `/${params.accountId}/settings` : undefined;

  const showToolbar = shouldRenderToolbar(itemCount);
  const showSaveBar = dirtyCount !== undefined;

  return (
    // `height: 100%` + `overflow: hidden`: a moldura não rola. Quem rola é só a área
    // de conteúdo, mais abaixo — o cabeçalho e a toolbar ficam onde estão.
    <Stack sx={{ height: "100%", minHeight: 0, overflow: "hidden" }}>
      <Box
        component="header"
        sx={{
          flexShrink: 0,
          px: SETTINGS_GUTTER,
          pt: layout.stack,
          pb: layout.inline,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Breadcrumbs
          separator="/"
          aria-label={m.settings.shell.breadcrumbLabel}
          sx={{ mb: layout.micro }}
        >
          {settingsHref ? (
            <Link
              component={NextLink}
              href={settingsHref}
              variant="caption"
              underline="hover"
              sx={{ color: "text.tertiary" }}
            >
              {m.settings.shell.breadcrumbRoot}
            </Link>
          ) : (
            <Typography variant="caption">{m.settings.shell.breadcrumbRoot}</Typography>
          )}
          <Typography variant="caption">{family}</Typography>
        </Breadcrumbs>

        {/*
          `justifyContent: flex-end` + `mr: auto` no bloco de identidade (em vez de um
          espaçador flexível): quando o wrap dispara, os botões descem encostados à
          DIREITA, como no frame — um espaçador vira uma linha vazia e joga as ações
          para a esquerda.
        */}
        <Stack
          direction="row"
          alignItems="center"
          spacing={layout.inline}
          useFlexGap
          sx={{ flexWrap: "wrap", justifyContent: "flex-end" }}
        >
          <Stack
            direction="row"
            alignItems="center"
            spacing={layout.inline}
            useFlexGap
            sx={{ flexWrap: "wrap", minWidth: 0, mr: "auto" }}
          >
            <Typography variant="h4" component="h1">
              {title}
            </Typography>

            {count !== undefined && (
              <Chip
                size="small"
                variant="outlined"
                label={count}
                sx={{
                  color: "text.tertiary",
                  borderColor: "border.subtle",
                  bgcolor: "background.subtle",
                  fontFamily: typography.fontFamily.mono,
                }}
              />
            )}

            {/*
              `neutral`, não `warning`: "owner" é metadado, não aviso. O mostarda
              fica reservado para "pede atenção" — no hub as duas coisas apareciam
              na mesma cor, a 40px de distância.
            */}
            {ownerOnly && <StatusBadge variant="neutral">{m.settings.shell.ownerOnly}</StatusBadge>}
          </Stack>

          {secondaryActions?.map((action) => (
            <Button
              key={action.label}
              variant="outlined"
              size="small"
              startIcon={action.icon}
              onClick={action.onClick}
              disabled={action.disabled}
            >
              {action.label}
            </Button>
          ))}

          {primaryAction && (
            <Button
              variant="contained"
              size="small"
              startIcon={primaryAction.icon}
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
            >
              {primaryAction.label}
            </Button>
          )}
        </Stack>

        {/* D20: tom terciário — em `text.secondary` a frase competia com o título. */}
        <Typography
          variant="body2"
          sx={{ mt: layout.micro, maxWidth: 640, color: "text.tertiary" }}
        >
          {purpose}
        </Typography>
      </Box>

      {subheader}

      {showToolbar && toolbar}

      {/*
        A ÚNICA área que rola. O cabeçalho da página fica parado acima dela.

        `maxWidth`: os formulários mantêm o cap (um `TextField` esticado por um monitor
        de 2560px é ilegível). As LISTAS não — o frame não tem tabela mais estreita que
        o painel, e o cap deixava uma faixa morta à direita da tabela em tela larga.
        Por isso `wideContent`, e não um cap global.
      */}
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          ...(disableContentPadding
            ? {}
            : {
                px: SETTINGS_GUTTER,
                py: wideContent ? 0 : layout.stack,
                ...(wideContent ? {} : { maxWidth: containers.lg }),
              }),
        }}
      >
        {children}
      </Box>

      {showSaveBar && (
        <SettingsSaveBar
          dirtyCount={dirtyCount}
          saveLabel={saveLabel}
          saving={saving}
          onSave={onSave ?? (() => undefined)}
          onDiscard={onDiscard ?? (() => undefined)}
        />
      )}
    </Stack>
  );
}
