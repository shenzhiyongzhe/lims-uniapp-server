#!/usr/bin/env bash
set -eo pipefail

# 1. Determine directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.deploy.yml"

echo "=== [1/5] Checking Environment ==="
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

read_env_var() {
  grep -E "^${1}=" "${ENV_FILE}" | head -1 | cut -d= -f2- | tr -d '\r' | sed -e 's/^["'\'']//' -e 's/["'\'']$//'
}

DOMAIN="$(read_env_var DOMAIN)"
DOMAIN="${DOMAIN:-www.jindijz.cn}"
SSL_EMAIL="$(read_env_var SSL_EMAIL)"
CERT_PATH="${SCRIPT_DIR}/certs/live/${DOMAIN}/fullchain.pem"

generate_nginx_conf() {
  local template="$1"
  echo "Generating nginx.generated.conf from ${template} (domain: ${DOMAIN})"
  sed "s/__DOMAIN__/${DOMAIN}/g" "${SCRIPT_DIR}/${template}" > "${SCRIPT_DIR}/nginx.generated.conf"
}

# 2.5 Generate nginx config (bootstrap HTTP-only until the first certificate exists)
if [ -f "${CERT_PATH}" ]; then
  echo "SSL certificate found at ${CERT_PATH}"
  generate_nginx_conf "nginx.conf"
else
  echo "No SSL certificate yet — using HTTP-only bootstrap config for ACME challenge"
  generate_nginx_conf "nginx.bootstrap.conf"
fi

# Export DOCKER_IMAGE if not set (default is local build image tag)
export DOCKER_IMAGE="${DOCKER_IMAGE:-ghcr.io/shenzhiyongzhe/lims-uniapp-server:latest}"
echo "Deploying image: ${DOCKER_IMAGE}"

mkdir -p "${SCRIPT_DIR}/certs"
mkdir -p "${SCRIPT_DIR}/certbot-challenge"
chmod +x "${SCRIPT_DIR}/certbot-entrypoint.sh"

# 3. Pull latest image if using remote image
if [[ "${DOCKER_IMAGE}" == *"ghcr.io"* ]]; then
  echo "=== [2/5] Pulling latest API image ==="
  docker compose -f "${COMPOSE_FILE}" pull api
else
  echo "=== [2/5] Using local image/build ==="
fi

# 4. Start Docker Compose services
echo "=== [3/5] Starting services (Database, API, Nginx, Certbot) ==="
export ENV_FILE
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d --remove-orphans

# 4.5 Obtain initial SSL certificate if missing
if [ ! -f "${CERT_PATH}" ]; then
  if [ -z "${SSL_EMAIL}" ]; then
    echo "WARN: SSL_EMAIL is not set in .env — skipping initial certificate request." >&2
    echo "      Add SSL_EMAIL=your@email.com and re-run deploy to enable HTTPS." >&2
  else
    echo "=== [4/5] Requesting initial SSL certificate for ${DOMAIN} ==="
    docker compose -f "${COMPOSE_FILE}" run --rm --entrypoint certbot certbot \
      certonly \
      --webroot -w /var/www/certbot \
      -d "${DOMAIN}" \
      --email "${SSL_EMAIL}" \
      --agree-tos \
      --no-eff-email \
      --non-interactive

    if [ -f "${CERT_PATH}" ]; then
      echo "Certificate issued — switching nginx to HTTPS config"
      generate_nginx_conf "nginx.conf"
      docker exec lims-nginx nginx -t
      docker exec lims-nginx nginx -s reload
    else
      echo "ERROR: Certificate request finished but ${CERT_PATH} was not created." >&2
      exit 1
    fi
  fi
else
  echo "=== [4/5] SSL certificate already present — skipping initial request ==="
fi

# 5. Output status and cleanup
echo "=== [5/5] Checking Service Status ==="
docker compose -f "${COMPOSE_FILE}" ps

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
