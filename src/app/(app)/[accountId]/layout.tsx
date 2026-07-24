import Box from "@mui/material/Box";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppSidebar } from "@/components/ui/AppSidebar";
import { formatMonthLabel } from "@/lib/dates";
import { parseSidebarCollapsed, SIDEBAR_COLLAPSED_COOKIE } from "@/lib/sidebar-preference";
import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";
import { getUnreadCount } from "@/server/services/notification-service";

type Props = {
  children: ReactNode;
  params: Promise<{ accountId: string }>;
};

export default async function AccountLayout({ children, params }: Props) {
  const { accountId } = await params;

  const { user, member } = await requireAccountAccess(accountId).catch(() => redirect("/home"));

  const collapsed = parseSidebarCollapsed((await cookies()).get(SIDEBAR_COLLAPSED_COOKIE)?.value);

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

  // Mês mais recente (recentMonthsRaw vem ordenado desc) → sugere o próximo em "Novo Mês".
  const lastMonth = recentMonthsRaw[0]
    ? { year: recentMonthsRaw[0].year, month: recentMonthsRaw[0].month }
    : null;

  return (
    <Box
      sx={{
        display: "flex",
        // Spec 65 §10.3 (P4, NAV-05): abaixo de `md` o AppSidebar renderiza
        // como barra de hambúrguer (bloco horizontal) + Drawer temporário —
        // empilha em coluna para não competir por largura com o `<main>`.
        // A partir de `md` o AppSidebar volta a ser a coluna permanente à
        // esquerda (linha).
        flexDirection: { xs: "column", md: "row" },
        // App-shell: altura travada na viewport e SEM scroll no container —
        // a sidebar fica fixa e só o `<main>` rola (Spec 65). `100dvh` respeita
        // a barra de endereço dinâmica no mobile.
        height: "100dvh",
        overflow: "hidden",
        bgcolor: "background.default",
      }}
    >
      <AppSidebar
        accountId={accountId}
        role={member.role}
        initialCollapsed={collapsed}
        currentAccountName={account?.name ?? "MyAccountant"}
        otherAccounts={otherAccounts}
        recentMonths={recentMonths}
        lastMonth={lastMonth}
        userName={userData?.name}
        userImage={userData?.image}
        initialUnreadCount={unreadCount}
      />

      {/* Único container de scroll das páginas. Páginas que querem cabeçalho
          fixo + corpo rolável (ex.: mês) assumem `height:100%` e criam sua
          própria região de scroll interna. */}
      <Box component="main" sx={{ flex: 1, minWidth: 0, minHeight: 0, overflowY: "auto" }}>
        {children}
      </Box>
    </Box>
  );
}
