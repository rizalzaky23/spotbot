#!/usr/bin/env bash
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/home/rizal/spotbot}"

echo "🚀 Deploying SpotBot to $DEPLOY_PATH..."
cd "$DEPLOY_PATH"

echo "[1/3] Checking environment..."
if [ ! -f .env ]; then
  echo "❌ .env file not found in $DEPLOY_PATH!"
  exit 1
fi

echo "[2/3] Building Docker container..."
docker compose build

echo "[3/3] Recreating and starting SpotBot container..."
docker compose up -d --force-recreate

echo "🧹 Cleaning unused docker dangling images..."
docker image prune -f || true

echo "✅ SpotBot deployment finished successfully!"
