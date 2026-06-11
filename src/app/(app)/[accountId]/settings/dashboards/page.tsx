import { redirect } from "next/navigation";

type Props = { params: Promise<{ accountId: string }> };

export default async function DashboardsSettingsIndexPage({ params }: Props) {
  const { accountId } = await params;
  redirect(`/${accountId}/settings/dashboards/monthly`);
}
