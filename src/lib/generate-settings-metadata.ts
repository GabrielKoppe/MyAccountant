import type { Metadata } from "next";
import { prisma } from "@/server/prisma";

export async function generateSettingsMetadata(
  accountId: string,
  section: string,
): Promise<Metadata> {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { name: true },
  });
  const accountName = account?.name ?? "MyAccountant";
  return { title: `Configurações — ${section} | ${accountName} | MyAccountant` };
}
