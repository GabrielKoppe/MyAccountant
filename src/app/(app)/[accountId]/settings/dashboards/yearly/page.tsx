import type { Metadata } from "next";
import {
  DashboardSettingsPage,
  generateDashboardSettingsMetadata,
} from "../_shared/DashboardSettingsPage";

type Props = { params: Promise<{ accountId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return generateDashboardSettingsMetadata("yearly");
}

export default async function YearlyDashboardSettingsPage({ params }: Props) {
  const { accountId } = await params;
  return <DashboardSettingsPage accountId={accountId} context="yearly" />;
}
