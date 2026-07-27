/**
 * Seção read-only da gaveta de anexos. Espelha a estrutura dos colapsáveis de
 * edição (label em caixa alta + conteúdo, `px:2 py:1.5`), com uma ação opcional
 * alinhada à direita do rótulo (ex.: "Vincular", "Ver grupo").
 *
 * Frame 66 §7: o cabeçalho da seção é SÓ o rótulo `.cap` — sem ícone (o ícone
 * já vive no toggle da barra de ferramentas, `RowDrawerToolbar` +
 * `drawerSectionMeta`). Por isso este componente não aceita mais uma prop
 * `icon`.
 */
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

// `.cap` do frame: fontWeight 600, 0.62rem, mono, letterSpacing .06em,
// uppercase, `text.tertiary`.
const LABEL_SX = {
  display: "block",
  textTransform: "uppercase",
  letterSpacing: ".06em",
  fontSize: "0.62rem",
  fontWeight: 600,
  fontFamily: "var(--font-jetbrains-mono), 'JetBrains Mono', monospace",
  color: "text.tertiary",
} as const;

function SectionDrawer({
  label,
  action,
  children,
}: {
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Box sx={{ px: 2, py: 1.5 }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        sx={{ minHeight: 20, mb: 1 }}
      >
        <Typography variant="caption" sx={LABEL_SX}>
          {label}
        </Typography>
        {action}
      </Stack>
      {children}
    </Box>
  );
}

export default SectionDrawer;
