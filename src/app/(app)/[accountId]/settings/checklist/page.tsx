import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { generateSettingsMetadata } from "@/lib/generate-settings-metadata";
import { m } from "@/lib/messages";
import { requireAccountAccess } from "@/server/auth/session";
import { listChecklistItems } from "@/server/services/checklist-service";

import { ChecklistManager } from "./ChecklistManager";

type Props = { params: Promise<{ accountId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { accountId } = await params;
  return generateSettingsMetadata(accountId, m.settings.checklist.title);
}

export default async function ChecklistSettingsPage({ params }: Props) {
  const { accountId } = await params;
  const { member } = await requireAccountAccess(accountId).catch(() => redirect("/home"));
  if (member.role === "viewer") redirect(`/${accountId}`);

  const items = await listChecklistItems(accountId);

  return (
    <ChecklistManager
      accountId={accountId}
      initialItems={items}
      title={m.settings.checklist.title}
    />
  );
}
