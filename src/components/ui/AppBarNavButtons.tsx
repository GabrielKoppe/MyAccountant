"use client";

// Client Component obrigatório: usa Tooltip + IconButton com component={AppLink}.
// Quando esses componentes estão num Server Component, o prop `component` (uma
// função Client Component) não é serializado corretamente na fronteira RSC→Client,
// causando hydration mismatch (<a> no server, <span> no client).

import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import BarChartIcon from "@mui/icons-material/BarChart";
import GroupIcon from "@mui/icons-material/Group";
import SavingsIcon from "@mui/icons-material/Savings";
import SettingsIcon from "@mui/icons-material/Settings";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";

import { AppLink } from "@/components/ui/AppLink";
import { m } from "@/lib/messages";

type Props = {
  accountId: string;
};

export function AppBarNavButtons({ accountId }: Props) {
  return (
    <>
      <Tooltip title="Dashboards">
        <IconButton
          component={AppLink}
          href={`/${accountId}/dashboards`}
          color="inherit"
          aria-label="Dashboards"
        >
          <BarChartIcon />
        </IconButton>
      </Tooltip>

      <Tooltip title="Membros">
        <IconButton
          component={AppLink}
          href={`/${accountId}/settings/members`}
          color="inherit"
          aria-label="Membros"
        >
          <GroupIcon />
        </IconButton>
      </Tooltip>

      <Tooltip title={m.goals.navLabel}>
        <IconButton
          component={AppLink}
          href={`/${accountId}/planning`}
          color="inherit"
          aria-label={m.goals.navLabel}
        >
          <SavingsIcon />
        </IconButton>
      </Tooltip>

      <Tooltip title="Patrimônio">
        <IconButton
          component={AppLink}
          href={`/${accountId}/net-worth`}
          color="inherit"
          aria-label="Patrimônio"
        >
          <AccountBalanceWalletIcon />
        </IconButton>
      </Tooltip>

      <Tooltip title={m.cashflowForecast.navLabel}>
        <IconButton
          component={AppLink}
          href={`/${accountId}/forecast`}
          color="inherit"
          aria-label={m.cashflowForecast.navLabel}
        >
          <TrendingUpIcon />
        </IconButton>
      </Tooltip>

      <Tooltip title="Configurações da conta">
        <IconButton
          component={AppLink}
          href={`/${accountId}/settings/general`}
          color="inherit"
          aria-label="Configurações"
        >
          <SettingsIcon />
        </IconButton>
      </Tooltip>
    </>
  );
}
