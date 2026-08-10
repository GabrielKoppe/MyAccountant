#!/usr/bin/env bash
# E2E runner local (spec 58). Sobe o stack dedicado, roda o Playwright e reporta o placar.
#
# Uso:
#   scripts/e2e.sh                      # roda todos os cenários
#   scripts/e2e.sh viewer-readonly      # roda só um spec (por substring do nome do arquivo)
#   E2E_KEEP=1 scripts/e2e.sh           # não derruba o stack no fim (reruns rápidos)
#
# Requer: Docker + Docker Compose v2. Não precisa de Node/pnpm no host.
set -euo pipefail

cd "$(dirname "$0")/.."

PROFILE=(--profile e2e)
APP=my-accountant-app-e2e-1
RUNNER=my-accountant-e2e-runner-1
SPEC="${1:-}"

# ATENÇÃO — NUNCA use `down -v` aqui.
#
# `docker compose down -v` remove TODOS os volumes top-level do projeto,
# independente de `--profile`: isso inclui `postgres-data`, o banco de
# DESENVOLVIMENTO. Este script já apagou o banco de dev de alguém exatamente
# assim (o `-v` estava neste trap). O CLAUDE.md §8 documenta a armadilha.
#
# O jeito certo é `down` sem `-v` (para os containers) + remoção NOMINAL do
# volume do e2e.
E2E_VOLUME=my-accountant_postgres-e2e-data

cleanup() {
  if [[ "${E2E_KEEP:-0}" != "1" ]]; then
    echo "==> Limpando stack e2e (E2E_KEEP=1 pula isto)"
    docker compose "${PROFILE[@]}" down >/dev/null 2>&1 || true
    docker volume rm "$E2E_VOLUME" >/dev/null 2>&1 || true
    # `down` (mesmo sem `-v`) também para o app/postgres do dev, porque serviços
    # sem `profiles:` entram no escopo. Restaura o stack de dev.
    docker compose up -d >/dev/null 2>&1 || true
    # O e2e-runner roda `prisma generate` no node_modules compartilhado com o
    # dev: sem regenerar, o `pnpm typecheck` do app passa a falhar com
    # "Module '@prisma/client' has no exported member 'Account'".
    docker compose exec -T app pnpm prisma generate >/dev/null 2>&1 || true
    docker compose restart app >/dev/null 2>&1 || true
  else
    echo "==> Stack mantida de pé (E2E_KEEP=1)."
    echo "    Para limpar: docker compose --profile e2e down && docker volume rm $E2E_VOLUME"
    echo "    NUNCA 'down -v' — apaga o banco de dev junto."
  fi
}
trap cleanup EXIT

echo "==> Subindo postgres-e2e + app-e2e (build + migrate + seed). Pode demorar no 1º boot."
docker compose "${PROFILE[@]}" up -d --build postgres-e2e app-e2e

echo "==> Aguardando app-e2e ficar healthy..."
for _ in $(seq 1 120); do
  status=$(docker inspect -f '{{.State.Status}}' "$APP" 2>/dev/null || echo missing)
  health=$(docker inspect -f '{{.State.Health.Status}}' "$APP" 2>/dev/null || echo none)
  [[ "$health" == "healthy" ]] && break
  if [[ "$status" == "exited" ]]; then
    echo "!! app-e2e saiu antes de ficar healthy. Logs:"
    docker logs --tail 40 "$APP" || true
    exit 1
  fi
  sleep 5
done
health=$(docker inspect -f '{{.State.Health.Status}}' "$APP" 2>/dev/null || echo none)
if [[ "$health" != "healthy" ]]; then
  echo "!! app-e2e não ficou healthy a tempo. Logs:"
  docker logs --tail 40 "$APP" || true
  exit 1
fi
echo "==> app-e2e healthy."

# Comando base do runner (pina pnpm 9.15.4 + gera o Prisma Client).
RUN_CMD='corepack enable && corepack prepare pnpm@9.15.4 --activate && pnpm install --frozen-lockfile && pnpm prisma generate && pnpm exec playwright test'
if [[ -n "$SPEC" ]]; then
  echo "==> Rodando apenas: $SPEC"
  RUN_CMD="$RUN_CMD $SPEC"
else
  echo "==> Rodando todos os cenários E2E"
fi

set +e
docker compose "${PROFILE[@]}" run --rm --no-deps e2e-runner sh -c "$RUN_CMD"
code=$?
set -e

echo "==> Playwright exit code: $code (0 = tudo passou)"
exit $code
