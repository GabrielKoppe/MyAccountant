import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";
import unusedImports from "eslint-plugin-unused-imports";

// Flat config (ESLint 9 + Next 16). Substitui o `.eslintrc.json` legado — `next lint` foi
// removido no Next 16. Usa os flat configs nativos do eslint-config-next@16 e porta as
// regras customizadas do eslintrc anterior. `import` e os plugins react/a11y já vêm dos
// configs do Next; aqui só adicionamos `unused-imports` e ajustes de regra.
const config = [
  { ignores: [".next/**", "node_modules/**", "coverage/**", "next-env.d.ts"] },
  ...nextCoreWebVitals,
  ...nextTypescript,
  prettier,
  {
    plugins: { "unused-imports": unusedImports },
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
      "import/order": [
        "warn",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
          pathGroups: [{ pattern: "@/**", group: "internal", position: "before" }],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "@typescript-eslint/consistent-type-imports": "warn",
      // Débito pré-existente à migração Next 16/ESLint 9: mantido como `warn` (visível, não
      // silenciado) para não quebrar o build com ~370 `any` e 6 entidades já no código, que
      // nunca foram error de fato (o `next lint` estava quebrado). Limpeza = tarefa separada.
      "@typescript-eslint/no-explicit-any": "warn",
      "react/no-unescaped-entities": "warn",
      // Regras novas do react-hooks@7 (React Compiler) que o eslint-config-next@16 trouxe
      // como error — inexistentes na config antiga. Débito pré-existente → `warn` (visível).
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/static-components": "warn",
    },
  },
];

export default config;
