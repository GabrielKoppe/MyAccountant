"use client";

// Spec 68 §2.6 (EST-08) — M3 · Ver uso: raio de impacto REAL (varre `Transaction`,
// cache de 24h) de qualquer objeto de estrutura. Autocontido de propósito: não é
// ligado a nenhum manager aqui — quem abre controla `open`/`onClose`.
//
// O CORPO deste modal virou `OnDemandUsagePanel` (Spec 69 §14/P2): as abas
// "Onde é usado" de Tipos de tabela e de Modelos precisam da mesma contagem
// dentro da página. O que sobrou aqui é a moldura — título, atalho para as
// transações e o botão de fechar.
//
// `autoCount={open}` preserva a regra original ("só busque quando `open` virar
// `true`"): a contagem é cara, e abrir o modal É o gesto que a pede.

import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import QueryStatsIcon from "@mui/icons-material/QueryStats";
import Button from "@mui/material/Button";

import { OnDemandUsagePanel } from "@/components/settings/OnDemandUsagePanel";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { AppLink } from "@/components/ui/AppLink";
import { m } from "@/lib/messages";
import type { CountableUsageEntity } from "@/lib/schemas/settings-usage";

const t = m.settings.structureDialogs.usage;

export type UsageDialogProps = {
  open: boolean;
  onClose: () => void;
  accountId: string;
  entity: CountableUsageEntity;
  entityId: string;
  entityName: string;
  /** Link para a lista de transações filtrada; ausente = não renderiza o atalho. */
  transactionsHref?: string;
};

/**
 * M3 · Ver uso (Spec 68 §2.6). Três KPIs, histograma mensal, timestamp da
 * contagem e "Recontar" — tudo vindo do `OnDemandUsagePanel` (resultado padrão).
 *
 * `transactionsHref` fica nas AÇÕES do diálogo, e não é repassado ao painel: o
 * painel também sabe renderizar esse atalho, e passá-lo duplicaria o botão.
 */
export function UsageDialog({
  open,
  onClose,
  accountId,
  entity,
  entityId,
  entityName,
  transactionsHref,
}: UsageDialogProps) {
  return (
    <SettingsDialog
      open={open}
      onClose={onClose}
      size="form"
      titleIcon={<QueryStatsIcon />}
      title={t.title(entityName)}
      actions={
        <>
          {transactionsHref && (
            <Button
              size="small"
              component={AppLink}
              href={transactionsHref}
              startIcon={<OpenInNewIcon fontSize="small" />}
            >
              {t.viewTransactions}
            </Button>
          )}
          <Button size="small" variant="contained" onClick={onClose}>
            {t.close}
          </Button>
        </>
      }
    >
      <OnDemandUsagePanel
        accountId={accountId}
        entity={entity}
        entityId={entityId}
        entityName={entityName}
        autoCount={open}
        // Mantém a frase do modal ("Contado em … · cache de 24 h") em vez da
        // frase da aba ("Resultado de …"): este diálogo já foi revisado.
        countedAtLabel={t.countedAt}
      />
    </SettingsDialog>
  );
}
