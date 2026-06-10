import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import SettingsIcon from "@mui/icons-material/Settings";
import GroupIcon from "@mui/icons-material/Group";
import BarChartIcon from "@mui/icons-material/BarChart";
import { AppLink } from "@/components/ui/AppLink";

import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";
import { formatMonthLabel } from "@/lib/dates";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { UserMenuButton } from "@/components/ui/UserMenuButton";
import { MonthsDropdown } from "@/components/months/MonthsDropdown";
import { AccountSwitcher } from "@/components/accounts/AccountSwitcher";
import { getUnreadCount } from "@/server/services/notification-service";

type Props = {
  children: ReactNode;
  params: Promise<{ accountId: string }>;
};

export default async function AccountLayout({ children, params }: Props) {
  const { accountId } = await params;

  const { user } = await requireAccountAccess(accountId).catch(() => redirect("/home"));

  const [account, userData, recentMonthsRaw, unreadCount, allMemberships] = await Promise.all([
    prisma.account.findUnique({
      where: { id: accountId },
      select: { name: true },
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true, image: true },
    }),
    prisma.month.findMany({
      where: { accountId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: 6,
      select: { id: true, year: true, month: true },
    }),
    getUnreadCount(user.id, accountId),
    prisma.accountMember.findMany({
      where: { userId: user.id },
      include: { account: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const otherAccounts = allMemberships
    .filter((m) => m.accountId !== accountId)
    .map((m) => ({ id: m.account.id, name: m.account.name }));

  const recentMonths = recentMonthsRaw.map((m) => ({
    id: m.id,
    label: formatMonthLabel(m.year, m.month),
  }));

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="static" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Toolbar variant="dense">
          <AccountSwitcher
            currentAccountId={accountId}
            currentAccountName={account?.name ?? "MyAccountant"}
            otherAccounts={otherAccounts}
          />

          {/* Meses — primeiro item de navegação */}
          <MonthsDropdown accountId={accountId} months={recentMonths} />

          <Tooltip title="Dashboards">
            <IconButton component={AppLink} href={`/${accountId}/dashboards`} color="inherit" aria-label="Dashboards">
              <BarChartIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Membros">
            <IconButton component={AppLink} href={`/${accountId}/settings/members`} color="inherit" aria-label="Membros">
              <GroupIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Configurações da conta">
            <IconButton component={AppLink} href={`/${accountId}/settings/general`} color="inherit" aria-label="Configurações">
              <SettingsIcon />
            </IconButton>
          </Tooltip>

          <NotificationBell accountId={accountId} initialUnreadCount={unreadCount} />

          <UserMenuButton userName={userData?.name} userImage={userData?.image} />
        </Toolbar>
      </AppBar>

      {children}
    </Box>
  );
}
