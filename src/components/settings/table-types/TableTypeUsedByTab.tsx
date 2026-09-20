"use client";

import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import Typography from "@mui/material/Typography";

import { OnDemandUsagePanel } from "@/components/settings/OnDemandUsagePanel";
import { AppLink } from "@/components/ui/AppLink";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";

import { BlockLabel } from "./BlockLabel";

const t = m.settings.presentation.tableTypes.usedBy;
const od = m.settings.presentation.onDemand;

/** Um modelo que usa este tipo — tudo já vem calculado do RSC. */
export type TableTypeModelUsage = {
  id: string;
  name: string;
  /** Nome da seção de destino da automação; `null` = modelo sem automação. */
  sectionName: string | null;
};

export type TableTypeUsedByTabProps = {
  accountId: string;
  tableTypeId: string;
  tableTypeName: string;
  /** Contagem BARATA: vem do RSC por `groupBy`, sem tocar em `Transaction`. */
  models: TableTypeModelUsage[];
  /** Destino do clique na lista de modelos. */
  modelsHref: string;
};

/**
 * Aba 3 · Onde é usado (Spec 69 §2.1 / APR-08, frame 05b).
 *
 * **Dois blocos com custos diferentes, e a diferença é visível.** A lista de
 * modelos é um `groupBy` sobre `TableTemplate` — aparece pronta, sem clique. A
 * contagem de tabelas e transações reais varre `Transaction`, cujo custo cresce
 * com a conta (Spec 67 §2.4): fica atrás do cartão "Contar", com timestamp e
 * cache de 24 h. Por isso `autoCount` NÃO é passado — montar a aba não é pedir a
 * contagem; a aba abre junto com a página.
 */
export function TableTypeUsedByTab({
  accountId,
  tableTypeId,
  tableTypeName,
  models,
  modelsHref,
}: TableTypeUsedByTabProps) {
  return (
    <Box sx={{ py: layout.stack }}>
      <BlockLabel hint={t.modelsHint}>{t.modelsTitle}</BlockLabel>

      {models.length === 0 ? (
        <Typography variant="body2" sx={{ color: "text.tertiary", mb: layout.stack }}>
          {t.modelsEmpty}
        </Typography>
      ) : (
        <List
          disablePadding
          sx={{
            mb: layout.stack,
            borderRadius: "8px",
            border: 1,
            borderColor: "border.subtle",
            overflow: "hidden",
          }}
        >
          {models.map((model, index) => (
            <ListItem key={model.id} disablePadding>
              <ListItemButton
                component={AppLink}
                href={modelsHref}
                sx={{
                  gap: layout.inline,
                  px: 1.5,
                  py: 1,
                  bgcolor: "background.canvas",
                  borderRadius: 0,
                  borderTopWidth: index === 0 ? 0 : "1px",
                  borderTopStyle: "solid",
                  borderTopColor: "border.subtle",
                }}
              >
                <ContentCopyOutlinedIcon fontSize="small" sx={{ color: "text.tertiary" }} />
                <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
                  {model.name}
                </Typography>
                {/* `StatusBadge variant="neutral"` já encapsula a paleta neutra
                    (neutral.subtle + text.secondary) — não reimplementar com
                    `<Chip variant="outlined">` + sx. */}
                <StatusBadge variant="neutral">
                  {model.sectionName ? t.sectionOf(model.sectionName) : t.noSection}
                </StatusBadge>
                <ChevronRightIcon fontSize="small" sx={{ color: "text.tertiary" }} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      )}

      <BlockLabel>{od.realTitle}</BlockLabel>
      <OnDemandUsagePanel
        accountId={accountId}
        entity="tableType"
        entityId={tableTypeId}
        entityName={tableTypeName}
      />
    </Box>
  );
}
