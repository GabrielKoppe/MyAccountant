/**
 * Seção read-only da gaveta de anexos. Espelha a estrutura dos colapsáveis de
 * edição (label em caixa alta + conteúdo, `px:2 py:1.5`), com uma ação opcional
 * alinhada à direita do rótulo (ex.: "Gerenciar vínculos", "Ver grupo").
 */
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

const LABEL_SX = {
  display: "block",
  textTransform: "uppercase",
  letterSpacing: 0.5,
  fontSize: 10,
  fontWeight: 500,
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
        justifyContent="flex-start"
        gap={1}
        sx={{ minHeight: 24, mb: 0.5 }}
      >
        <Typography variant="caption" color="text.primary" sx={LABEL_SX}>
          {label}
        </Typography>
        {action}
      </Stack>
      {children}
    </Box>
  );
}

export default SectionDrawer;