"use client";
// Wrappers dinâmicos (dynamic import + ssr:false) para todos os componentes
// que importam recharts ou @nivo diretamente.
// Usar SEMPRE estes re-exports em vez de importar os componentes diretamente
// em páginas/dashboards. Isso mantém recharts/nivo fora do bundle inicial.

import dynamic from "next/dynamic";

import { KpiCardSkeleton } from "../kpi/KpiCardSkeleton";

import { ChartSkeleton } from "./ChartSkeleton";

// ─── recharts charts ──────────────────────────────────────────────

export const YearlyLineChart = dynamic(
  () => import("./YearlyLineChart").then((m) => ({ default: m.YearlyLineChart })),
  { ssr: false, loading: () => <ChartSkeleton height={300} /> },
);

export const MonthlyBarChart = dynamic(
  () => import("./MonthlyBarChart").then((m) => ({ default: m.MonthlyBarChart })),
  { ssr: false, loading: () => <ChartSkeleton height={280} /> },
);

export const MonthSectionBarChart = dynamic(
  () => import("./MonthSectionBarChart").then((m) => ({ default: m.MonthSectionBarChart })),
  { ssr: false, loading: () => <ChartSkeleton height={260} /> },
);

export const SectionPieChart = dynamic(
  () => import("./SectionPieChart").then((m) => ({ default: m.SectionPieChart })),
  { ssr: false, loading: () => <ChartSkeleton height={260} /> },
);

export const PieBreakdown = dynamic(
  () => import("./PieBreakdown").then((m) => ({ default: m.PieBreakdown })),
  { ssr: false, loading: () => <ChartSkeleton height={240} /> },
);

export const CategoryTreemap = dynamic(
  () => import("./CategoryTreemap").then((m) => ({ default: m.CategoryTreemap })),
  { ssr: false, loading: () => <ChartSkeleton height={260} /> },
);

export const BreakdownBarChart = dynamic(
  () => import("./BreakdownBarChart").then((m) => ({ default: m.BreakdownBarChart })),
  { ssr: false, loading: () => <ChartSkeleton height={240} /> },
);

export const MemberTrendChart = dynamic(
  () => import("./MemberTrendChart").then((m) => ({ default: m.MemberTrendChart })),
  { ssr: false, loading: () => <ChartSkeleton height={240} /> },
);

// Spec 48 — Previsão de Fluxo de Caixa
export const LazyCashflowForecastChart = dynamic(
  () => import("./CashflowForecastChart").then((mod) => mod.CashflowForecastChart),
  { ssr: false, loading: () => <ChartSkeleton height={300} /> },
);

// ─── recharts panels ─────────────────────────────────────────────

export const MemberBreakdownChart = dynamic(
  () => import("../panels/MemberBreakdownChart").then((m) => ({ default: m.MemberBreakdownChart })),
  { ssr: false, loading: () => <ChartSkeleton height={240} /> },
);

export const WeeklySpendingWidget = dynamic(
  () => import("../panels/WeeklySpendingWidget").then((m) => ({ default: m.WeeklySpendingWidget })),
  { ssr: false, loading: () => <ChartSkeleton height={220} /> },
);

export const MemberRadarWidget = dynamic(
  () => import("../panels/MemberRadarWidget").then((m) => ({ default: m.MemberRadarWidget })),
  { ssr: false, loading: () => <ChartSkeleton height={280} /> },
);

// ─── KPI com sparkline (recharts) ────────────────────────────────

export const KpiCard = dynamic(
  () => import("../kpi/KpiCard").then((m) => ({ default: m.KpiCard })),
  { ssr: false, loading: () => <KpiCardSkeleton /> },
);

// ─── @nivo/sankey ────────────────────────────────────────────────

export const SankeyChart = dynamic(
  () => import("./SankeyChart").then((m) => ({ default: m.SankeyChart })),
  { ssr: false, loading: () => <ChartSkeleton height={400} /> },
);
