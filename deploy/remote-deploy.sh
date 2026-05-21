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

# 容器内 localhost / 127.0.0.1 均指向容器自身；宿主机 PostgreSQL 须用 --network host 迁移
normalize_host_pg_url() {
  printf '%s' "$1" \
    | sed -e 's/@localhost:/@127.0.0.1:/' -e 's/@host\.docker\.internal:/@127.0.0.1:/'
}

uses_host_postgresql() {
  printf '%s' "$1" | grep -qE '@(localhost|127\.0\.0\.1|host\.docker\.internal):'
}

if uses_host_postgresql "$DATABASE_URL_VAL"; then
  MIGRATE_DATABASE_URL="$(normalize_host_pg_url "$DATABASE_URL_VAL")"
  echo "migrate: docker run --network host (DATABASE_URL → 127.0.0.1 on deploy host)" >&2
  run_prisma_migrate "${MIGRATE_DATABASE_URL}"
else
  docker compose -f "${COMPOSE_FILE}" run -T --rm api npx prisma migrate deploy
fi

if printf '%s' "$DATABASE_URL_VAL" | grep -q '@localhost:' \
  && [ "${COMPOSE_UP_FILE}" = "docker-compose.prod.yml" ]; then
  echo "WARN: .env uses localhost; running API in bridge mode cannot reach host PostgreSQL." >&2
  echo "      Use host.docker.internal in DATABASE_URL, or COMPOSE_UP_FILE=docker-compose.prod.hostnetwork.yml" >&2
fi

echo "=== [3/4] compose up -d ===" >&2
docker compose -f "${COMPOSE_UP_FILE}" up -d --remove-orphans

echo "=== [4/4] cleanup old images ===" >&2
# 清理悬空镜像 (如 :latest 更新后原镜像会变成 <none>)
docker image prune -f || true

# 清理同一仓库下的其他 tag 的旧镜像
IMAGE_REPO="${DOCKER_IMAGE%:*}"
if [ -n "$IMAGE_REPO" ]; then
  OLD_IMAGES=$(docker images --format '{{.Repository}}:{{.Tag}}' | grep -E "^${IMAGE_REPO}:" | grep -vFx "${DOCKER_IMAGE}" || true)
  if [ -n "$OLD_IMAGES" ]; then
    echo "Removing old images:" >&2
    echo "$OLD_IMAGES" >&2
    docker rmi $OLD_IMAGES || true
  else
    echo "No old tags to remove." >&2
  fi
fi

echo "=== deploy OK ===" >&2
