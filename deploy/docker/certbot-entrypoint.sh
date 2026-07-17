#!/bin/sh
set -e

# Install docker CLI so deploy-hook can reload nginx after renewal
if ! command -v docker >/dev/null 2>&1; then
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -qq
    apt-get install -y -qq --no-install-recommends docker.io >/dev/null
  elif command -v apk >/dev/null 2>&1; then
    apk add --no-cache docker-cli >/dev/null
  fi
fi

trap 'exit 0' TERM INT

while :; do
  certbot renew \
    --webroot -w /var/www/certbot \
    --quiet \
    --deploy-hook "sh -c 'docker exec lims-nginx nginx -s reload 2>/dev/null || true'"
  sleep 12h & wait $!
done