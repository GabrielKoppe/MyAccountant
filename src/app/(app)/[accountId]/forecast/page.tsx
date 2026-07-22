import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { m } from "@/lib/messages";
import { requireAccountAccess } from "@/server/auth/session";
import { getCashflowForecast } from "@/server/queries/cashflow-forecast";

import { ForecastManager } from "./ForecastManager";

type Props = { params: Promise<{ accountId: string }> };

export const metadata: Metadata = { title: `${m.cashflowForecast.title} | MyAccountant` };

export default async function ForecastPage({ params }: Props) {
  const { accountId } = await params;
  await requireAccountAccess(accountId).catch(() => redirect("/home"));

  const forecast = await getCashflowForecast(accountId);

  return <ForecastManager accountId={accountId} forecast={forecast} />;
}
