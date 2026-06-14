"use client";

import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";

import { m } from "@/lib/messages";
import { BudgetProgressBar } from "@/components/budgets/BudgetProgressBar";
import type { BudgetProgress } from "@/lib/queries/budgets";

type Props = {
  budgets: BudgetProgress[];
  /** Exibe empty state com botão de adicionar quando não há metas */
  onAddClick?: () => void;
  /** Modo compacto para o BudgetProgressBar (ex: no resumo do mês) */
  compact?: boolean;
};

export function BudgetWidgetContent({ budgets, onAddClick, compact = false }: Props) {
  if (budgets.length === 0) {
    return (
      <Stack direction="column" alignItems="center" gap={1.5} sx={{ py: 3 }}>
        <Typography variant="caption" color="text.secondary">
          Defina metas de orçamento para acompanhar no dashboard.
        </Typography>
        {onAddClick && (
          <Button
            size="small"
            variant="text"
            startIcon={<AddIcon />}
            onClick={onAddClick}
            sx={{ color: "text.secondary", fontSize: "0.75rem" }}
          >
            {m.budgets.createButton}
          </Button>
        )}
      </Stack>
    );
  }

  return (
    <Stack spacing={compact ? 1.25 : 1.5}>
      {budgets.map((b) => (
        <BudgetProgressBar
          key={b.id}
          label={b.label}
          amountCents={b.amountCents}
          spentCents={b.spentCents}
          percent={b.percent}
          alertThresholdPercent={b.alertThresholdPercent}
          compact={compact}
        />
      ))}
    </Stack>
  );
}
