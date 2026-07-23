"use client";

import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";

import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
// `import type` some apagado em runtime — não cria aresta pro grafo de módulos, então
// este componente continua client-safe mesmo o tipo vindo de queries/budgets.ts (que
// importa `prisma`). Mesmo racional de `budget-label.ts`.
import type { BudgetWithDetails } from "@/server/queries/budgets";

type Size = "small" | "medium" | "large";

const chipSizeMap: Record<Size, { chipSize: "small" | "medium"; fontSize?: string }> = {
  small: { chipSize: "small", fontSize: "0.65rem" },
  medium: { chipSize: "small" },
  large: { chipSize: "medium" },
};

type Props = {
  budget: BudgetWithDetails;
  /** Card compacto da grid (spec 47 §5.9 fix wave): limita a 2 nomes por dimensão + "+N"
   * no CHIP; o Tooltip sempre mostra a lista completa. Default `false` — usado pelo
   * `BudgetDetailDialog`, que tem espaço de sobra para os nomes completos. */
  compact?: boolean;
  /** Tamanho visual dos chips. `"medium"` (padrão) mantém o comportamento atual. */
  size?: Size;
};

/**
 * UM chip por DIMENSÃO do orçamento (prefixo + valores), reusando os nomes já
 * resolvidos por `serializeBudget` (`budget.sections/.categories/.members/.institutions/
 * .tableTypes`) — leitura, não edição. Extraído de `BudgetsPlanningManager.tsx` (fonte
 * original) para ser compartilhado com `BudgetDetailDialog.tsx` sem duplicar a lógica
 * de junção de nomes (spec 47 §5.9 fix wave).
 */
export function DimensionChips({ budget, compact = false, size = "medium" }: Props) {
  const { chipSize, fontSize } = chipSizeMap[size];
  const dims: { label: string; full: string }[] = [];
  const add = (prefix: string, names: string[]) => {
    if (names.length === 0) return;
    const full = `${prefix}: ${names.join(", ")}`;
    // Compacto: só os 2 primeiros nomes + contagem do restante — o chip do card não
    // pode crescer sem limite numa grid de 3 colunas.
    const label =
      compact && names.length > 2
        ? `${prefix}: ${names.slice(0, 2).join(", ")} +${names.length - 2}`
        : full;
    dims.push({ label, full });
  };
  add(
    m.budgets.fields.section,
    budget.sections.map((s) => s.name),
  );
  add(
    m.budgets.fields.category,
    budget.categories.map((c) => c.name),
  );
  add(
    m.budgets.fields.member,
    budget.members.map((mb) => mb.name ?? m.budgets.fields.member),
  );
  add(
    m.budgets.fields.institution,
    budget.institutions.map((i) => i.name),
  );
  add(
    m.budgets.fields.tableType,
    budget.tableTypes.map((t) => t.name),
  );

  if (dims.length === 0) return null;

  return (
    <Stack direction="row" gap={layout.inline} flexWrap="wrap" sx={{ minWidth: 0 }}>
      {dims.map((d) => (
        <Tooltip key={d.full} title={d.full}>
          <Chip
            label={d.label}
            size={chipSize}
            variant="outlined"
            sx={{ maxWidth: "100%", ...(fontSize && { fontSize }) }}
          />
        </Tooltip>
      ))}
    </Stack>
  );
}
