import { test as setup } from "@playwright/test";
import { manifest } from "./fixtures/manifest";
import { loginAs } from "./fixtures/login";

// invitee NÃO entra aqui: seu login é feito inline em invite-accept.spec.ts (o único
// cenário que precisa dele), evitando que uma flakiness no login do convidado — que não
// tem conta de origem "quente" — bloqueie os demais cenários via dependência do setup.
const ROLES = ["owner", "editor", "viewer"] as const;

for (const role of ROLES) {
  setup(`authenticate as ${role}`, async ({ page }) => {
    await loginAs(page, page.context(), manifest().users[role]);
    await page.context().storageState({ path: `e2e/.auth/${role}.json` });
  });
}
