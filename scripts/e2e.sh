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

cleanup() {
  if [[ "${E2E_KEEP:-0}" != "1" ]]; then
    echo "==> Limpando stack e2e (E2E_KEEP=1 pula isto)"
    docker compose "${PROFILE[@]}" down -v >/dev/null 2>&1 || true
  else
    echo "==> Stack mantida de pé (E2E_KEEP=1). Rode 'docker compose --profile e2e down -v' p/ limpar."
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
