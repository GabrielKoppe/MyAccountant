# Spec 16 — CI/CD

> Skills: [`testing`](../skills/testing/SKILL.md) · [`env-validation`](../skills/env-validation/SKILL.md)

## 1. Propósito

Define o pipeline de Continuous Integration: o que roda em cada PR e push, e como o deploy é gatilhado. Sem CI, bugs estúpidos (typo, lint, teste quebrado) chegam em prod.

## 2. Stack

- **GitHub Actions** (free para repos privados pequenos e públicos)
- **pnpm** (já é o package manager)
- **Branch protection rules** (configurar no GitHub Settings)

## 3. Triggers e pipelines

### 3.1 Em todo PR contra `main`
Rodam **em paralelo** os jobs:
1. **lint** — ESLint
2. **format** — Prettier check
3. **typecheck** — `tsc --noEmit`
4. **test** — Vitest
5. **prisma-validate** — `prisma validate` + `prisma format --check`
6. **build** — `next build` (último, depende dos anteriores passarem)

### 3.2 Em push pra `main`
Mesmo pipeline + **deploy**:
- Hybrid (Vercel): deploy automático via integração nativa.
- Full Docker: build da imagem + push pro registry + (manual) deploy no VPS.

### 3.3 Em tags `v*`
Release notes automáticas + tag da imagem Docker.

## 4. Workflow base

```yaml
# .github/workflows/ci.yml

name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

env:
  PNPM_VERSION: "9"
  NODE_VERSION: "22"

jobs:
  install:
    name: Install deps
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Cache node_modules
        uses: actions/cache@v4
        with:
          path: |
            node_modules
            .next/cache
          key: ${{ runner.os }}-node-${{ hashFiles('pnpm-lock.yaml') }}

  lint:
    name: Lint
    needs: install
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm format:check

  typecheck:
    name: Typecheck
    needs: install
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm prisma generate
      - run: pnpm typecheck

  test:
    name: Test
    needs: install
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm prisma generate
      - run: pnpm test
        env:
          SKIP_ENV_VALIDATION: "1"

  prisma-validate:
    name: Prisma validate
    needs: install
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm prisma validate
      - run: pnpm prisma format --check

  build:
    name: Build
    needs: [lint, typecheck, test, prisma-validate]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm prisma generate
      - run: pnpm build
        env:
          SKIP_ENV_VALIDATION: "1"
```

## 5. Workflow de Docker build (opcional)

Se for usar Docker em prod, build da imagem ao mergear em `main`:

```yaml
# .github/workflows/docker-publish.yml

name: Docker Publish

on:
  push:
    branches: [main]
    tags: ["v*"]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=sha,prefix=sha-

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

## 6. Branch protection (configurar no GitHub UI)

Settings → Branches → Add rule para `main`:
- ☑ Require pull request before merging
- ☑ Require approvals (1+)
- ☑ Dismiss stale approvals on new commits
- ☑ Require status checks to pass before merging:
  - lint
  - typecheck
  - test
  - prisma-validate
  - build
- ☑ Require branches to be up to date before merging
- ☑ Require linear history (no merge commits)
- ☑ Restrict who can push to matching branches (apenas maintainers)

## 7. Secrets necessários

GitHub Settings → Secrets and variables → Actions:

| Secret | Quando precisa |
|---|---|
| `GITHUB_TOKEN` | automático |
| `VERCEL_TOKEN` | se for fazer deploy via CLI (não precisa com integração nativa) |
| `RESEND_API_KEY` | se rodar testes que tocam Resend (não no MVP) |
| `DOCKER_REGISTRY_TOKEN` | só se usar registry externo |

## 8. Dependabot

Habilitar atualizações automáticas de dependências:

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    groups:
      next:
        patterns:
          - "next"
          - "@next/*"
          - "eslint-config-next"
      mui:
        patterns:
          - "@mui/*"
          - "@emotion/*"
      prisma:
        patterns:
          - "prisma"
          - "@prisma/*"
      testing:
        patterns:
          - "vitest"
          - "@vitest/*"
          - "@testing-library/*"

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "monthly"

  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "monthly"
```

## 9. PR templates

```markdown
<!-- .github/pull_request_template.md -->

## O que mudou?

<!-- Descrição breve da mudança -->

## Por quê?

<!-- Contexto, motivação -->

## Spec relacionado

<!-- Link pro spec (ex: `specs/09-transactions.md`) -->

## Checklist

- [ ] Specs atualizados (se mudou comportamento)
- [ ] Skills aplicáveis seguidos
- [ ] Testes adicionados/atualizados
- [ ] Teste de multi-tenancy se houve nova mutation
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` passam local
- [ ] Migration nomeada de forma descritiva
- [ ] Sem `console.log` esquecido
- [ ] Sem `process.env.X` direto (usar `env`)
- [ ] Mensagens de UI vão para `src/lib/messages/`

## Screenshots / Demos (se UI)

<!-- Anexar -->
```

## 10. Issue templates

```markdown
<!-- .github/ISSUE_TEMPLATE/bug.md -->

## Descrição

## Como reproduzir
1.
2.
3.

## Resultado esperado

## Resultado obtido

## Ambiente
- OS:
- Navegador:
- Versão do app:
```

## 11. Deploy

### 11.1 Hybrid (Vercel)
Integração nativa do Vercel + GitHub: auto-deploy de cada push em `main`. Configurar:
- Em Vercel → Settings → Git → conectar repo.
- Build command: `pnpm build` (que inclui `prisma migrate deploy && next build`).
- Preview deploys em cada PR.

### 11.2 Full Docker em VPS
Manual via SSH inicialmente:
```bash
ssh user@vps
cd /opt/myaccountant
docker compose pull
docker compose up -d
```

Futuramente: GitHub Actions com SSH + deploy script:
```yaml
- uses: appleboy/ssh-action@v1
  with:
    host: ${{ secrets.SSH_HOST }}
    username: ${{ secrets.SSH_USER }}
    key: ${{ secrets.SSH_KEY }}
    script: |
      cd /opt/myaccountant
      docker compose pull
      docker compose up -d
```

## 12. Métricas de saúde do CI

Monitorar:
- **Duração média** do pipeline (alvo: < 5min total).
- **Taxa de falha em PR** (alvo: < 10%).
- **Tempo de espera por revisão** (informativo).

Se passar de 5min, considerar paralelizar mais ou cachear `.next/cache`.

## 13. Anti-patterns

❌ Skipar testes "porque é urgente" (use `--skip-checks` só em hotfix de prod)
❌ Push direto na `main` (branch protection deve bloquear)
❌ Secret commitado (rotacionar imediatamente se vazar)
❌ CI rodando contra Postgres real em PR (lento, flaky) — manter mocks
❌ Dependabot ignorado (PRs viram backlog)

## 14. Decisões em aberto

- [ ] Coverage gate no CI (PR falha se coverage cair)? — **adicionar após estabilizar**
- [ ] Bundle size check no CI? — **considerar com size-limit**
- [ ] Visual regression tests? — **só se UI ficar complexa**
- [ ] Performance tests (Lighthouse CI)? — **v2**
- [ ] Auto-merge de PRs do Dependabot (patch only)? — **considerar após 1 mês de uso**
