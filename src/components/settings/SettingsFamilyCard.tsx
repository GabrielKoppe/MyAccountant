import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import type { SettingsFamily } from "@/components/settings/settings-catalog";
import { SETTINGS_ENTRY_ICONS, SETTINGS_FAMILY_ICONS } from "@/components/settings/settings-icons";
import { AppLink } from "@/components/ui/AppLink";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { layout, typography } from "@/lib/design-tokens";
import { m } from "@/lib/messages";

export type SettingsFamilyCardProps = {
  family: SettingsFamily;
  accountId: string;
  /**
   * Contagem barata por `href` (vinda de `getSettingsCounts`). Chave ausente =
   * a página não tem contagem (Geral, Auditoria) e a linha sai sem número —
   * nunca "0" inventado.
   */
  counts: Record<string, string>;
  /** `href`s com sinalizador de atenção (Spec 67 §2.1) — ganham o ícone de alerta. */
  flaggedHrefs?: string[];
};

/**
 * Um card do hub de Configurações (Spec 67 §2.1 / §4 SET-02).
 *
 * Cabeçalho com o ícone e o rótulo da família, e uma linha por página com
 * ícone, rótulo, subtítulo e contagem. A linha inteira é o link.
 *
 * Duas disposições, ambas do frame de arquitetura:
 *  - **coluna** (padrão) — entradas empilhadas, separadas por borda superior;
 *  - **faixa** (`family.wide`, hoje só Conta) — entradas LADO A LADO, em colunas
 *    de largura igual separadas por borda lateral. É o que isola a administração
 *    no rodapé do hub sem que ela vire mais um card na grade.
 *
 * `height: 100%` para o card preencher a célula do grid: as famílias da mesma
 * fileira têm quantidades diferentes de páginas (Estrutura tem 4, Apresentação e
 * Entrada de dados têm 3) e, sem isso, os cards ficam com alturas desencontradas.
 *
 * Sem `CardContent` de propósito: o padding de 24px do tema afastaria as linhas
 * das bordas e quebraria o separador de largura total do frame.
 *
 * Server Component: só props serializáveis, sem estado nem handler. A fronteira
 * client já é o `AppLink` — marcar o card inteiro como client embarcaria
 * Card/List/ListItemButton no bundle da porta de entrada de Configurações.
 */
export function SettingsFamilyCard({
  family,
  accountId,
  counts,
  flaggedHrefs = [],
}: SettingsFamilyCardProps) {
  const flagged = new Set(flaggedHrefs);
  const isWide = family.wide === true && family.entries.length > 1;
  const tone = family.tone ?? "accent";

  return (
    <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Stack
        direction="row"
        alignItems="center"
        spacing={layout.inline}
        sx={{
          px: layout.stack,
          py: layout.inline,
          bgcolor: "background.subtle",
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        {/* Mostarda na Conta, accent nas outras — é o que o frame faz. O tom
            marca "baixa frequência, alto impacto", e vem junto no ícone e no
            badge para o cabeçalho ler como uma coisa só. */}
        <Box
          aria-hidden
          sx={{ display: "flex", color: tone === "warning" ? "warning.main" : "accent.primary" }}
        >
          {SETTINGS_FAMILY_ICONS[family.icon]}
        </Box>

        <Typography variant="overline" component="h2">
          {family.label}
        </Typography>

        {family.ownerBadge && (
          <Box sx={{ ml: "auto" }}>
            <StatusBadge variant={tone === "warning" ? "warning" : "neutral"}>
              {m.settings.hub.ownerOnlyBadge}
            </StatusBadge>
          </Box>
        )}
      </Stack>

      <List
        disablePadding
        sx={
          isWide
            ? {
                // Faixa: colunas de largura igual. Em telas estreitas não cabem
                // lado a lado, então volta a empilhar.
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: `repeat(${family.entries.length}, 1fr)`,
                },
                // `start`: a linha da grade mantém a altura do conteúdo. Sem
                // isso ela absorve a folga do card esticado e as três entradas
                // ficam com o dobro da altura das linhas dos outros cards.
                alignContent: "start",
                flex: 1,
              }
            : { flex: 1 }
        }
      >
        {family.entries.map((entry, index) => {
          const count = counts[entry.href];
          // Na faixa o separador é vertical (a borda fica à ESQUERDA de cada
          // entrada, menos a primeira); na coluna, horizontal.
          //
          // ARMADILHA: aqui é `borderXWidth`/`borderXStyle` e NUNCA o shorthand
          // `borderLeft: 1`. O shorthand emitido dentro de media query (que é o
          // caso de qualquer valor responsivo no `sx`) reseta
          // `border-left-color` para `currentColor` — e, como a media query vem
          // depois no CSS, ela vence o `borderColor` e o divider sai quase
          // preto, na cor do texto. Longhand de width/style não toca a cor.
          const separator =
            index === 0
              ? undefined
              : isWide
                ? {
                    borderTopWidth: { xs: "1px", sm: 0 },
                    borderLeftWidth: { xs: 0, sm: "1px" },
                    borderStyle: "solid",
                    borderRightWidth: 0,
                    borderBottomWidth: 0,
                    borderColor: "divider",
                  }
                : {
                    borderTopWidth: "1px",
                    borderStyle: "solid",
                    borderRightWidth: 0,
                    borderBottomWidth: 0,
                    borderLeftWidth: 0,
                    borderColor: "divider",
                  };

          return (
            <ListItem key={entry.href} disablePadding sx={separator}>
              <ListItemButton
                component={AppLink}
                href={`/${accountId}/settings/${entry.href}`}
                // `height: 100%` para que, na faixa, as três colunas tenham a
                // mesma altura mesmo com subtítulos de tamanhos diferentes.
                sx={{ px: layout.stack, py: layout.inline, gap: layout.inline, height: "100%" }}
              >
                <Box aria-hidden sx={{ display: "flex", color: "text.tertiary" }}>
                  {SETTINGS_ENTRY_ICONS[entry.icon]}
                </Box>

                <ListItemText
                  primary={entry.label}
                  secondary={entry.subtitle}
                  // `medium` (500, e não o 400 do body2) é o que separa o nome do
                  // subtítulo dentro da mesma linha — o frame usa esse peso em `.hrow .n`.
                  primaryTypographyProps={{
                    variant: "body2",
                    fontWeight: typography.fontWeight.medium,
                    color: "text.primary",
                  }}
                  secondaryTypographyProps={{ variant: "caption", component: "span" }}
                  sx={{ my: 0, "& .MuiListItemText-secondary": { display: "block" } }}
                />

                {flagged.has(entry.href) && (
                  // `titleAccess` porque cor não pode ser a única informação:
                  // quem não distingue o mostarda precisa do texto.
                  <ErrorOutlineIcon
                    fontSize="small"
                    titleAccess={m.settings.hub.rowNeedsAttention}
                    sx={{ color: "warning.main", flexShrink: 0 }}
                  />
                )}

                {count !== undefined && (
                  <Typography
                    variant="caption"
                    sx={{
                      fontFamily: typography.fontFamily.mono,
                      color: "text.tertiary",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    {count}
                  </Typography>
                )}
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Card>
  );
}
