import type { ComponentType } from "react";
import type { SvgIconProps } from "@mui/material/SvgIcon";

import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import SavingsIcon from "@mui/icons-material/Savings";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import FlagIcon from "@mui/icons-material/Flag";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import GridViewIcon from "@mui/icons-material/GridView";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import DonutLargeIcon from "@mui/icons-material/DonutLarge";
import BarChartIcon from "@mui/icons-material/BarChart";
import PushPinIcon from "@mui/icons-material/PushPin";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import GridOnIcon from "@mui/icons-material/GridOn";
import CategoryIcon from "@mui/icons-material/Category";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import DynamicFeedIcon from "@mui/icons-material/DynamicFeed";
import TipsAndUpdatesIcon from "@mui/icons-material/TipsAndUpdates";

export const WIDGET_ICONS: Record<string, ComponentType<SvgIconProps>> = {
  // shared across contexts
  "kpi-income": TrendingUpIcon,
  "kpi-expenses": TrendingDownIcon,
  "kpi-savings-rate": SavingsIcon,
  "kpi-pending": AccessTimeIcon,
  budgets: FlagIcon,
  "pinned-analyses": PushPinIcon,
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

  // yearly
  "kpi-year-total": CalendarTodayIcon,
  "kpi-monthly-avg": ShowChartIcon,
  "kpi-best-month": StarIcon,
  "kpi-worst-month": StarBorderIcon,
  "month-card-grid": GridOnIcon,
  "monthly-bar-chart": BarChartIcon,
  "top-categories": CategoryIcon,

  // month_summary
  "kpi-balance": AccountBalanceIcon,
  "section-cards": ViewModuleIcon,
  "activity-lists": DynamicFeedIcon,
};
