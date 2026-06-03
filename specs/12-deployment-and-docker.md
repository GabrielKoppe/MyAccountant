# Spec 12 — Deployment e Docker

> Skills: [`env-validation`](../skills/env-validation/SKILL.md) · [`logging`](../skills/logging/SKILL.md)

## 1. Propósito

Define a estratégia de containerização do projeto para desenvolvimento local e deploy em produção. O objetivo é que **`docker compose up`** seja suficiente para subir todo o ambiente, e que o mesmo container rode em qualquer máquina (local, VPS, cloud).

## 2. Arquitetura

### 2.1 Local (desenvolvimento)

```
┌─────────────────────────────────────────────────┐
│              Docker network: myaccountant       │
│                                                  │
│  ┌──────────┐      ┌──────────┐    ┌─────────┐ │
│  │   app    │─────►│ postgres │    │ adminer │ │
│  │  :3000   │      │  :5432   │◄───│  :8080  │ │
│  │ (Next.js)│      │          │    │  (opt)  │ │
│  └──────────┘      └─────┬────┘    └─────────┘ │
│                          │                       │
│                    ┌─────▼──────┐                │
│                    │ postgres-  │                │
│                    │   data     │ (volume)       │
│                    └────────────┘                │
└─────────────────────────────────────────────────┘
        │                                
        │ source code (bind mount, hot reload)
        ▼
   ./src, ./prisma, etc.
```

### 2.2 Produção

Três caminhos suportados (escolher um, documentado em §7):

**A) Hybrid** (recomendado para começar): Next.js em Vercel + Postgres em Neon. Sem Docker em prod.
**B) Full Docker em VPS** (Hetzner, DigitalOcean, etc.): `docker compose` + Traefik para SSL.
**C) Self-hosted PaaS** (Coolify, Dokploy): wrapper sobre Docker.

## 3. Arquivos

### 3.1 Estrutura

```
MyAccountant/
├── Dockerfile              ← produção (multi-stage)
├── Dockerfile.dev          ← desenvolvimento (hot reload)
├── docker-compose.yml      ← dev local (default)
├── docker-compose.prod.yml ← simula prod local (override)
├── .dockerignore
├── .env.example
└── docker/
    ├── postgres/
    │   └── init.sql        ← extensões, etc.
    └── nginx/              ← opcional, se for full docker prod
        └── nginx.conf
```

### 3.2 `Dockerfile` (produção)

Multi-stage para imagem mínima. Aproveita o `output: 'standalone'` do Next.js.

```dockerfile
# syntax=docker/dockerfile:1.7

# ===== Stage 1: deps =====
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ===== Stage 2: builder =====
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variáveis em build-time (ex: NEXT_PUBLIC_*)
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL

RUN pnpm prisma generate
RUN pnpm build

# ===== Stage 3: runner =====
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Usuário não-root para segurança
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Standalone output do Next
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Prisma client + schema (para migrate deploy)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
```

> Requer no `next.config.js`:
> ```js
> module.exports = { output: 'standalone' };
> ```

### 3.3 `Dockerfile.dev` (desenvolvimento)

Mantém `node_modules` no container (para evitar conflito de plataforma com macOS/Windows host), código vem por bind mount.

```dockerfile
FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Instalar dependências primeiro (camada cacheada)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Código entra por bind mount no compose
EXPOSE 3000

CMD ["pnpm", "dev"]
```

### 3.4 `docker-compose.yml` (dev local)

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: myaccountant
      POSTGRES_PASSWORD: dev_password
      POSTGRES_DB: myaccountant
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U myaccountant"]
      interval: 5s
      timeout: 5s
      retries: 5

  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://myaccountant:dev_password@postgres:5432/myaccountant?schema=public
      DIRECT_URL: postgresql://myaccountant:dev_password@postgres:5432/myaccountant?schema=public
      NEXTAUTH_URL: http://localhost:3000
      NEXTAUTH_SECRET: dev_secret_change_in_prod_min_32_chars
      # OAuth (preencher no .env local)
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:-}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET:-}
      # Email
      RESEND_API_KEY: ${RESEND_API_KEY:-}
      EMAIL_FROM: ${EMAIL_FROM:-MyAccountant <dev@localhost>}
    volumes:
      # Bind mount do código para hot reload
      - ./:/app
      # Volume nomeado para node_modules (evita conflito host/container)
      - app-node-modules:/app/node_modules
      - app-next-cache:/app/.next
    depends_on:
      postgres:
        condition: service_healthy

  # OPCIONAL: UI web para inspecionar o postgres
  adminer:
    image: adminer:latest
    restart: unless-stopped
    ports:
      - "8080:8080"
    depends_on:
      postgres:
        condition: service_healthy
    profiles:
      - tools  # subir só com: docker compose --profile tools up

volumes:
  postgres-data:
  app-node-modules:
  app-next-cache:
```

### 3.5 `docker-compose.prod.yml` (override de produção local)

Para testar build de produção localmente:

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        DATABASE_URL: postgresql://myaccountant:dev_password@postgres:5432/myaccountant
    volumes: []  # sem bind mount em prod
    command: ["node", "server.js"]
    environment:
      NODE_ENV: production
```

Uso:
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build
```

### 3.6 `.dockerignore`

```
node_modules
.next
.git
.env
.env.local
.env.*.local
*.log
.DS_Store
README.md
specs/
skills/
docker/
docker-compose*.yml
Dockerfile*
.dockerignore
.vscode
.idea
coverage
```

### 3.7 `docker/postgres/init.sql`

Extensões e configs iniciais.

```sql
-- Extensões usadas
CREATE EXTENSION IF NOT EXISTS "citext";

-- Configurações de timezone (servidor sempre em UTC, conversão no app)
ALTER DATABASE myaccountant SET timezone TO 'UTC';
```

## 4. Setup local (primeira vez)

```bash
# 1. Clonar repo, entrar na pasta
git clone <repo> && cd MyAccountant

# 2. Criar .env (copia do example)
cp .env.example .env
# Editar valores se precisar de OAuth, etc.

# 3. Subir tudo
docker compose up -d

# 4. Aguardar postgres ficar healthy (cerca de 5s)
docker compose ps

# 5. Rodar migrations (primeira vez)
docker compose exec app pnpm prisma migrate dev --name init

# 6. (Opcional) Seed de dados de teste
docker compose exec app pnpm prisma db seed

# 7. Abrir
open http://localhost:3000
```

## 5. Workflow diário

```bash
# Subir
docker compose up -d

# Ver logs do app
docker compose logs -f app

# Rodar comando no container
docker compose exec app <comando>

# Exemplos:
docker compose exec app pnpm prisma migrate dev --name add_something
docker compose exec app pnpm prisma studio --browser none --hostname 0.0.0.0
docker compose exec app pnpm lint
docker compose exec app pnpm test

# Subir com Adminer (UI do postgres)
docker compose --profile tools up -d
# → http://localhost:8080 (server: postgres, user: myaccountant, pwd: dev_password)

# Parar tudo (mantém volumes)
docker compose down

# Parar e LIMPAR DB (cuidado!)
docker compose down -v

# Reconstruir após mudar Dockerfile ou package.json
docker compose up -d --build
```

## 6. Migrations dentro do container

### 6.1 Dev
```bash
# Cria nova migration + aplica
docker compose exec app pnpm prisma migrate dev --name <nome>

# Aplica migrations pendentes (sem criar nova)
docker compose exec app pnpm prisma migrate deploy

# Reset (cuidado — apaga dados)
docker compose exec app pnpm prisma migrate reset
```

### 6.2 Prod
- Em hybrid (Vercel + Neon): rodar `pnpm prisma migrate deploy` no build do Vercel (em `package.json`: `"build": "prisma migrate deploy && next build"`).
- Em full Docker: container "migrator" separado que roda `migrate deploy` antes do `app` subir, ou step manual via SSH.

## 7. Deploy em produção

### 7.1 Opção A: Hybrid (Vercel + Neon)

**Quando escolher**: prototipagem, escala pequena/média, prioriza simplicidade.

**Setup**:
1. Criar projeto no [Neon](https://neon.tech), copiar `DATABASE_URL` e `DIRECT_URL` (Neon usa connection pooling).
2. Criar projeto no [Vercel](https://vercel.com), conectar ao repo.
3. Variáveis de ambiente no Vercel:
   - `DATABASE_URL` (com pooling)
   - `DIRECT_URL` (sem pooling, para migrations)
   - `NEXTAUTH_URL` (URL do deploy)
   - `NEXTAUTH_SECRET` (gerar com `openssl rand -base64 32`)
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   - `RESEND_API_KEY`, `EMAIL_FROM`
4. `package.json` build script:
   ```json
   "build": "prisma generate && prisma migrate deploy && next build"
   ```
5. Push para `main` → Vercel buildoa e deploy.

**Custos** (faixa free → small):
- Vercel: free tier (Hobby) ou Pro $20/mo.
- Neon: free 0.5 GB → $19/mo (Launch).

### 7.2 Opção B: Full Docker em VPS

**Quando escolher**: controle total, evitar lock-in, dados sensíveis on-premise.

**Setup**:
1. Provisionar VPS (Hetzner CX22 ~€4/mo, DO $6/mo, etc.).
2. Instalar Docker + Docker Compose.
3. Configurar **Traefik** como reverse proxy (SSL automático com Let's Encrypt).
4. `docker-compose.prod.yml`:
   ```yaml
   services:
     postgres:
       image: postgres:16-alpine
       restart: always
       env_file: .env.prod
       volumes:
         - postgres-data:/var/lib/postgresql/data
       # sem expose de porta — só acessa via rede interna
   
     app:
       image: ghcr.io/<user>/myaccountant:latest  # ou build local
       restart: always
       env_file: .env.prod
       labels:
         - "traefik.enable=true"
         - "traefik.http.routers.app.rule=Host(`app.example.com`)"
         - "traefik.http.routers.app.tls.certresolver=le"
       depends_on:
         postgres:
           condition: service_healthy
   
     traefik:
       image: traefik:v3
       restart: always
       command:
         - --providers.docker
         - --entrypoints.web.address=:80
         - --entrypoints.websecure.address=:443
         - --certificatesresolvers.le.acme.email=you@example.com
         - --certificatesresolvers.le.acme.storage=/letsencrypt/acme.json
         - --certificatesresolvers.le.acme.httpchallenge.entrypoint=web
       ports:
         - "80:80"
         - "443:443"
       volumes:
         - /var/run/docker.sock:/var/run/docker.sock:ro
         - traefik-letsencrypt:/letsencrypt
   
   volumes:
     postgres-data:
     traefik-letsencrypt:
   ```
5. Migration workflow: SSH no servidor, `docker compose exec app pnpm prisma migrate deploy` antes de switchar tráfego (ou via init container).
6. Backup do volume `postgres-data` (cron + `pg_dump`).

**Custos**:
- VPS: €4-12/mo.
- Domínio: $10-15/ano.

### 7.3 Opção C: Self-hosted PaaS

[Coolify](https://coolify.io), [Dokploy](https://dokploy.com): instalam num VPS e te dão uma UI tipo Vercel sobre Docker. Boa pra quem quer controle mas não quer escrever YAML.

### 7.4 Comparação

| Critério | Hybrid (Vercel+Neon) | Full Docker VPS | Coolify/Dokploy |
|---|---|---|---|
| Setup inicial | 10min | 1-2h | 30min |
| Custo/mês (small) | $0-39 | $4-12 | $4-12 |
| Manutenção | nenhuma | média (updates, backups) | baixa |
| Escala vertical | fácil | manual | manual |
| Edge runtime | sim | não | não |
| Backup automático | sim | configurar | configurar |
| Lock-in | médio | nenhum | baixo |

> **Recomendação MVP**: começar com **Hybrid**. Migrar para Docker VPS depois se precisar de controle ou custo escalável.

## 8. Variáveis de ambiente

### 8.1 `.env.example`

```bash
# ===== Database =====
# Em dev (docker compose): postgres é o hostname do service
DATABASE_URL="postgresql://myaccountant:dev_password@postgres:5432/myaccountant?schema=public"
# Para migrations no Neon, use DIRECT_URL sem pooling
DIRECT_URL="postgresql://myaccountant:dev_password@postgres:5432/myaccountant?schema=public"

# ===== NextAuth =====
NEXTAUTH_URL="http://localhost:3000"
# Gere com: openssl rand -base64 32
NEXTAUTH_SECRET="change-me-min-32-characters-in-prod"

# ===== OAuth Google =====
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# ===== Email (Resend) =====
RESEND_API_KEY=""
EMAIL_FROM="MyAccountant <noreply@example.com>"
```

### 8.2 Convenções

- **Nunca commitar `.env`** (no `.gitignore`).
- Para dev compartilhado, time usa `.env.example` como template.
- Em prod, secrets via Vercel/Docker secrets (não env files no disco).
- `DATABASE_URL` em dev usa o hostname `postgres` (nome do service). Fora do docker, usa `localhost:5432`.

## 9. Acesso ao banco fora do docker

Se quiser conectar com pgAdmin/DBeaver/TablePlus na sua máquina:

```
Host: localhost
Port: 5432
Database: myaccountant
User: myaccountant
Password: dev_password
```

A porta `5432` está exposta no compose.

## 10. Healthchecks e logs

### 10.1 Healthchecks
- **Postgres**: `pg_isready` (já no compose).
- **App**: criar endpoint `/api/health` que verifica conexão com DB e responde 200.

```ts
// src/app/api/health/route.ts
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "error" }, { status: 503 });
  }
}
```

Healthcheck no compose:
```yaml
healthcheck:
  test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000/api/health"]
  interval: 30s
  timeout: 5s
  retries: 3
  start_period: 30s
```

### 10.2 Logs
- **Dev**: `docker compose logs -f app` para acompanhar.
- **Prod**: enviar para serviço (Logflare, Axiom, Better Stack) via stdout. Não escrever em arquivo.
- Estruturar logs como JSON em produção (pino, winston).

## 11. Troubleshooting

| Problema | Solução |
|---|---|
| `EADDRINUSE: address already in use 5432` | Postgres local rodando. Pare ele ou mude porta no compose. |
| Hot reload não funciona | Reinicie: `docker compose restart app`. Em macOS, considere `polling: true` em watchOptions. |
| `prisma migrate dev` falha com "no schema found" | Confirme que `./prisma/` está no bind mount. |
| `node_modules` com pacotes binários errados (sharp, bcrypt) | Volume `app-node-modules` resolve. Se rebuild: `docker compose up -d --build`. |
| Container `app` reinicia em loop | `docker compose logs app` para ver o erro. Geralmente conexão com DB. |
| Build muito lento | Use `pnpm` (não `npm`). `corepack` já está no Dockerfile. |

## 12. Edge cases

- **macOS performance**: bind mounts são lentos no macOS. Considere `:delegated` flag ou habilitar VirtioFS no Docker Desktop.
- **Migrations em prod sem downtime**: ver `02-database-prisma.md` §6.2 (estratégia de duas fases).
- **DB corrupted em dev**: `docker compose down -v && docker compose up -d` reseta tudo.
- **Subir em ARM (M1/M2)**: `node:22-alpine` é multi-arch, funciona nativamente. `postgres:16-alpine` também.
- **CI**: usar mesmas imagens no GitHub Actions com `services:`.

## 13. Decisões em aberto

- [ ] Provider de hosting em prod (decidir após primeiros usuários).
- [ ] Backup automatizado: cron com `pg_dump` para S3? Snapshot do volume? — definir antes de produção.
- [ ] Image registry: GitHub Container Registry, Docker Hub, ou self-hosted? — **default: GHCR**.
- [ ] Strategy de blue-green ou rolling deploy? — **MVP: simples restart**, evoluir depois.
- [ ] Telemetria/APM (Sentry, OpenTelemetry)? — adicionar quando tiver usuários reais.
