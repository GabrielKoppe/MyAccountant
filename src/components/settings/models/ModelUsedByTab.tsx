"use client";

import HistoryToggleOffIcon from "@mui/icons-material/HistoryToggleOff";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { SettingsFieldLabel } from "@/components/settings/SettingsFieldLabel";
import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";

const u = m.settings.presentation.models.usedBy;

/**
 * Data em que `FinanceTable.createdFromTemplateId` passou a ser gravado — a
 * migração `20260811215017_spec69_apresentacao_density_columns_dayrule_provenance`.
 *
 * Literal, e não `new Date()`: é um fato do passado, não "hoje". Derivar do relógio
 * faria a nota mudar de texto todo dia e amarraria o teste ao horário da máquina.
 */
export const PROVENANCE_CUTOFF_LABEL = "11/08/2026";

/** Proveniência de um modelo: tabelas nascidas dele e em quantos meses distintos. */
export type ModelUsage = { tables: number; months: number };

export type ModelUsedByTabProps = {
  usage: ModelUsage;
  /** Data de corte já formatada (dd/MM/aaaa) — o componente não olha o relógio. */
  cutoffDate: string;
};

/**
 * Aba 3 · Onde é usado (Spec 69 §14 P9, D6).
 *
 * **Por que aqui NÃO há o cartão "Contar" do `OnDemandUsagePanel`:** aquele painel
 * conta `Transaction`, e `tableTemplate` está fora de `COUNTABLE_USAGE_ENTITIES` de
 * propósito — não existe caminho de um modelo até uma transação (§ do schema de
 * `settings-usage`). O que um modelo tem é PROVENIÊNCIA: `FinanceTable
 * .createdFromTemplateId`, uma coluna indexada por `[accountId,
 * createdFromTemplateId]`. Contar isso não varre transação nenhuma, então não há
 * custo a diferir — e um botão "Contar" na frente de um número já disponível seria
 * teatro. Os números chegam prontos do RSC; esta aba não dispara nenhuma contagem.
 *
 * **Nota de corte, sempre visível (D6):** não houve backfill. Tabela criada antes
 * desta spec não guarda a origem e não entra no número. Exibir o total sem dizer
 * isso seria exibir um número que parece completo e não é.
 *
 * TODO(P9-servidor): se a contagem de TRANSAÇÕES nascidas de um modelo passar a ser
 * desejada, ela precisa de query nova (`Transaction` → `FinanceTable`
 * → `createdFromTemplateId`) e, aí sim, do `OnDemandUsagePanel` — o custo passaria a
 * existir. Nada disso pode ser escrito neste pacote (é `src/server/`).
 */
export function ModelUsedByTab({ usage, cutoffDate }: ModelUsedByTabProps) {
  return (
    <Box sx={{ py: layout.stack }}>
      <SettingsFieldLabel>{u.title}</SettingsFieldLabel>

      {usage.tables === 0 ? (
        <Typography variant="body2" sx={{ color: "text.tertiary", mb: layout.stack }}>
          {u.empty}
        </Typography>
      ) : (
        <Box
          sx={{
            p: layout.stack,
            mb: layout.stack,
            borderRadius: "8px",
            border: 1,
            borderColor: "border.subtle",
            bgcolor: "background.canvas",
          }}
        >
          <Typography variant="mono" component="div" sx={{ fontSize: "1.1rem", fontWeight: 500 }}>
            {u.result(usage.tables, usage.months)}
          </Typography>
        </Box>
      )}

      <Stack
        direction="row"
        spacing={layout.inline}
        alignItems="flex-start"
        sx={{
          p: layout.stack,
          borderRadius: "8px",
          border: 1,
          borderStyle: "dashed",
          borderColor: "border.strong",
        }}
      >
        <HistoryToggleOffIcon fontSize="small" sx={{ color: "text.tertiary", mt: "2px" }} />
        <Typography variant="body2" sx={{ color: "text.tertiary" }}>
          {u.cutoffNote(cutoffDate)}
        </Typography>
      </Stack>
    </Box>
  );
}
