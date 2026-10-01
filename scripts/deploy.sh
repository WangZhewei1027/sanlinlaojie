#!/usr/bin/env bash
# Build the production image locally and roll it out to the Aliyun server.
#
#   scripts/deploy.sh                      # uses deploy/.env.production
#   scripts/deploy.sh deploy/.env.staging
#   SKIP_BUILD=1 scripts/deploy.sh         # re-ship the last built image
#
# Steps: buildx (linux/amd64) → docker save | ssh docker load → copy compose +
# Caddyfile + env → docker compose up -d. Base images (postgis, caddy) are
# shipped the same way the first time, since the server cannot reach Docker Hub.
# Database migrations are NOT run here — see scripts/db/migrate.ts (run it
# through an SSH tunnel: scripts/db-tunnel.sh).
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=${1:-deploy/.env.production}
HOST=${DEPLOY_HOST:-root@139.196.189.102}
DIR=${DEPLOY_DIR:-/opt/sanlin}
TAG=$(git rev-parse --short HEAD)$( [ -n "$(git status --porcelain)" ] && echo "-dirty" || true )
IMAGE=sanlin-web

[ -f "$ENV_FILE" ] || { echo "missing $ENV_FILE (see deploy/env.example)"; exit 1; }

env_value() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- ; }

if [ -z "${SKIP_BUILD:-}" ]; then
  echo "▶ building $IMAGE:$TAG (linux/amd64)"
  docker buildx build --platform linux/amd64 --load \
    --build-arg NEXT_PUBLIC_SITE_URL="$(env_value NEXT_PUBLIC_SITE_URL)" \
    --build-arg NEXT_PUBLIC_MEDIA_BASE_URL="$(env_value NEXT_PUBLIC_MEDIA_BASE_URL)" \
    --build-arg NEXT_PUBLIC_TIANDITU_KEY="$(env_value NEXT_PUBLIC_TIANDITU_KEY)" \
    -t "$IMAGE:$TAG" -t "$IMAGE:latest" .
else
  docker tag "$IMAGE:latest" "$IMAGE:$TAG"
fi

ship_image() {
  local image=$1
  if ssh "$HOST" "docker image inspect $image >/dev/null 2>&1"; then
    echo "▶ $image already on server"
  else
    echo "▶ shipping $image"
    docker save "$image" | gzip -1 | ssh "$HOST" "gunzip | docker load"
  fi
}

ship_image postgis/postgis:17-3.5
ship_image caddy:2-alpine
echo "▶ shipping $IMAGE:$TAG"
docker save "$IMAGE:$TAG" | gzip -1 | ssh "$HOST" "gunzip | docker load"

echo "▶ copying compose files"
ssh "$HOST" "mkdir -p $DIR"
scp -q deploy/docker-compose.yml deploy/Caddyfile "$HOST:$DIR/"
scp -q "$ENV_FILE" "$HOST:$DIR/.env"

echo "▶ starting"
ssh "$HOST" "cd $DIR && docker tag $IMAGE:$TAG $IMAGE:latest && docker compose up -d --remove-orphans && docker image prune -f >/dev/null && docker compose ps"
