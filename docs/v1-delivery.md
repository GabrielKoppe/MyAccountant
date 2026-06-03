# MyAccountant — Entrega V1

> Documento de referência do que foi implementado e entregue no V1 do projeto. Data de corte: **2026-06-02**.

---

## 1. Visão Geral

O MyAccountant V1 é uma aplicação web de organização financeira pessoal e colaborativa. O V1 cobre todos os fluxos essenciais: autenticação, gestão de contas colaborativas, organização por meses/seções/tabelas/transações, importação de dados, dashboards e análises ad-hoc.

**Stack**: Next.js 15 (App Router) · TypeScript strict · NextAuth v5 · Prisma + PostgreSQL 16 · Material UI v6 · Docker

---

## 2. Fases Entregues

### Fase 0 — Setup ✅
- Next.js 15 com App Router, TypeScript strict
- Prisma + PostgreSQL 16 em Docker Compose (dev e prod)
- NextAuth v5 com Prisma Adapter
- Material UI v6 com tema customizado "Warm Calm" (light + dark)
- Design system completo com tokens semânticos (`src/lib/design-tokens.ts`)
- Docker Compose para dev e prod, imagem de produção otimizada
- CI/CD com GitHub Actions (lint, typecheck, testes)
- ESLint + Prettier configurados

### Fase 1 — Autenticação ✅
- Signup com email/senha
- Login com email/senha e OAuth (Google)
- Recuperação de senha (`/forgot-password`) via email Resend
- Seleção de account após login (`/select-account`)
- Onboarding para primeira account (`/onboarding`)

### Fase 2 — Accounts & Members ✅
- Criar Account no onboarding
- Listar accounts do usuário
- Convidar membros por email (convite com link)
- Aceitar/recusar convite (`/invite/accept`)
- Roles: `owner` | `editor` | `viewer`
- Gerenciar membros (`/settings/members`)

### Fase 3 — Account Settings ✅
- **Configurações gerais** (`/settings/general`): nome, moeda, dia de início do mês, responsável padrão
- **Seções** (`/settings/sections`): CRUD + reordenação + countType (`add`/`subtract`/`ignore`/`neutral`)
- **Categorias** (`/settings/categories`): CRUD hierárquico (categoria → subcategorias)
- **Instituições** (`/settings/institutions`): CRUD
- **Modelos de coluna** (`/settings/table-types`): CRUD + toggles de colunas visíveis por tipo

### Fase 4 — Meses & Navegação ✅
- Criar mês (com data de início customizável por `monthStartDay`)
- Navegar entre meses (anterior/próximo)
- Layout do mês com seções e tabelas agrupadas
- Listagem de meses da account

### Fase 5 — Finance Tables ✅
- CRUD de tabelas financeiras dentro de seções
- `sourceMethod`: `empty` | `copy` | `import` | `template`
- Reordenação de tabelas dentro da seção
- Toggle `countInMonth` (override do default da seção)
- Tipos de tabela com colunas configuráveis via `TableType`

### Fase 6 — Transações ✅
- CRUD de transações (individual e bulk)
- Campos completos: data, valor, descrição, categoria, subcategoria, instituição, responsável, notas
- Flags: `isFavorite`, `isPending`
- `cardInstallment` (ex: "3/12") e `investmentType`
- Filtros e ordenação na listagem

### Fase 7 — Importação CSV/XLSX ✅
- Upload e parsing de CSV/XLSX
- Mapeamento de colunas com preview
- Salvar templates de importação (`/settings/templates`)
- Suporte a formatos de data e valor configuráveis

### Fase 8 — Dashboards ✅
- **Dashboard mensal** (`/dashboards/monthly/[monthId]`): totais por seção, categorias, top transações
- **Dashboard anual** (`/dashboards/yearly/[year]`): evolução mensal, treemap, comparativos
- **Sandbox de análise** (`/dashboards/sandbox`): configuração livre de gráficos (groupBy × seriesBy × chartType)

---

## 3. Features Além do MVP

Funcionalidades implementadas além do escopo original das fases 0–8:

### Modelos de Tabela (`TableTemplate`)
- Definir transações recorrentes como modelo (`/settings/models`)
- Ao criar uma tabela com `sourceMethod=template`, os itens do modelo são copiados como transações
- Editor de itens do template com campos completos

### Análises Sandbox Salvas (`SavedAnalysis`)
- Salvar configurações do Sandbox como "análises" com nome
- Fixar até 4 análises no dashboard (mensal, anual ou ambos)
- Gerenciar análises salvas em `/settings/analyses`

### Cor de Destaque por Usuário
- 10 paletas de cor (índigo, violeta, fúcsia, rosa, laranja, âmbar, verde, teal, céu, slate)
- Preferência por usuário, persistida em `UserSettings.accentColor` e cookie `accent_color`
- Seletor no menu do usuário (acordeão abaixo do seletor night/bright)
- Mudança em tempo real sem reload

---

## 4. Arquitetura Técnica

### Camadas
```
UI (RSC + Client Components)
  └─ Server Actions → Services → Prisma
  └─ Route Handlers → Services → Prisma
```

- **Server Actions** via `defineAction()` — retorno padronizado `ActionResult<T>`
- **Services** contêm toda a lógica de negócio; actions/routes são apenas transporte
- **Multi-tenancy** garantido: toda query filtra por `accountId` via `requireAccountAccess()`

### Decisões de Design
| Decisão | Motivo |
|---|---|
| `BigInt` para valores monetários | Evita erros de arredondamento de float |
| Data `occurred_on` sem timezone | Só data, sem hora; timezone aplicado na apresentação |
| Zod schemas como fonte única | Valida form (RHF), action e gera OpenAPI |
| MUI v6 + tokens semânticos | Consistência visual + suporte a dark mode + accent color |
| Cookie + DB para preferências | Cookie para SSR rápido; DB para sync cross-device |

### Infraestrutura
- **Dev**: Docker Compose com PostgreSQL 16 + app Next.js em modo dev com hot reload
- **Prod**: Dockerfile multi-stage (builder → runner com `node:22-alpine`), imagem ~200MB
- **Deploy**: suporta Vercel + Neon (serverless) ou VPS com Docker Compose prod

---

## 5. Banco de Dados

### Entidades (17 modelos)
| Modelo | Descrição |
|---|---|
| `User` | Usuário autenticado (NextAuth) |
| `UserSettings` | Preferências por usuário (timezone, accentColor) |
| `Account` | Grupo colaborativo |
| `AccountSettings` | Configurações da account (moeda, monthStartDay) |
| `AccountMember` | Associação User↔Account com role |
| `AccountInvite` | Convite pendente para membros |
| `Month` | Mês financeiro (pode diferir do calendário) |
| `Section` | Agrupador de tabelas com countType |
| `FinanceTable` | Tabela de transações dentro de seção/mês |
| `Transaction` | Linha financeira com todos os campos |
| `TableType` | Modelo de colunas visíveis |
| `Category` | Categoria de transação |
| `Subcategory` | Subcategoria (filha de Category) |
| `Institution` | Instituição financeira |
| `CsvTemplate` | Template de mapeamento CSV/XLSX |
| `TableTemplate` | Modelo de tabela com transações recorrentes |
| `TableTemplateItem` | Item de um TableTemplate |
| `SavedAnalysis` | Análise Sandbox salva com config e pinning |

### Migrações
| Arquivo | Descrição |
|---|---|
| `20260601135316_init` | Schema inicial completo |
| `20260602194554_add_accent_color` | Campo `accent_color` em `user_settings` |

---

## 6. API REST

Documentação interativa disponível em `/api/docs` (Swagger UI).

Endpoints entregues em `/api/v1/`:
- `GET /accounts` — listar accounts do usuário
- `GET /accounts/:id/months` — meses da account
- `GET /months/:id/tables` — tabelas do mês
- `GET /tables/:id/transactions` — transações da tabela
- `GET /health` — healthcheck

---

## 7. O que NÃO foi entregue no V1

- Exportação de dados (CSV/PDF)
- Notificações in-app (bell icon)
- Mobile (app é responsivo mas não foi otimizado para mobile)
- Relatórios avançados (além dos dashboards existentes)
- Integração com Open Banking / APIs de bancos
- Multi-idioma (código preparado com `src/lib/messages/pt-BR.ts` mas só PT-BR)

---

## 8. Como rodar

```bash
# Subir o projeto
cp .env.example .env
# edite .env com suas variáveis (ver docs/create-env.md)
docker compose up -d

# Primeiro uso: rodar migrações
docker compose exec app pnpm prisma migrate deploy

# Acesse http://localhost:3000
```

Ver [docs/create-env.md](create-env.md) para configurar variáveis de ambiente.

---

## 9. Referências

| Documento | Conteúdo |
|---|---|
| `specs/00-overview.md` | Visão geral e roadmap |
| `specs/01-domain-model.md` | Todas as entidades do domínio |
| `specs/02-database-prisma.md` | Schema Prisma e convenções de DB |
| `specs/03-authentication.md` | Fluxo de auth (NextAuth v5) |
| `specs/12-deployment-and-docker.md` | Docker e opções de deploy |
| `skills/design-system/SKILL.md` | Tokens, paleta, tipografia |
| `skills/server-actions/SKILL.md` | Padrão `defineAction` + `ActionResult` |
| `skills/multitenancy/SKILL.md` | Isolamento por `accountId` |
| `skills/money-handling/SKILL.md` | BigInt em centavos |
| `skills/mui-patterns/SKILL.md` | Componentes MUI + padrão de settings |
