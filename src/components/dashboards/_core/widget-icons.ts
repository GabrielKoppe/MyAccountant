import AccessTimeIcon from "@mui/icons-material/AccessTime";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import AutoGraphIcon from "@mui/icons-material/AutoGraph";
import BarChartIcon from "@mui/icons-material/BarChart";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import CategoryIcon from "@mui/icons-material/Category";
import ChecklistIcon from "@mui/icons-material/Checklist";
import Diversity3Icon from "@mui/icons-material/Diversity3";
import DonutLargeIcon from "@mui/icons-material/DonutLarge";
import DynamicFeedIcon from "@mui/icons-material/DynamicFeed";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import FlagIcon from "@mui/icons-material/Flag";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import GridOnIcon from "@mui/icons-material/GridOn";
import GridViewIcon from "@mui/icons-material/GridView";
import MultilineChartIcon from "@mui/icons-material/MultilineChart";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import RadarIcon from "@mui/icons-material/Radar";
import SavingsIcon from "@mui/icons-material/Savings";
import ScheduleIcon from "@mui/icons-material/Schedule";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import { default as StarOutlinedIcon } from "@mui/icons-material/Star";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import TipsAndUpdatesIcon from "@mui/icons-material/TipsAndUpdates";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TuneIcon from "@mui/icons-material/Tune";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import type { SvgIconProps } from "@mui/material/SvgIcon";
import type { ComponentType } from "react";

/**
 * Mapa centralizado: widget ID → componente de ícone MUI.
 * Fonte única para todos os contextos de dashboard (monthly, yearly, month_summary).
 * Usado tanto no editor de grade (DashboardGridCanvas) quanto nos próprios widgets
 * via WidgetContainer.
 */
export const WIDGET_ICONS: Record<string, ComponentType<SvgIconProps>> = {
  // compartilhados entre contextos
  "kpi-income": TrendingUpIcon,
  "kpi-expenses": TrendingDownIcon,
  "kpi-savings-rate": SavingsIcon,
  "kpi-pending": AccessTimeIcon,
  budgets: FlagIcon,
  insights: TipsAndUpdatesIcon,

  // monthly
  "kpi-month-total": AccountBalanceWalletIcon,
  "kpi-top-category": EmojiEventsIcon,
  "daily-heatmap": CalendarMonthIcon,
  "category-treemap": GridViewIcon,
  "money-flow": AccountTreeIcon,
  "section-breakdown": DonutLargeIcon,
  "category-breakdown": BarChartIcon,
  "top-transactions": FormatListNumberedIcon,
  "member-breakdown": Diversity3Icon,
  "member-list": PeopleAltIcon,
  "member-radar": RadarIcon,

  // yearly
  "kpi-year-total": CalendarTodayIcon,
  "kpi-monthly-avg": ShowChartIcon,
  "kpi-best-month": StarIcon,
  "kpi-worst-month": StarBorderIcon,
  "month-card-grid": GridOnIcon,
  "monthly-bar-chart": BarChartIcon,
  "top-categories": CategoryIcon,
  "member-trend": MultilineChartIcon,

  // month_summary
  "kpi-balance": AccountBalanceIcon,
  "section-cards": ViewModuleIcon,
  "activity-lists": DynamicFeedIcon,
  "pending-transactions": PendingActionsIcon,
  "favorite-transactions": StarOutlinedIcon,
  "recent-transactions": ScheduleIcon,
  checklist: ChecklistIcon,

  // instanciáveis (spec 36 §2.3)
  analysis: AutoGraphIcon,
  "kpi-custom": TuneIcon,
  "filtered-transactions": FilterAltIcon,

  // Spec 38 — novos widgets
  "kpi-budget-health": FlagIcon, // saúde das metas → mesmo ícone de budgets
  "kpi-transaction-count": FormatListNumberedIcon,
  "institution-breakdown": AccountBalanceIcon,
  "week-chart": CalendarTodayIcon,
  "member-yearly": Diversity3Icon, // reusa ícone de member-breakdown

  // Spec 46
  "net-worth-evolution": ShowChartIcon, // já importado acima (kpi-monthly-avg)

  // Spec 48
  "cashflow-forecast": TrendingUpIcon, // já importado acima (kpi-income)
};
