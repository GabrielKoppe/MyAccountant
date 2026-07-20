import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { E2E: true, EMAIL_FROM: "MyAccountant <e2e@localhost>", BREVO_API_KEY: "placeholder" },
}));

import { sendEmail } from "./client";

describe("sendEmail (modo E2E)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("não faz chamada de rede quando env.E2E é true", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await sendEmail({ to: ["a@b.com"], subject: "x", html: "<p>x</p>", text: "x" });
    expect(result.messageId).toBe("e2e-noop");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
