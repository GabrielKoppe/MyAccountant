"use client";

import Box from "@mui/material/Box";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import { usePathname, useRouter } from "next/navigation";

import { m } from "@/lib/messages";

type Props = {
  accountId: string;
};

type TabSegment = "goals" | "budgets";

const SEGMENTS: TabSegment[] = ["goals", "budgets"];

/**
 * Nav do hub "Planejamento" (spec 47 §3.3/§5.1): `<Tabs>` route-driven — cada
 * aba é uma rota real (`/planning/goals`, `/planning/budgets`), diferente de
 * `MonthTabs` (que troca só um query param na mesma rota). Aba ativa calculada
 * via `usePathname` (mesmo padrão de `SettingsNav`); navegação via
 * `router.push` no `onChange` (mesmo padrão de `MonthTabs`).
 */
export function PlanningNav({ accountId }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const activeTab: TabSegment =
    SEGMENTS.find((segment) => pathname.startsWith(`/${accountId}/planning/${segment}`)) ?? "goals";

  function handleChange(_: React.SyntheticEvent, value: TabSegment) {
    router.push(`/${accountId}/planning/${value}`);
  }

  return (
    <Box sx={{ borderBottom: 1, borderColor: "border.subtle" }}>
      <Tabs value={activeTab} onChange={handleChange} aria-label={m.goals.hubTitle}>
        <Tab value="goals" label={m.goals.tabs.goals} />
        <Tab value="budgets" label={m.goals.tabs.budgets} />
      </Tabs>
    </Box>
  );
}
