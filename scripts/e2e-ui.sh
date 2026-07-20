#!/usr/bin/env bash
# Playwright UI mode local (spec 58): sobe o stack e serve a UI do Playwright numa porta.
# Abra a URL no navegador → clique nos testes p/ rodar e ASSISTIR cada passo (snapshots do DOM,
# screenshots, time-travel). Não precisa de display no container nem de Node/pnpm no host.
#
# Uso:
#   scripts/e2e-ui.sh                 # UI em http://localhost:8080
#   E2E_UI_PORT=9000 scripts/e2e-ui.sh
#   E2E_KEEP=1 scripts/e2e-ui.sh      # não derruba o stack ao sair
#
# Ctrl+C encerra a UI.
set -euo pipefail

cd "$(dirname "$0")/.."

PROFILE=(--profile e2e)
APP=my-accountant-app-e2e-1
PORT="${E2E_UI_PORT:-8080}"

cleanup() {
  if [[ "${E2E_KEEP:-0}" != "1" ]]; then
    echo ""
    echo "==> Limpando stack e2e (E2E_KEEP=1 pula isto)"
    docker compose "${PROFILE[@]}" down -v >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

echo "==> Subindo postgres-e2e + app-e2e (build + migrate + seed). 1º boot é lento."
docker compose "${PROFILE[@]}" up -d --build postgres-e2e app-e2e

echo "==> Aguardando app-e2e ficar healthy..."
for _ in $(seq 1 120); do
  health=$(docker inspect -f '{{.State.Health.Status}}' "$APP" 2>/dev/null || echo none)
  [[ "$health" == "healthy" ]] && break
  status=$(docker inspect -f '{{.State.Status}}' "$APP" 2>/dev/null || echo missing)
  if [[ "$status" == "exited" ]]; then
    echo "!! app-e2e saiu antes de ficar healthy. Logs:"
    docker logs --tail 40 "$APP" || true
    exit 1
  fi
  sleep 5
done
[[ "$(docker inspect -f '{{.State.Health.Status}}' "$APP" 2>/dev/null)" == "healthy" ]] || {
  echo "!! app-e2e não ficou healthy a tempo."; docker logs --tail 40 "$APP" || true; exit 1;
}

echo ""
echo "===================================================================="
echo "  Playwright UI:  http://localhost:${PORT}"
echo "  Abra no navegador → clique num teste (ex.: solo-flow) p/ rodar e assistir."
echo "  Ctrl+C encerra."
echo "===================================================================="
echo ""

RUN_CMD="corepack enable && corepack prepare pnpm@9.15.4 --activate && pnpm install --frozen-lockfile && pnpm prisma generate && pnpm exec playwright test --ui-host=0.0.0.0 --ui-port=${PORT}"
docker compose "${PROFILE[@]}" run --rm --no-deps -p "${PORT}:${PORT}" e2e-runner sh -c "$RUN_CMD"
