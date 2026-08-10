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

  return (
    <Card>
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
        <Box aria-hidden sx={{ display: "flex", color: "accent.primary" }}>
          {SETTINGS_FAMILY_ICONS[family.icon]}
        </Box>

        <Typography variant="overline" component="h2">
          {family.label}
        </Typography>

        {family.ownerBadge && (
          <Box sx={{ ml: "auto" }}>
            {/* `neutral`, não `warning`: o mostarda deste card já significa "pede
                atenção" (o ícone de alerta da linha, a 40px daqui). Duas semânticas
                para a mesma cor quebram o "cor é informação" do design system. */}
            <StatusBadge variant="neutral">{m.settings.hub.ownerOnlyBadge}</StatusBadge>
          </Box>
        )}
      </Stack>

      <List disablePadding>
        {family.entries.map((entry, index) => {
          const count = counts[entry.href];

          return (
            <ListItem
              key={entry.href}
              disablePadding
              // Separador entre linhas — a primeira encosta no cabeçalho, que já
              // tem a sua própria borda inferior.
              sx={index > 0 ? { borderTop: 1, borderColor: "border.subtle" } : undefined}
            >
              <ListItemButton
                component={AppLink}
                href={`/${accountId}/settings/${entry.href}`}
                sx={{ px: layout.stack, py: layout.inline, gap: layout.inline }}
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
