#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

TARGET_REVISION="${1:-${DEPLOY_REVISION:-origin/main}}"

echo "🔁 Reiniciando ambiente dockerizado do Dafiti Command Center"

if command -v git >/dev/null 2>&1; then
  echo "⬇️  Atualizando código do repositório..."
  git fetch --all --prune

  if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
    echo "📦 Worktree local com alterações. Guardando em stash antes do deploy..."
    git stash push --include-untracked --message "command-center-deploy-$(date +%Y%m%d%H%M%S)" >/dev/null 2>&1 || true
  fi

  echo "🎯 Fixando revisão alvo: ${TARGET_REVISION}"
  if ! git rev-parse --verify "${TARGET_REVISION}^{commit}" >/dev/null 2>&1; then
    echo "❌ Revisão alvo não encontrada após git fetch: ${TARGET_REVISION}"
    exit 1
  fi

  git checkout --detach "${TARGET_REVISION}"

  echo "🧾 Commit em deploy: $(git rev-parse HEAD)"
fi

if [ ! -f ".env" ]; then
  echo "⚠️  Arquivo .env não encontrado. Copiando de .env.example..."
  cp .env.example .env
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

APP_PORT="${APP_PORT:-5004}"
POSTGRES_PORT="${POSTGRES_PORT:-5001}"

export APP_PORT
export POSTGRES_PORT
export DATABASE_URL="postgresql://postgres:postgres@localhost:${POSTGRES_PORT}/status_page?schema=public"
export NEXTAUTH_URL="${NEXTAUTH_URL:-http://localhost:${APP_PORT}}"

echo "🐘  Garantindo Postgres online na porta fixa ${POSTGRES_PORT}..."
docker compose up -d db

echo "⏳  Aguardando Postgres ficar saudável..."
until docker compose exec -T db pg_isready -U postgres -d status_page >/dev/null 2>&1; do
  sleep 1
done

echo "🏗️  Gerando build local para validação (opcional)..."
if command -v npm >/dev/null 2>&1; then
  npm run build || true
else
  echo "⚠️  npm não encontrado no host. Pulando build local e seguindo com Docker."
fi

echo "⬆️  Construindo imagem do app (suave)..."
docker compose build app

echo "🗃️  Aplicando migrations (Prisma)..."
docker compose run --rm app npx prisma migrate deploy --schema prisma/schema.prisma

echo "🔁  Atualizando container do app..."
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

echo "✅ Ambiente online. Serviços ativos:"
docker compose ps
echo ""
if command -v git >/dev/null 2>&1; then
  echo "🧾 Commit ativo em produção: $(git rev-parse HEAD)"
fi
echo "🔗 Painel disponível em: https://commandcenter.dafiti.ai/admin"
