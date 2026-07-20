// e2e/fixtures/manifest.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const E2E_PASSWORD = "E2ePass123";

export type SeedManifest = {
  users: Record<"owner" | "editor" | "viewer" | "invitee", string>;
  mainAccountId: string;
  inviteAccountId: string;
  roMonthId: string;
  roSectionId: string;
};

export function manifest(): SeedManifest {
  const path = join(process.cwd(), "e2e/.auth/seed-manifest.json");
  return JSON.parse(readFileSync(path, "utf8")) as SeedManifest;
}
