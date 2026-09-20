"use client";

import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import type { CSSProperties, ReactNode } from "react";

import { RowActionsMenu } from "@/components/settings/RowActionsMenu";
import { SETTINGS_GRIP_WIDTH } from "@/components/settings/table/settings-table-tokens";
import {
  LivePreviewRow,
  type LivePreviewCell,
} from "@/components/settings/table-types/LivePreviewRow";
import { PartyAvatar } from "@/components/transactions/PartyAvatar";
import { pillOutlineSx } from "@/components/transactions/pill-sx";
import type { ResponsiblePartyOption } from "@/components/transactions/types";
import { m } from "@/lib/messages";
import { formatCentsToBrl } from "@/lib/money";
import type { RowLayout } from "@/lib/schemas/settings";
import type { TableColumnKey } from "@/lib/table-columns";
import type { Density } from "@/lib/table-density";

import { dayRuleLabel } from "./DayRuleField";
import type { ModelItem } from "./model-item-draft";

const t = m.settings.presentation.models.transactions;

export type ModelItemLookups = {
  categories: { id: string; name: string; subcategories: { id: string; name: string }[] }[];
  institutions: { id: string; name: string }[];
  parties: ResponsiblePartyOption[];
};

export type ModelItemRowProps = {
  item: ModelItem;
  columns: readonly TableColumnKey[];
  rowLayout: RowLayout;
  density: Density;
  lookups: ModelItemLookups;
  last?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  /** Alça pronta do `SortableRow` — renderizada à esquerda da linha. */
  handle?: ReactNode;
  setNodeRef?: (node: HTMLElement | null) => void;
  dragStyle?: CSSProperties;
};

/**
 * Uma transação de modelo em LEITURA, renderizada com o tipo do próprio modelo
 * (Spec 69 §2.2 — "mesmo layout e densidade que a tabela real terá").
 *
 * É o `LivePreviewRow` da aba de Tipos, e não uma tabela paralela: o `content` de
 * cada célula aceita `ReactNode` e existe o slot `trailing`, que é exatamente o
 * que permite pendurar o menu `⋮` no fim da linha sem duplicar o desenho. Se esta
 * aba desenhasse a própria linha, ela e a tabela do mês divergiriam no primeiro
 * ajuste de estilo — e a promessa da aba é justamente "é assim que vai ficar".
 */
export function ModelItemRow({
  item,
  columns,
  rowLayout,
  density,
  lookups,
  last = false,
  onEdit,
  onDelete,
  handle,
  setNodeRef,
  dragStyle,
}: ModelItemRowProps) {
  const amountCents = BigInt(item.amountCents);
  const isBlank = amountCents === 0n;
  const category = lookups.categories.find((c) => c.id === item.categoryId);
  const institution = lookups.institutions.find((i) => i.id === item.institutionId);
  const party = lookups.parties.find((p) => p.id === item.responsiblePartyId);

  const cells: Partial<Record<TableColumnKey, LivePreviewCell>> = {
    occurredOn: { content: dayRuleLabel(item.dayRule, item.day) },
    description: {
      content: (
        <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
          <Box
            component="span"
            sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {item.description ?? "—"}
          </Box>
          {/* Parcela como pílula contornada, o mesmo vocabulário da linha real. */}
          {item.cardInstallment && (
            <Chip size="small" sx={pillOutlineSx} label={item.cardInstallment} />
          )}
          {/* "criada em branco" fica AQUI e não na célula de valor: em 88px o texto
              não cabe, e trocar "R$ 0,00" por uma frase esconderia o número que o
              total do rodapé está somando. */}
          {isBlank && <Chip size="small" sx={pillOutlineSx} label={t.blankAmountHint} />}
        </Box>
      ),
    },
    amount: {
      content: formatCentsToBrl(amountCents),
      tone: isBlank ? "neutral" : amountCents < 0n ? "negative" : "positive",
    },
  };

  if (category) cells.category = { content: category.name };
  if (institution) cells.institution = { content: institution.name };
  if (party) {
    cells.responsibleUser = {
      content: (
        <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
          <PartyAvatar
            kind={party.kind}
            icon={party.icon}
            color={party.color}
            imageUrl={party.imageUrl}
            name={party.name}
            size={16}
          />
          <Box
            component="span"
            sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {party.name}
          </Box>
        </Box>
      ),
    };
  }

  return (
    // A alça fica FORA do `LivePreviewRow` — ele desenha a linha do tipo, e uma
    // coluna de arraste não faz parte da linha real do mês. A borda inferior sobe
    // para este invólucro (`last` no preview) para a divisória atravessar também a
    // faixa da alça, em vez de começar 24px adentro.
    <Box
      ref={setNodeRef}
      style={dragStyle}
      sx={{
        display: "flex",
        alignItems: "center",
        borderBottomWidth: last ? 0 : "1px",
        borderBottomStyle: "solid",
        borderBottomColor: "border.subtle",
      }}
    >
      <Box
        sx={{
          width: SETTINGS_GRIP_WIDTH,
          flexShrink: 0,
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        {handle}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <LivePreviewRow
          sample={{ id: item.id, cells }}
          rowLayout={rowLayout}
          density={density}
          columns={columns}
          last
          trailing={
            <RowActionsMenu
              name={item.description ?? dayRuleLabel(item.dayRule, item.day)}
              actions={{ edit: onEdit, delete: onDelete }}
            />
          }
        />
      </Box>
    </Box>
  );
}
