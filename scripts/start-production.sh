#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "🏭 Dafiti Command Center – first production start"

if command -v git >/dev/null 2>&1; then
  echo "⬇️  Atualizando código (git pull)..."
  git fetch --all --prune
  git pull --rebase --autostash
fi

if [ ! -f ".env" ]; then
  echo "❌ Arquivo .env não encontrado. Copie .env.example e preencha os segredos antes de continuar."
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "❌ Docker não encontrado. Instale Docker + Docker Compose e tente novamente."
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

APP_PORT="${APP_PORT:-5004}"
POSTGRES_PORT="${POSTGRES_PORT:-5001}"

export NEXTAUTH_URL="${NEXTAUTH_URL:-http://localhost:${APP_PORT}}"

echo "📦 Atualizando imagens base..."
docker compose pull db >/dev/null 2>&1 || true

echo "🐘 Subindo Postgres na porta ${POSTGRES_PORT}..."
docker compose up -d db

echo -n "⏳ Aguardando Postgres aceitar conexões"
until docker compose exec -T db pg_isready -U postgres -d status_page >/dev/null 2>&1; do
  printf "."
  sleep 2
done
echo " ✅"

echo "🧹 Limpando artefatos Docker antigos..."
docker system prune -f >/dev/null 2>&1 || true

echo "🏗️  Construindo imagem do app..."
docker compose build app

echo "🗃️  Aplicando migrations (Prisma)..."
docker compose run --rm app npx prisma migrate deploy --schema prisma/schema.prisma

echo "🚀  Subindo app atualizado..."
docker compose up -d app

echo -n "🔎 Validando se o app ficou em execução após start seguro"
sleep 3
if docker compose ps --status running app | grep -q "app"; then
  echo " ✅"
else
  echo " ❌"
  echo "❌ O container do app não ficou em execução. Logs recentes:"
  docker compose logs --tail=120 app || true
  exit 1
fi

echo "📋 Serviços em execução:"
docker compose ps

echo ""
echo "✅ Stack pronta. Acesse o painel em: https://commandcenter.dafiti.ai/admin"
echo "   (ajuste o domínio conforme configurado no Caddy/Proxy)"
