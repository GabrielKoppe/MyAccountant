# Spec 15 — Estrutura do Projeto

> Skills: [`server-actions`](../skills/server-actions/SKILL.md) · [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`design-system`](../skills/design-system/SKILL.md) · [`logging`](../skills/logging/SKILL.md) · [`env-validation`](../skills/env-validation/SKILL.md)

## 1. Propósito

Define **onde cada coisa mora** no projeto e quais são as fronteiras entre as camadas. Sem isso, em 6 meses todo arquivo está em `src/lib/utils.ts` e ninguém acha nada.

## 2. Princípios

1. **Cada arquivo tem uma responsabilidade clara.**
2. **Fronteiras de camada são respeitadas**: UI não toca Prisma, services não importam React.
3. **Lógica de negócio mora em services**, não em actions/handlers (que são apenas transporte).
4. **Schemas Zod são compartilhados** entre validação client (RHF), server (action) e geração de OpenAPI.

## 3. Estrutura de pastas

```
MyAccountant/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── public/                          # assets estáticos
├── docker/                          # configs de containers
├── src/
│   ├── app/                         # Next.js App Router
│   │   ├── (auth)/                  # rotas de autenticação (login, signup)
│   │   ├── (app)/                   # rotas autenticadas (com layout do app)
│   │   │   └── [accountId]/         # tudo escopado pela Account
│   │   ├── api/                     # Route Handlers (REST API)
│   │   │   ├── v1/                  # versionado
│   │   │   ├── auth/[...nextauth]/  # NextAuth handler
│   │   │   ├── docs/                # Swagger UI
│   │   │   └── health/              # healthcheck
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/                  # componentes React (todos client)
│   │   ├── ui/                      # primitivos (wrappers do MUI)
│   │   ├── forms/                   # forms reutilizáveis
│   │   ├── transactions/            # componentes específicos de Transaction
│   │   ├── months/                  # idem
│   │   └── dashboards/
│   ├── actions/                     # Server Actions (entry point UI)
│   │   ├── transactions.ts
│   │   ├── months.ts
│   │   └── ...
│   ├── server/                      # código que SÓ roda no servidor
│   │   ├── services/                # lógica de negócio (camada principal)
│   │   │   ├── transaction-service.ts
│   │   │   ├── month-service.ts
│   │   │   ├── account-service.ts
│   │   │   └── ...   │   ├── queries/                 # queries de leitura para RSCs
   │   │   ├── dashboards.ts
   │   │   ├── month-page.ts
   │   │   └── ...│   │   ├── api/                     # helpers de Route Handlers + OpenAPI
│   │   │   ├── openapi-registry.ts
│   │   │   ├── route-helpers.ts
│   │   │   └── errors.ts
│   │   ├── auth/                    # NextAuth config + session helpers
│   │   ├── prisma.ts                # singleton do PrismaClient
│   │   └── logger.ts                # singleton do Pino
│   ├── lib/                         # utilitários compartilhados (server + client)
│   │   ├── schemas/                 # Zod schemas (por entidade)
│   │   │   ├── transaction.ts
│   │   │   ├── month.ts
│   │   │   ├── shared.ts            # cuid, email, etc.
│   │   │   └── ...
│   │   ├── messages/                # i18n preparation (strings centralizadas)
│   │   │   └── pt-BR.ts
│   │   ├── money.ts                 # utilitários monetários
│   │   ├── dates.ts                 # utilitários de data
│   │   ├── env.ts                   # validação de env vars
│   │   ├── theme.ts                 # tema MUI
│   │   └── action-result.ts         # tipo ActionResult
│   ├── emails/                      # templates React Email
│   │   ├── invite.tsx
│   │   ├── welcome.tsx
│   │   └── password-reset.tsx
│   └── middleware.ts                # auth middleware
├── tests/                           # configs e helpers de teste
│   ├── setup.ts
│   ├── fixtures/
│   └── mocks/
├── .github/
│   └── workflows/
│       └── ci.yml
├── .eslintrc.json
├── .prettierrc.json
├── .prettierignore
├── docker-compose.yml
├── Dockerfile
├── Dockerfile.dev
└── ...
```

## 4. Camadas e fronteiras

```
┌─────────────────────────────────────────────────────┐
│                   UI (React)                         │
│   src/app/, src/components/                          │
│   ✅ pode importar de: lib/, actions/                │
│   ❌ não importa de: server/, prisma                 │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│           Entry Points (server-side)                 │
│   src/actions/ (Server Actions)                     │
│   src/app/api/ (Route Handlers)                     │
│   ✅ pode importar de: server/, lib/                 │
│   Responsabilidade: validar input, chamar service,  │
│   formatar resposta                                  │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│              Services (lógica de negócio)            │
│   src/server/services/                              │
│   ✅ pode importar de: server/prisma, lib/           │
│   ❌ não importa de: actions/, app/, components/     │
│   Responsabilidade: regras de negócio, transações,  │
│   orquestração entre repositórios                    │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│                    Data (Prisma)                     │
│   src/server/prisma.ts (singleton)                  │
└─────────────────────────────────────────────────────┘
```

### 4.1 UI (`src/app/`, `src/components/`)
- Server Components (RSC) fazem queries de leitura via `src/server/queries/` (nunca Prisma direto em components).
- Client Components chamam Server Actions, **nunca Prisma diretamente**.
- Sem regras de negócio nos componentes (formatação de display é ok).

### 4.1.1 Queries (`src/server/queries/`)
- Código **server-only** de leitura para RSCs. Importa Prisma diretamente.
- **Sem regra de negócio de mutação** — apenas queries `SELECT`.
- Funções chamadas em RSC devem usar `React.cache()` (ver `skills/performance/SKILL.md`).
- **Não** importar de `src/lib/queries/` — esse diretório não existe mais.

### 4.2 Actions (`src/actions/`)
- "Use server" no topo.
- Recebem input do client, validam com Zod, chamam o service correspondente.
- Retornam `ActionResult<T>` (ver `skills/server-actions/SKILL.md`).
- **Nada de lógica de negócio aqui** — só transporte.

### 4.3 Route Handlers (`src/app/api/v1/`)
- REST API documentada via OpenAPI.
- Mesmo padrão das Actions: valida → chama service → retorna resposta.
- A função de service é a mesma chamada pela Action.

### 4.4 Services (`src/server/services/`)
- Toda lógica de negócio mora aqui.
- Funções puras quando possível, async com Prisma quando precisa.
- Recebem entidades já validadas.
- Lançam erros específicos (`NotFoundError`, `ForbiddenError`, etc.) — não retornam `ActionResult`.

### 4.5 Schemas (`src/lib/schemas/`)
- Zod schemas, fonte única.
- Importáveis tanto no client (RHF) quanto no server (action/handler).
- Tipos inferidos via `z.infer<typeof schema>` — nunca duplique tipos manualmente.

## 5. Convenções de nomes

### 5.1 Arquivos
- **kebab-case** para arquivos: `transaction-service.ts`, `create-month-modal.tsx`.
- **PascalCase** apenas se o arquivo exporta um componente React único: `TransactionTable.tsx`.
- Sem `index.ts` em pastas pequenas (gera ambiguidade no editor). Exportações nomeadas direto do arquivo.

### 5.2 Funções
- **camelCase** descritivo: `createTransaction`, `getMonthTotal`.
- Services exportam funções nomeadas, não classes (programação funcional + Prisma já é classe).
- Helpers em arquivos `-utils.ts` ou no `lib/`.

### 5.3 Tipos e interfaces
- **PascalCase**: `Transaction`, `CreateTransactionInput`.
- Sufixo `Input` para tipos de entrada de actions/services.
- Sufixo `Output` para retornos quando ambíguo.

### 5.4 Constantes
- **SCREAMING_SNAKE_CASE** para valores módulo: `MAX_TRANSACTIONS_PER_TABLE = 1000`.
- **camelCase** para const exports normais: `defaultSections = [...]`.

## 6. ESLint e Prettier

### 6.1 ESLint config (`.eslintrc.json`)

```json
{
  "extends": [
    "next/core-web-vitals",
    "next/typescript",
    "plugin:@typescript-eslint/recommended",
    "prettier"
  ],
  "plugins": ["unused-imports", "import"],
  "rules": {
    "@typescript-eslint/no-unused-vars": "off",
    "unused-imports/no-unused-imports": "error",
    "unused-imports/no-unused-vars": [
      "warn",
      { "vars": "all", "varsIgnorePattern": "^_", "args": "after-used", "argsIgnorePattern": "^_" }
    ],
    "import/order": [
      "warn",
      {
        "groups": ["builtin", "external", "internal", "parent", "sibling", "index"],
        "pathGroups": [
          { "pattern": "@/**", "group": "internal", "position": "before" }
        ],
        "newlines-between": "always",
        "alphabetize": { "order": "asc", "caseInsensitive": true }
      }
    ],
    "no-console": ["warn", { "allow": ["warn", "error"] }],
    "@typescript-eslint/consistent-type-imports": "warn"
  }
}
```

### 6.2 Prettier config (`.prettierrc.json`)

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### 6.3 Prettier ignore (`.prettierignore`)

```
.next
node_modules
dist
build
coverage
pnpm-lock.yaml
*.md
prisma/migrations
```

### 6.4 Scripts no `package.json`

```json
{
  "scripts": {
    "lint": "next lint",
    "lint:fix": "next lint --fix",
    "format": "prettier --write \"src/**/*.{ts,tsx,js,jsx,json,css}\"",
    "format:check": "prettier --check \"src/**/*.{ts,tsx,js,jsx,json,css}\"",
    "typecheck": "tsc --noEmit"
  }
}
```

### 6.5 VSCode (`.vscode/settings.json`)

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

## 7. Imports

### 7.1 Path alias
Usar `@/` como alias para `src/`. Configurado no `tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### 7.2 Ordem de imports (auto via ESLint)
```ts
// 1. Built-in
import { readFile } from "node:fs/promises";

// 2. External
import { z } from "zod";
import { useForm } from "react-hook-form";

// 3. Internal (@/)
import { transactionSchema } from "@/lib/schemas/transaction";
import { transactionService } from "@/server/services/transaction-service";

// 4. Parent
import { formatCents } from "../utils";

// 5. Sibling
import { TransactionRow } from "./TransactionRow";
```

### 7.3 Type imports
```ts
import type { Prisma } from "@prisma/client";
import { type CreateTransactionInput, createTransactionSchema } from "@/lib/schemas/transaction";
```

## 8. Preparação para i18n

Mesmo sem `next-intl` no MVP, evite hardcode de strings em componentes.

### 8.1 Estrutura
```
src/lib/messages/
├── pt-BR.ts          # única fonte (MVP)
├── index.ts          # exporta `m` (mensagens)
└── types.ts          # tipo Messages
```

### 8.2 Padrão
```ts
// src/lib/messages/pt-BR.ts
export const messages = {
  transactions: {
    title: "Transações",
    newButton: "Nova transação",
    confirmDelete: "Deletar esta transação?",
    fields: {
      occurredOn: "Data",
      amount: "Valor",
      description: "Descrição",
    },
    errors: {
      invalidDate: "Data inválida",
      requiredAmount: "Valor é obrigatório",
    },
  },
  // ...
} as const;

// src/lib/messages/index.ts
export { messages as m } from "./pt-BR";
```

### 8.3 Uso
```tsx
import { m } from "@/lib/messages";

<Button>{m.transactions.newButton}</Button>
<TextField label={m.transactions.fields.occurredOn} />
```

### 8.4 Migração futura para `next-intl`
Quando for adicionar i18n, basta:
1. Criar `src/lib/messages/en.ts` com a mesma estrutura.
2. Substituir `index.ts` por um wrapper que retorna mensagens baseado em locale.
3. Configurar `next-intl` middleware.

**Sem precisar tocar nos componentes** — eles continuam usando `m.transactions.newButton`.

## 9. Clean code — regras práticas

### 9.1 Tamanho de arquivos
- **Componentes**: idealmente < 200 linhas. Se passar, quebre.
- **Services**: < 300 linhas. Função maior que 60 linhas: red flag.
- **Funções**: < 30 linhas. Se passar, tem subfunção implícita.

### 9.2 Early return
```ts
// ❌ Errado
function process(input) {
  if (input.valid) {
    if (input.hasData) {
      // lógica aninhada
    }
  }
}

// ✅ Certo
function process(input) {
  if (!input.valid) return;
  if (!input.hasData) return;
  // lógica linear
}
```

### 9.3 Nomes descritivos
```ts
// ❌ Errado
const d = new Date();
const tx = await getTx(id);

// ✅ Certo
const today = new Date();
const transaction = await getTransaction(id);
```

### 9.4 Comentários
- Comente **POR QUÊ**, não O QUÊ. Código já mostra o "o quê".
- `// HACK:`, `// TODO:`, `// FIXME:` são bem-vindos com contexto.

### 9.5 Funções puras
- Services tentam ser puros quando possível (entrada → saída, sem side effects).
- Side effects (DB, email, logs) ficam isolados e fáceis de mockar.

### 9.6 Imutabilidade
- Use `const` por default. `let` só quando reassignment é claro.
- Não mute parâmetros de função. Retorne novos objetos.

### 9.7 Magic numbers
- Extrair para constantes nomeadas:
  ```ts
  const MAX_INVITE_AGE_DAYS = 7;
  // em vez de: expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  ```

## 10. Server vs Client Components — regra prática

- **Default: Server Component** (sem `"use client"`).
- **`"use client"`** apenas quando precisar de:
  - State (`useState`, `useReducer`)
  - Effects (`useEffect`)
  - Event handlers (onClick, onChange)
  - Browser APIs
  - Componentes MUI que usam Context (a maioria)

Estratégia: páginas (`page.tsx`) e layouts são Server, mas extraem partes interativas para Client Components próximos.

## 11. Convenções de UI

### 11.1 Páginas de configurações

Rotas entregues sob `(app)/[accountId]/settings/`:

| Rota | Componente manager | Descrição |
|---|---|---|
| `settings/general` | `GeneralSettingsForm` | Nome da account, moeda, dia de início do mês, responsável padrão |
| `settings/account` | — | Info da account (leitura) |
| `settings/members` | — | Listagem + invite de membros |
| `settings/sections` | `SectionsManager` | Seções com countType e ordem |
| `settings/categories` | `CategoriesManager` | Categorias e subcategorias |
| `settings/institutions` | `InstitutionsManager` | Instituições financeiras |
| `settings/table-types` | `TableTypesManager` | Modelos de coluna (TableType) com colunas ocultáveis |
| `settings/templates` | `TemplatesManager` | Templates de importação CSV/XLSX |
| `settings/models` | `TableModelsManager` | Modelos de tabela (TableTemplate + itens recorrentes) |
| `settings/analyses` | `AnalysesManager` | Análises Sandbox salvas (pinning + contexto) |

Toda página sob `settings/` segue o padrão abaixo (ver `skills/mui-patterns/SKILL.md` §"Páginas de Configurações"):

```
Box sx={{ p: 4, maxWidth: 700 }}
  Typography variant="h5" fontWeight="bold" mb={3}
  <XManager accountId={accountId} initialData={data} />
```

- `maxWidth` padrão: **700** — não usar valores diferentes (`600`, `800`, `900`) sem justificativa.
- **Sem `mx: "auto"`** — conteúdo alinha à esquerda, sem centralização automática.
- Título sempre `variant="h5"`, `fontWeight="bold"`, `mb={3}`.

### 11.2 Menus do usuário

`UserMenuButton` usa `disableScrollLock` para evitar que a abertura do menu cause shift do layout (compensação de scrollbar pelo MUI).

### 11.3 Cor de destaque por usuário (AccentColor)

O sistema de temas suporta 10 paletas de cor de destaque por usuário, persistidas em `UserSettings.accentColor`.

- Definidas em `src/lib/accent-colors.ts` — cada preset tem `light` e `dark` variants.
- Construção de tema dinâmica: `buildThemeWithAccent(mode, accentKey)` em `src/lib/theme.ts`.
- Contexto exposto via `useThemeMode()` — campos `accentColor` e `setAccentColor`.
- Persistência dual: cookie `accent_color` (SSR rápido) + DB `user_settings.accent_color` (cross-device).
- UI: accordion "Cor de destaque" dentro de `UserMenuButton`, abaixo dos seletores de modo.

## 13. Decisões em aberto

- [ ] Repository layer separado dos Services? — **MVP: não**, Prisma é simples o suficiente. Adicionar se complexidade crescer.
- [ ] Storybook? — **MVP: não**.
- [ ] CSS-in-JS além do Emotion (default do MUI)? — **Não**, manter Emotion.
- [ ] Path alias `@/components` separado de `@/lib`? — **Não, só `@/`**.
