#!/usr/bin/env bash
# 在部署机 DEPLOY_PATH 下执行：pull → prisma migrate deploy → compose up
# 用法：export DOCKER_IMAGE=ghcr.io/.../lims-uniapp-server:<sha>
#       bash deploy/remote-deploy.sh
set -exo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
COMPOSE_UP_FILE="${COMPOSE_UP_FILE:-docker-compose.prod.yml}"

: "${DOCKER_IMAGE:?Set DOCKER_IMAGE to ghcr.io/.../lims-uniapp-server:tag}"

echo "=== [1/3] pull ===" >&2
docker compose -f "${COMPOSE_FILE}" pull api

echo "=== [2/3] prisma migrate deploy ===" >&2
DATABASE_URL_VAL="$(
  grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '\r' \
    | sed -e 's/^["'\'']//' -e 's/["'\'']$//'
)"

run_prisma_migrate() {
  local db_url="$1"
  docker run --rm --network host \
    -e "DATABASE_URL=${db_url}" \
    "${DOCKER_IMAGE}" \
    npx prisma migrate deploy
}

if printf '%s' "$DATABASE_URL_VAL" | grep -q '@host\.docker\.internal:'; then
  MIGRATE_DATABASE_URL="${DATABASE_URL_VAL//@host.docker.internal:/@127.0.0.1:}"
  echo "migrate: docker run --network host + DATABASE_URL host 127.0.0.1 (was host.docker.internal)" >&2
  run_prisma_migrate "${MIGRATE_DATABASE_URL}"
else
  docker compose -f "${COMPOSE_FILE}" run -T --rm api npx prisma migrate deploy
fi

echo "=== [3/3] compose up -d ===" >&2
docker compose -f "${COMPOSE_UP_FILE}" up -d --remove-orphans

echo "=== deploy OK ===" >&2
