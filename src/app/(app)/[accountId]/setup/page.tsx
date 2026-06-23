import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

type Props = { params: Promise<{ accountId: string }> };

export async function generateMetadata({ params: _params }: Props): Promise<Metadata> {
  return { title: "Configurar conta — MyAccountant" };
}

export default async function SetupPage({ params }: Props) {
  const { accountId } = await params;

  const { member } = await requireAccountAccess(accountId).catch(() => redirect("/home"));

  if (member.role === "viewer") {
    redirect(`/${accountId}`);
  }

  const lastMonth = await prisma.month.findFirst({
    where: { accountId },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    select: { year: true, month: true },
  });

  return <OnboardingWizard accountId={accountId} lastMonth={lastMonth} />;
}
