import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";

import { formatCentsToBrl } from "@/lib/money";
import type { CategorySum } from "@/lib/queries/dashboards";

type Props = {
  categories: CategorySum[];
};

export function CategoryBarList({ categories }: Props) {
  if (categories.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Nenhuma categoria com transações.
      </Typography>
    );
  }

  const maxCents = BigInt(
    categories.reduce((max, c) => {
      const v = Math.abs(Number(BigInt(c.totalCents)));
      return v > max ? v : max;
    }, 0),
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {categories.map((cat) => {
        const absCents = BigInt(cat.totalCents) < 0n ? -BigInt(cat.totalCents) : BigInt(cat.totalCents);
        const pct = maxCents > 0n ? Number((absCents * 100n) / maxCents) : 0;
        return (
          <Box key={cat.categoryId ?? "none"}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
              <Typography variant="body2" noWrap sx={{ maxWidth: "60%" }}>
                {cat.name}
              </Typography>
              <Typography variant="body2" fontWeight="medium" color="text.secondary">
                {formatCentsToBrl(BigInt(cat.totalCents))}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={pct}
              sx={{ height: 6, borderRadius: 3 }}
            />
          </Box>
        );
      })}
    </Box>
  );
}
