import "@testing-library/jest-dom/vitest";
import { afterEach, beforeAll, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

// Habilitar BigInt em JSON nos testes
beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (BigInt.prototype as any).toJSON = function () {
    return this.toString();
  };
});

// Stub env vars para testes
vi.stubEnv("NODE_ENV", "test");
vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost:5432/test");
vi.stubEnv("DIRECT_URL", "postgresql://test:test@localhost:5432/test");
vi.stubEnv("NEXTAUTH_SECRET", "test-secret-min-32-characters-long-ok");
vi.stubEnv("NEXTAUTH_URL", "http://localhost:3000");
vi.stubEnv("GOOGLE_CLIENT_ID", "test-client-id");
vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-client-secret");
vi.stubEnv("RESEND_API_KEY", "test-resend-key");
vi.stubEnv("EMAIL_FROM", "test@example.com");
vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
