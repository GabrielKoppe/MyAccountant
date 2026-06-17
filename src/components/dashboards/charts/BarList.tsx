import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";

import { formatCentsToBrl } from "@/lib/money";

export type BarItem = {
  /** Chave única para React. Usa `name` como fallback. */
  id?: string | null;
  name: string;
  /** Valor em centavos (string para suportar BigInt serializado). Aceita negativos. */
  valueCents: string;
};

type Props = {
  items: BarItem[];
  emptyMessage?: string;
};

/**
 * Lista genérica de barras de progresso com valor monetário.
 * Reutilizável para categorias, seções, qualquer agrupamento financeiro.
 */
export function BarList({ items, emptyMessage = "Nenhum item com transações." }: Props) {
  if (items.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {emptyMessage}
      </Typography>
    );
  }

  const maxAbsValue = items.reduce((max, item) => {
    const v = Math.abs(Number(BigInt(item.valueCents)));
    return v > max ? v : max;
  }, 0);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {items.map((item) => {
        const absValue = Math.abs(Number(BigInt(item.valueCents)));
        const pct = maxAbsValue > 0 ? (absValue / maxAbsValue) * 100 : 0;
        return (
          <Box key={item.id ?? item.name}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
              <Typography variant="body2" noWrap sx={{ maxWidth: "60%" }}>
                {item.name}
              </Typography>
              <Typography variant="body2" fontWeight="medium" color="text.secondary">
                {formatCentsToBrl(BigInt(item.valueCents))}
              </Typography>
            </Box>
            <LinearProgress variant="determinate" value={pct} sx={{ height: 6, borderRadius: 3 }} />
          </Box>
        );
      })}
    </Box>
  );
}
