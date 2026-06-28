#!/usr/bin/env bash
set -eo pipefail

# 1. Determine directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "=== [1/4] Checking Environment ==="
echo "Project Root: ${PROJECT_ROOT}"
echo "Script Dir:   ${SCRIPT_DIR}"

# 2. Check and load environment variables from .env
if [ ! -f "${PROJECT_ROOT}/.env" ]; then
  echo "ERROR: .env file not found at ${PROJECT_ROOT}/.env" >&2
  echo "Please create a .env file containing the required environment variables." >&2
  exit 1
fi

ENV_FILE="${PROJECT_ROOT}/.env"
echo "Using env file: ${ENV_FILE}"

# Export DOCKER_IMAGE if not set (default is local build image tag)
export DOCKER_IMAGE="${DOCKER_IMAGE:-ghcr.io/shenzhiyongzhe/lims-uniapp-server:latest}"
echo "Deploying image: ${DOCKER_IMAGE}"

# Create certs directory if not exists
mkdir -p "${SCRIPT_DIR}/certs"

# 3. Pull latest image if using remote image
if [[ "${DOCKER_IMAGE}" == *"ghcr.io"* ]]; then
  echo "=== [2/4] Pulling latest API image ==="
  docker compose -f "${SCRIPT_DIR}/docker-compose.deploy.yml" pull api
else
  echo "=== [2/4] Using local image/build ==="
fi

# 4. Start Docker Compose services
echo "=== [3/4] Starting services (Database, API, Nginx) ==="
export ENV_FILE
docker compose -f "${SCRIPT_DIR}/docker-compose.deploy.yml" --env-file "${ENV_FILE}" up -d --remove-orphans

# 5. Output status and cleanup
echo "=== [4/4] Checking Service Status ==="
docker compose -f "${SCRIPT_DIR}/docker-compose.deploy.yml" ps

# Prune old images to clean up space
echo "Pruning dangling images..."
docker image prune -f || true

# Clean old tag images if registry image was updated
IMAGE_REPO="${DOCKER_IMAGE%:*}"
if [[ -n "$IMAGE_REPO" && "${DOCKER_IMAGE}" == *"ghcr.io"* ]]; then
  OLD_IMAGES=$(docker images --format '{{.Repository}}:{{.Tag}}' | grep -E "^${IMAGE_REPO}:" | grep -vFx "${DOCKER_IMAGE}" || true)
  if [ -n "$OLD_IMAGES" ]; then
    echo "Removing old tags:"
    echo "$OLD_IMAGES"
    docker rmi $OLD_IMAGES || true
  fi
fi

echo "=== Deployment Successful ==="
