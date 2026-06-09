import { redirect } from "next/navigation";

type Props = { params: Promise<{ accountId: string }> };

export default async function AccountSettingsRedirect({ params }: Props) {
  const { accountId } = await params;
  redirect(`/${accountId}/settings/general`);
}
