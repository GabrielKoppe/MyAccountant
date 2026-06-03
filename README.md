# MyAccountant

Aplicação web de organização financeira pessoal e colaborativa.

## Visão rápida

Múltiplos usuários compartilham uma **Account** (com papéis owner/editor/viewer). Os dados são organizados por **Mês → Seção → Tabela Financeira → Transação**, com importação de CSV/XLSX e dashboards de visualização.

## Stack

- Next.js 15 (App Router) + TypeScript
- PostgreSQL 16 + Prisma
- NextAuth v5 (email/senha + Google OAuth)
- Zod + React Hook Form
- Material UI v6 + Emotion
- Docker + Docker Compose

## Documentação

Este projeto segue **spec-driven development**. Toda feature começa por um spec.

- 📖 **[CLAUDE.md](./CLAUDE.md)** — Steering document para o Claude Code (convenções, regras inegociáveis)
- 📋 **[specs/](./specs/)** — Specs por feature/fase
- 🔧 **[skills/](./skills/)** — Padrões reutilizáveis

### Por onde começar

1. Leia `specs/00-overview.md` para entender o projeto.
2. Leia `specs/01-domain-model.md` para o modelo de domínio.
3. Leia `specs/12-deployment-and-docker.md` para o setup de containers.
4. Siga as fases descritas em `specs/00-overview.md`.

## Desenvolvimento

**Pré-requisitos**: Docker Desktop (ou Docker Engine + Compose v2).

```bash
# 1. Copie o env de exemplo
cp .env.example .env
# (Opcional) preencha GOOGLE_CLIENT_ID, RESEND_API_KEY, etc.

# 2. Suba a stack (postgres + app)
docker compose up -d

# 3. Rode migrations (primeira vez)
docker compose exec app pnpm prisma migrate dev --name init

# 4. (Opcional) seed de dados de teste
docker compose exec app pnpm prisma db seed

# 5. Abra http://localhost:3000
```

### Comandos do dia-a-dia

```bash
docker compose logs -f app                            # acompanhar logs
docker compose exec app pnpm prisma migrate dev       # nova migration
docker compose --profile tools up -d                  # subir com Adminer (UI do postgres em :8080)
docker compose down                                   # parar tudo
docker compose down -v                                # parar e LIMPAR DB (cuidado)
```

Detalhes completos em `specs/12-deployment-and-docker.md`.

## Status

🚧 Em planejamento — fase 0 (setup) ainda não iniciada.
