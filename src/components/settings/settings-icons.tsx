// Spec 67 §6 — resolução das chaves de ícone do catálogo de Configurações.
//
// Por que existe: `settings-catalog.ts` é um módulo PURO (sem JSX) para
// continuar testável sem renderizar nada. O preço disso é que o ícone lá é uma
// CHAVE; este arquivo é o único lugar que traduz chave → elemento MUI, tanto
// para o hub quanto para o nav.
//
// `Record<...>` exaustivo de propósito: acrescentar uma chave em
// `SettingsIconKey` sem registrar o ícone aqui vira erro de tipo, não uma
// linha sem ícone em produção.

import AccountBalanceOutlinedIcon from "@mui/icons-material/AccountBalanceOutlined";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import AlternateEmailOutlinedIcon from "@mui/icons-material/AlternateEmailOutlined";
import BarChartOutlinedIcon from "@mui/icons-material/BarChartOutlined";
import ChecklistOutlinedIcon from "@mui/icons-material/ChecklistOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import EventRepeatOutlinedIcon from "@mui/icons-material/EventRepeatOutlined";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import InputOutlinedIcon from "@mui/icons-material/InputOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import SavingsOutlinedIcon from "@mui/icons-material/SavingsOutlined";
import SellOutlinedIcon from "@mui/icons-material/SellOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import TableRowsOutlinedIcon from "@mui/icons-material/TableRowsOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import ViewAgendaOutlinedIcon from "@mui/icons-material/ViewAgendaOutlined";
import type { ReactNode } from "react";

import type { SettingsFamily, SettingsIconKey } from "@/components/settings/settings-catalog";

/** Ícone de cada página (linha do hub / item do nav). */
export const SETTINGS_ENTRY_ICONS: Record<SettingsIconKey, ReactNode> = {
  sections: <ViewAgendaOutlinedIcon fontSize="small" />,
  categories: <SellOutlinedIcon fontSize="small" />,
  institutions: <AccountBalanceOutlinedIcon fontSize="small" />,
  responsibles: <PersonOutlinedIcon fontSize="small" />,
  tableTypes: <TableRowsOutlinedIcon fontSize="small" />,
  models: <ContentCopyOutlinedIcon fontSize="small" />,
  dashboards: <BarChartOutlinedIcon fontSize="small" />,
  templates: <UploadFileOutlinedIcon fontSize="small" />,
  aliases: <AlternateEmailOutlinedIcon fontSize="small" />,
  connectors: <SmartToyOutlinedIcon fontSize="small" />,
  forecast: <SavingsOutlinedIcon fontSize="small" />,
  checklist: <ChecklistOutlinedIcon fontSize="small" />,
  general: <TuneOutlinedIcon fontSize="small" />,
  members: <GroupOutlinedIcon fontSize="small" />,
  audit: <HistoryOutlinedIcon fontSize="small" />,
};

/** Ícone de cada uma das 5 famílias (cabeçalho do card do hub). */
export const SETTINGS_FAMILY_ICONS: Record<SettingsFamily["icon"], ReactNode> = {
  structure: <AccountTreeOutlinedIcon fontSize="small" />,
  presentation: <TableChartOutlinedIcon fontSize="small" />,
  dataEntry: <InputOutlinedIcon fontSize="small" />,
  planning: <EventRepeatOutlinedIcon fontSize="small" />,
  account: <ShieldOutlinedIcon fontSize="small" />,
};
