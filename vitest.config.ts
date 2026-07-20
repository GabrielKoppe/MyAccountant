import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", "e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.stories.{ts,tsx}",
        // Next.js app directory (pages, layouts, route handlers — integration territory)
        "src/app/**",
        // React components — UI layer, not unit-tested
        "src/components/**",
        // Email templates — integration territory
        "src/emails/**",
        // Client hooks — browser APIs, not unit-tested
        "src/hooks/**",
        "src/lib/hooks/**",
        // Config / design system — no logic
        "src/lib/theme.ts",
        "src/lib/design-tokens.ts",
        "src/lib/accent-colors.ts",
        "src/lib/messages/**",
        "src/lib/generate-settings-metadata.ts",
        // Auth, email client, prisma singleton — hard to unit-test
        "src/server/auth/**",
        "src/server/email/**",
        "src/server/prisma.ts",
        // Server actions — thin wrappers over services (services are tested)
        "src/actions/**",
        // Zod schemas — type definitions with no business logic
        "src/lib/schemas/**",
        // Sandbox — ad-hoc queries, not production paths
        "src/lib/queries/sandbox.ts",
        // OpenAPI registry — wiring, not logic
        "src/server/api/openapi-registry.ts",
        "src/server/api/define-action.ts",
        "src/server/api/route-helpers.ts",
      ],
      thresholds: {
        statements: 60,
        branches: 60,
        functions: 60,
        lines: 60,
      },
    },
  },
});
