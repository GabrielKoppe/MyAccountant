"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { layout, typography } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import { formatCentsToBrl } from "@/lib/money";
import type { MonthAutomationGroup, MonthAutomationItem } from "@/server/services/month-service";

const KIND_LABEL: Record<MonthAutomationGroup["kind"], string> = {
  table_template: m.months.automations.kindTableTemplate,
  pending_installment: m.months.automations.kindPendingInstallment,
};

type Props = {
  groups: MonthAutomationGroup[];
  /** Ids marcados, por `kind` — controlado pelo host (CreateMonthModal). */
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleGroup: (kind: MonthAutomationGroup["kind"], selectAll: boolean) => void;
  disabled?: boolean;
};

/** Linha de detalhe: seção › tipo de tabela · N itens | k/N · origem. */
function itemDetail(kind: MonthAutomationGroup["kind"], item: MonthAutomationItem): string {
  const parts: string[] = [];

  const destination = [item.sectionName, item.tableTypeName].filter(Boolean).join(" › ");
  if (destination) parts.push(destination);

  if (kind === "table_template" && item.itemCount !== null) {
    parts.push(m.months.automations.templateItems(item.itemCount));
  }

  if (kind === "pending_installment") {
    if (item.installmentNumber !== null && item.installmentCount !== null) {
      parts.push(
        m.months.automations.installmentPosition(item.installmentNumber, item.installmentCount),
      );
    }
    parts.push(
      item.defaultSelected ? m.months.automations.originManual : m.months.automations.originImport,
    );
  }

  if (item.blockedReason) parts.push(m.months.automations.blocked[item.blockedReason]);

  return parts.join(" · ");
}

/**
 * Passo "Automações" do dialog de novo mês (spec 73 §2.4): mostra o que será
 * criado junto com o mês e deixa o usuário escolher item por item. A escolha
 * vale só para esta criação — não altera a preferência de nenhum parcelamento.
 */
export function MonthAutomationsStep({
  groups,
  selectedIds,
  onToggle,
  onToggleGroup,
  disabled = false,
}: Props) {
  const allItems = groups.flatMap((g) => g.items);
  const selectedItems = allItems.filter((i) => selectedIds.has(i.id));
  const totalCents = selectedItems.reduce((sum, i) => sum + BigInt(i.amountCents), 0n);
  const totalTransactions = selectedItems.reduce((sum, i) => sum + (i.itemCount ?? 1), 0);

  return (
    <Stack spacing={layout.inline} sx={{ mt: layout.micro }}>
      <Typography variant="body2" color="text.secondary">
        {m.months.automations.description}
      </Typography>

      {groups.map((group) => {
        const selectable = group.items.filter((i) => !i.blockedReason);
        const selectedInGroup = selectable.filter((i) => selectedIds.has(i.id)).length;
        const allSelected = selectable.length > 0 && selectedInGroup === selectable.length;

        return (
          <Box
            key={group.kind}
            sx={{ border: 1, borderColor: "border.subtle", borderRadius: 1, overflow: "hidden" }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: layout.micro,
                px: 1.5,
                py: 0.75,
                bgcolor: "surface.muted",
              }}
            >
              <Checkbox
                size="small"
                checked={allSelected}
                indeterminate={selectedInGroup > 0 && !allSelected}
                disabled={disabled || selectable.length === 0}
                onChange={() => onToggleGroup(group.kind, !allSelected)}
                sx={{ p: 0.25 }}
                inputProps={{ "aria-label": KIND_LABEL[group.kind] }}
              />
              <Typography
                component="span"
                sx={{
                  flex: 1,
                  fontWeight: 600,
                  fontSize: "0.66rem",
                  fontFamily: typography.fontFamily.mono,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "neutral.main",
                }}
              >
                {KIND_LABEL[group.kind]}
              </Typography>
              <Typography sx={{ fontSize: "0.7rem", color: "neutral.main" }}>
                {m.months.automations.selectedCount(selectedInGroup, selectable.length)}
              </Typography>
            </Box>

            <Stack divider={<Divider />} spacing={0}>
              {group.items.map((item) => {
                const isBlocked = Boolean(item.blockedReason);
                return (
                  <Box
                    key={item.id}
                    sx={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: layout.micro,
                      px: 1.5,
                      py: 1,
                      opacity: isBlocked ? 0.6 : 1,
                    }}
                  >
                    <Checkbox
                      size="small"
                      checked={selectedIds.has(item.id)}
                      disabled={disabled || isBlocked}
                      onChange={() => onToggle(item.id)}
                      sx={{ p: 0.25, mt: 0.125 }}
                      inputProps={{ "aria-label": item.label }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        sx={{
                          fontSize: "0.82rem",
                          fontWeight: 500,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.label}
                      </Typography>
                      <Typography sx={{ fontSize: "0.7rem", color: "neutral.main", mt: "1px" }}>
                        {itemDetail(group.kind, item)}
                      </Typography>
                    </Box>
                    <Typography
                      component="span"
                      sx={{
                        flexShrink: 0,
                        fontFamily: typography.fontFamily.mono,
                        fontVariantNumeric: "tabular-nums",
                        fontSize: "0.78rem",
                        color: "text.secondary",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatCentsToBrl(BigInt(item.amountCents))}
                    </Typography>
                  </Box>
                );
              })}
            </Stack>
          </Box>
        );
      })}

      {selectedItems.length === 0 ? (
        <Alert severity="info" sx={{ fontSize: "0.78rem", py: 0.25 }}>
          {m.months.automations.nothingSelected}
        </Alert>
      ) : (
        <Typography sx={{ fontSize: "0.78rem", color: "text.secondary" }}>
          {m.months.automations.totalToLaunch(formatCentsToBrl(totalCents), totalTransactions)}
        </Typography>
      )}
    </Stack>
  );
}
