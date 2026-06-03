import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { auth } from "@/server/auth";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return <>{children}</>;
}
