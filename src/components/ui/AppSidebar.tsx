"use client";

// Spec 65 §7/§10.3 (P1/P4) — AppSidebar: sidebar vertical persistente que
// substitui a AppBar horizontal (NAV-01, NAV-02, NAV-04, NAV-05).
//
// P4 (Drawer mobile + rail + a11y/motion — NAV-05) extraiu o conteúdo em
// `SidebarContent`, compartilhado entre a coluna permanente (`md+`) e o
// `Drawer` temporário (abaixo de `md`), no mesmo padrão de `NavItems` já
// usado em `SettingsNav.tsx`.
//
// A ação global da sidebar cria um MÊS (não uma transação — a transação é
// criada DENTRO de um mês). Reusa o `CreateMonthModal` via `renderTrigger`;
// cada instância de `SidebarContent` (Drawer + coluna) tem seu próprio modal
// com estado independente, então não há sobreposição.

import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import AddIcon from "@mui/icons-material/Add";
import BarChartIcon from "@mui/icons-material/BarChart";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import GroupIcon from "@mui/icons-material/Group";
import MenuIcon from "@mui/icons-material/Menu";
import SavingsIcon from "@mui/icons-material/Savings";
import SettingsIcon from "@mui/icons-material/Settings";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { AccountMemberRole } from "@prisma/client";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { saveSidebarCollapsedAction } from "@/actions/user-settings";
import { AccountSwitcher } from "@/components/accounts/AccountSwitcher";
import { CreateMonthModal } from "@/components/months/CreateMonthModal";
import { AppLink } from "@/components/ui/AppLink";
import { activeNavItemSx, isNavItemActive } from "@/components/ui/nav-active";
import { UserMenuButton } from "@/components/ui/UserMenuButton";
import { APP_HEADER_HEIGHT, layout, motion } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import { SIDEBAR_COLLAPSED_COOKIE } from "@/lib/sidebar-preference";

/** Largura expandida da sidebar (ícone + rótulo; folga para o nome da conta e submenus). */
export const SIDEBAR_WIDTH = 240;
/** Largura do rail recolhido — só ícone + Tooltip. */
export const SIDEBAR_COLLAPSED_WIDTH = 64;

/** Tipografia dos rótulos de item de navegação (frame `.navlbl`: 500 / ~0.82rem). */
const NAV_LABEL_TYPOGRAPHY = { fontSize: "0.82rem", fontWeight: 500 } as const;

type Account = { id: string; name: string };
type MonthItem = { id: string; label: string };

type Props = {
  accountId: string;
  role: AccountMemberRole;
  initialCollapsed?: boolean;
  currentAccountName: string;
  otherAccounts: Account[];
  recentMonths: MonthItem[];
  /** Mês mais recente ({year, month}) para sugerir o próximo em "Novo Mês". */
  lastMonth: { year: number; month: number } | null;
  userName: string | null | undefined;
  userImage: string | null | undefined;
  initialUnreadCount?: number;
};

type NavSubItem = { id: string; href: string; label: string };

type NavItem = {
  key: string;
  href: string;
  label: string;
  icon: ReactNode;
  isActive: (pathname: string) => boolean;
  /** Sub-itens recolhíveis (ex.: meses recentes sob "Meses"). Só no modo expandido. */
  subItems?: NavSubItem[];
};

export function AppSidebar({
  accountId,
  role,
  initialCollapsed = false,
  currentAccountName,
  otherAccounts,
  recentMonths,
  lastMonth,
  userName,
  userImage,
  initialUnreadCount,
}: Props) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  // Spec 65 §10.3 (P4) — Drawer mobile (NAV-05): abaixo de `md` a sidebar
  // vira `Drawer` temporário acionado por este ícone hambúrguer.
  const [mobileOpen, setMobileOpen] = useState(false);

  // Spec 65 §7.4/§10.3 (P3) — persistência do estado recolhido (NAV-05).
  // Espelha `ThemeProviderClient.setMode`/`setAccentColor`: estado otimista
  // primeiro (feedback instantâneo), depois `document.cookie` na hora
  // (paridade com o valor que o server vai ler no próximo request — evita
  // flash mesmo antes da Action resolver) e por fim a Action
  // fire-and-forget (persiste o cookie httpOnly:false com os mesmos
  // atributos, sem bloquear a UI). Lê `collapsed` do closure em vez de
  // updater funcional — de propósito: um updater funcional pode ser
  // re-invocado pelo React (StrictMode/concorrência) e duplicaria os efeitos
  // colaterais (cookie/Action), que não são idempotentes-seguros para
  // disparar 2x.
  function handleToggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COLLAPSED_COOKIE}=${next ? "1" : "0"};path=/;max-age=31536000;samesite=strict`;
    saveSidebarCollapsedAction(next).catch(() => {});
  }

  const sharedContentProps = {
    accountId,
    role,
    currentAccountName,
    otherAccounts,
    recentMonths,
    userName,
    userImage,
    initialUnreadCount,
    pathname,
    lastMonth,
  };

  return (
    <>
      {/* Hambúrguer — visível só abaixo de `md` (NAV-05); a coluna permanente
          assume a partir daí. */}
      <Box
        sx={{
          display: { xs: "flex", md: "none" },
          alignItems: "center",
          gap: layout.inline,
          px: layout.inline,
          py: layout.micro,
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <IconButton
          onClick={() => setMobileOpen(true)}
          aria-label={m.nav.openMenu}
          aria-expanded={mobileOpen}
          size="small"
        >
          <MenuIcon fontSize="small" />
        </IconButton>
        <Typography variant="body2" color="text.secondary" noWrap>
          {currentAccountName}
        </Typography>
      </Box>

      {/* Drawer mobile — temporário, some a partir de `md` (NAV-05). Sempre
          expandido (sem rail): o conceito de "recolhido" só existe na coluna
          permanente. `keepMounted` preserva a árvore para a transição de
          abertura/fechamento (padrão já usado no `SettingsNav`). */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": { width: SIDEBAR_WIDTH, boxSizing: "border-box" },
        }}
      >
        <SidebarContent
          {...sharedContentProps}
          collapsed={false}
          onNavigate={() => setMobileOpen(false)}
        />
      </Drawer>

      {/* Coluna permanente — visível a partir de `md` (NAV-05). */}
      <Box
        component="nav"
        aria-label={m.nav.ariaLabel}
        sx={{
          display: { xs: "none", md: "flex" },
          flexDirection: "column",
          width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
          flexShrink: 0,
          // Preenche a altura do shell (100dvh) e não rola com o conteúdo —
          // o scroll vive só no `<main>` (e no miolo da própria sidebar).
          height: "100%",
          borderRight: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
          overflowX: "hidden",
          // NAV-05 exige animar a LARGURA ao recolher/expandir — exceção
          // deliberada à regra geral do design system (evitar animar
          // width/layout): aqui é critério de aceite explícito (§4 NAV-05).
          // Guard de `prefers-reduced-motion`: sem transição para quem
          // pediu menos movimento.
          transition: `width ${motion.duration.normal}ms ${motion.easing.standard}`,
          "@media (prefers-reduced-motion: reduce)": {
            transition: "none",
          },
        }}
      >
        <SidebarContent
          {...sharedContentProps}
          collapsed={collapsed}
          onToggleCollapse={handleToggleCollapse}
        />
      </Box>
    </>
  );
}

type SidebarContentProps = {
  accountId: string;
  role: AccountMemberRole;
  currentAccountName: string;
  otherAccounts: Account[];
  recentMonths: MonthItem[];
  userName: string | null | undefined;
  userImage: string | null | undefined;
  initialUnreadCount?: number;
  pathname: string;
  lastMonth: { year: number; month: number } | null;
  collapsed: boolean;
  /** Fecha o Drawer mobile ao navegar. `undefined` na coluna permanente (nada a fechar). */
  onNavigate?: () => void;
  /** Alterna recolhido/expandido. `undefined` no Drawer mobile (o rail só existe na coluna permanente). */
  onToggleCollapse?: () => void;
};

/**
 * Conteúdo da sidebar — extraído para reuso entre o `Drawer` mobile e a
 * coluna permanente (Spec 65 §10.3 P4, padrão `NavItems` do `SettingsNav`).
 */
function SidebarContent({
  accountId,
  role,
  currentAccountName,
  otherAccounts,
  recentMonths,
  userName,
  userImage,
  initialUnreadCount,
  pathname,
  lastMonth,
  collapsed,
  onNavigate,
  onToggleCollapse,
}: SidebarContentProps) {
  const canCreateMonth = role === "owner" || role === "editor";
  const canManageSettings = role === "owner" || role === "editor";

  const monthsHref = `/${accountId}`;
  const settingsBase = `/${accountId}/settings`;
  const membersHref = `${settingsBase}/members`;

  const principalItems: NavItem[] = [
    {
      key: "months",
      href: monthsHref,
      label: m.nav.months,
      icon: <CalendarMonthIcon fontSize="small" />,
      // Meses = base exata da account OU qualquer rota sob /months (§10.3 P1).
      isActive: (p) =>
        isNavItemActive(p, monthsHref, { exact: true }) ||
        isNavItemActive(p, `${monthsHref}/months`),
      // Submenu recolhível com os meses recentes (substitui o antigo MonthsDropdown).
      subItems: recentMonths.map((month) => ({
        id: month.id,
        href: `/${accountId}/months/${month.id}`,
        label: month.label,
      })),
    },
    {
      key: "dashboards",
      href: `/${accountId}/dashboards`,
      label: m.nav.dashboards,
      icon: <BarChartIcon fontSize="small" />,
      isActive: (p) => isNavItemActive(p, `/${accountId}/dashboards`),
    },
    {
      key: "net-worth",
      href: `/${accountId}/net-worth`,
      label: m.netWorth.navLabel,
      icon: <AccountBalanceWalletIcon fontSize="small" />,
      isActive: (p) => isNavItemActive(p, `/${accountId}/net-worth`),
    },
    {
      key: "planning",
      href: `/${accountId}/planning`,
      label: m.goals.navLabel,
      icon: <SavingsIcon fontSize="small" />,
      isActive: (p) => isNavItemActive(p, `/${accountId}/planning`),
    },
    {
      key: "forecast",
      href: `/${accountId}/forecast`,
      label: m.cashflowForecast.navLabel,
      icon: <TrendingUpIcon fontSize="small" />,
      isActive: (p) => isNavItemActive(p, `/${accountId}/forecast`),
    },
  ];

  const managementItems: NavItem[] = [
    {
      key: "members",
      href: membersHref,
      // Membros: visível a TODOS os papéis (gestão fica owner-only dentro da página — §7.1).
      label: m.settings.nav.members,
      icon: <GroupIcon fontSize="small" />,
      isActive: (p) => isNavItemActive(p, membersHref),
    },
    ...(canManageSettings
      ? [
          {
            key: "settings",
            href: `${settingsBase}/general`,
            label: m.nav.settings,
            icon: <SettingsIcon fontSize="small" />,
            // Configurações = prefixo /settings E NÃO /settings/members (§10.3 P1).
            isActive: (p: string) =>
              isNavItemActive(p, settingsBase) && !isNavItemActive(p, membersHref),
          } satisfies NavItem,
        ]
      : []),
  ];

  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", overflow: "hidden" }}
    >
      {/* Topo — troca de conta (NAV-02). Altura fixa = `APP_HEADER_HEIGHT` para o
          `borderBottom` alinhar com o cabeçalho de página (ex.: MonthHeader). */}
      <Box
        sx={{
          px: layout.inline,
          height: APP_HEADER_HEIGHT,
          flexShrink: 0,
          borderBottom: 1,
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
        }}
      >
        <AccountSwitcher
          currentAccountId={accountId}
          currentAccountName={currentAccountName}
          otherAccounts={otherAccounts}
          collapsed={collapsed}
        />
      </Box>

      {/* Miolo rolável: só esta região rola (o cabeçalho da conta e o rodapé
          ficam fixos). Evita o scroll da sidebar inteira em telas baixas. */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {/* Novo Mês — ação global da account (a transação é criada DENTRO do mês).
            Reusa o CreateMonthModal via renderTrigger; cada instância de
            SidebarContent tem seu próprio modal (estado independente). */}
        {canCreateMonth && (
          <Box sx={{ p: layout.inline, display: "flex", justifyContent: "center" }}>
            <CreateMonthModal
              accountId={accountId}
              lastMonth={lastMonth}
              renderTrigger={(open) =>
                collapsed ? (
                  <Tooltip title={m.months.newMonth} placement="right">
                    <IconButton
                      aria-label={m.months.newMonth}
                      aria-haspopup="dialog"
                      onClick={() => {
                        open();
                        onNavigate?.();
                      }}
                      sx={{
                        bgcolor: "accent.primary",
                        color: "primary.contrastText",
                        "&:hover": { bgcolor: "accent.primaryHover" },
                      }}
                    >
                      <AddIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                ) : (
                  <Button
                    fullWidth
                    variant="contained"
                    color="primary"
                    startIcon={<AddIcon />}
                    aria-haspopup="dialog"
                    onClick={() => {
                      open();
                      onNavigate?.();
                    }}
                  >
                    {m.months.newMonth}
                  </Button>
                )
              }
            />
          </Box>
        )}

      {/* Grupo Principal (NAV-04) — "Meses" traz os meses recentes como submenu recolhível */}
      <NavGroup
        label={m.nav.groupPrincipal}
        items={principalItems}
        collapsed={collapsed}
        pathname={pathname}
        onNavigate={onNavigate}
      />

      {/* Grupo Gestão (NAV-04) */}
      <NavGroup
        label={m.nav.groupManagement}
        items={managementItems}
        collapsed={collapsed}
        pathname={pathname}
        onNavigate={onNavigate}
      />

      </Box>

      <Divider sx={{ flexShrink: 0 }} />

      {/* Rodapé — UserMenuButton mesclado (badge/lista de notificações, P5) + toggle recolher.
          `UserMenuButton` nunca mostra o nome fora do menu (só avatar + badge)
          — o rodapé recolhido já preserva isso sem mudança adicional (NAV-05 §4). */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          gap: layout.inline,
          p: layout.inline,
          flexShrink: 0,
        }}
      >
        <UserMenuButton
          userName={userName}
          userImage={userImage}
          accountId={accountId}
          initialUnreadCount={initialUnreadCount}
          menuPlacement="top"
        />
        {/* Toggle recolher/expandir: só existe na coluna permanente
            (`onToggleCollapse` vem `undefined` no Drawer mobile — não há
            rail no mobile). `aria-expanded` reflete o estado da sidebar
            (expandida = true), não o próprio botão (NAV-05 §4). */}
        {onToggleCollapse && !collapsed && (
          <IconButton
            onClick={onToggleCollapse}
            aria-label={m.nav.collapse}
            aria-expanded={true}
            size="small"
          >
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
      {onToggleCollapse && collapsed && (
        <Box sx={{ display: "flex", justifyContent: "center", pb: layout.inline, flexShrink: 0 }}>
          <IconButton
            onClick={onToggleCollapse}
            aria-label={m.nav.expand}
            aria-expanded={false}
            size="small"
          >
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </Box>
      )}
    </Box>
  );
}

type NavGroupProps = {
  label: string;
  items: NavItem[];
  collapsed: boolean;
  pathname: string;
  onNavigate?: () => void;
};

/**
 * Grupo de itens de navegação com cabeçalho (frame `.grp`: pequeno, uppercase,
 * bem espaçado no letter-spacing e bem discreto na cor — `text.disabled`).
 * No rail recolhido o cabeçalho vira um `Divider` (§10.3 P1). Mantém-se em Inter
 * (o design system reserva a mono para valores monetários).
 */
function NavGroup({ label, items, collapsed, pathname, onNavigate }: NavGroupProps) {
  if (items.length === 0) return null;

  return (
    <Box sx={{ pb: layout.micro }}>
      {collapsed ? (
        <Divider sx={{ my: layout.inline }} />
      ) : (
        <Typography
          variant="overline"
          sx={{
            display: "block",
            px: layout.inline,
            mt: layout.inline,
            mb: layout.micro,
            color: "text.disabled",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            lineHeight: 1.6,
          }}
        >
          {label}
        </Typography>
      )}
      <List dense disablePadding>
        {items.map((item) => {
          if (!collapsed && item.subItems && item.subItems.length > 0) {
            return (
              <NavItemWithSubmenu
                key={item.key}
                item={item}
                pathname={pathname}
                onNavigate={onNavigate}
              />
            );
          }

          const isActive = item.isActive(pathname);
          const button = (
            <ListItemButton
              key={item.key}
              component={AppLink}
              href={item.href}
              selected={isActive}
              aria-label={item.label}
              onClick={onNavigate}
              sx={{
                ...activeNavItemSx,
                justifyContent: collapsed ? "center" : "flex-start",
              }}
            >
              <ListItemIcon sx={{ minWidth: collapsed ? 0 : 36, justifyContent: "center" }}>
                {item.icon}
              </ListItemIcon>
              {!collapsed && (
                <ListItemText primary={item.label} primaryTypographyProps={NAV_LABEL_TYPOGRAPHY} />
              )}
            </ListItemButton>
          );

          return collapsed ? (
            <Tooltip key={item.key} title={item.label} placement="right">
              {button}
            </Tooltip>
          ) : (
            button
          );
        })}
      </List>
    </Box>
  );
}

type NavItemWithSubmenuProps = {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
};

/**
 * Item de navegação com submenu recolhível (ex.: "Meses" → meses recentes).
 * O rótulo é um link (vai para o destino principal); o chevron ao lado — via
 * `secondaryAction` do `ListItem`, fora do `<a>` do link (HTML válido) — só
 * expande/recolhe a lista. Abre por padrão quando o item está ativo.
 */
function NavItemWithSubmenu({ item, pathname, onNavigate }: NavItemWithSubmenuProps) {
  const isActive = item.isActive(pathname);
  const [open, setOpen] = useState(isActive);
  const subItems = item.subItems ?? [];

  return (
    <>
      <ListItem
        disablePadding
        secondaryAction={
          <IconButton
            edge="end"
            size="small"
            aria-label={m.nav.recentMonths}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? (
              <ExpandLessIcon fontSize="small" />
            ) : (
              <ExpandMoreIcon fontSize="small" />
            )}
          </IconButton>
        }
      >
        <ListItemButton
          component={AppLink}
          href={item.href}
          selected={isActive}
          aria-label={item.label}
          onClick={onNavigate}
          sx={activeNavItemSx}
        >
          <ListItemIcon sx={{ minWidth: 36, justifyContent: "center" }}>{item.icon}</ListItemIcon>
          <ListItemText primary={item.label} primaryTypographyProps={NAV_LABEL_TYPOGRAPHY} />
        </ListItemButton>
      </ListItem>

      <Collapse in={open} timeout="auto" unmountOnExit>
        <List dense disablePadding>
          {subItems.map((sub) => {
            const subActive = pathname === sub.href || pathname.startsWith(`${sub.href}/`);
            return (
              <ListItemButton
                key={sub.id}
                component={AppLink}
                href={sub.href}
                selected={subActive}
                onClick={onNavigate}
                sx={{ ...activeNavItemSx, pl: 6.5 }}
              >
                <ListItemText
                  primary={sub.label}
                  primaryTypographyProps={{ fontSize: "0.78rem", fontWeight: 400 }}
                />
              </ListItemButton>
            );
          })}
        </List>
      </Collapse>
    </>
  );
}
