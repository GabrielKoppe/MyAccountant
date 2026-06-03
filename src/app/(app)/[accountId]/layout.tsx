import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import SettingsIcon from "@mui/icons-material/Settings";
import GroupIcon from "@mui/icons-material/Group";
import BarChartIcon from "@mui/icons-material/BarChart";

import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";
import { AppLink } from "@/components/ui/AppLink";
import { UserMenuButton } from "@/components/ui/UserMenuButton";

type Props = {
  children: ReactNode;
  params: Promise<{ accountId: string }>;
};

export default async function AccountLayout({ children, params }: Props) {
  const { accountId } = await params;

  const { user } = await requireAccountAccess(accountId).catch(() => redirect("/home"));

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { name: true },
  });

  const userData = await prisma.user.findUnique({
    where: { id: user.id },
    select: { name: true, image: true },
  });

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="static" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Toolbar variant="dense">
          <Typography
            variant="h4"
            fontWeight="bold"
            component={AppLink}
            href={`/${accountId}`}
            sx={{ flexGrow: 1, textDecoration: "none", color: "inherit" }}
          >
            {account?.name ?? "MyAccountant"}
          </Typography>

          <Tooltip title="Dashboards">
            <IconButton component={AppLink} href={`/${accountId}/dashboards`} color="inherit">
              <BarChartIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Membros">
            <IconButton component={AppLink} href={`/${accountId}/settings/members`} color="inherit">
              <GroupIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Configurações da conta">
            <IconButton component={AppLink} href={`/${accountId}/settings/account`} color="inherit">
              <SettingsIcon />
            </IconButton>
          </Tooltip>

          <UserMenuButton userName={userData?.name} userImage={userData?.image} />
        </Toolbar>
      </AppBar>

      {children}
    </Box>
  );
}
