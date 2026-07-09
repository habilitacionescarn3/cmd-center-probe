#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "🚀 Dafiti Command Center – inicializando ambiente local"

APP_PORT="${APP_PORT:-5004}"
POSTGRES_PORT="${POSTGRES_PORT:-5001}"

has_lsof=0
if command -v lsof >/dev/null 2>&1; then
  has_lsof=1
fi

find_available_port() {
  local desired=$1
  local avoid=$2
  local port=$desired

  if [ "${has_lsof}" -eq 0 ]; then
    echo "${port}"
    return
  fi

  while lsof -Pi :"${port}" -sTCP:LISTEN -t >/dev/null 2>&1 || [ "${port}" -eq "${avoid}" ]; do
    port=$((port + 1))
  done
  echo "${port}"
}

NEW_POSTGRES_PORT="$(find_available_port "${POSTGRES_PORT}" -1)"
if [ "${NEW_POSTGRES_PORT}" != "${POSTGRES_PORT}" ]; then
  echo "ℹ️  Porta ${POSTGRES_PORT} já está em uso. Usando ${NEW_POSTGRES_PORT} para o Postgres."
  POSTGRES_PORT="${NEW_POSTGRES_PORT}"
fi

NEW_APP_PORT="$(find_available_port "${APP_PORT}" "${POSTGRES_PORT}")"
if [ "${NEW_APP_PORT}" != "${APP_PORT}" ]; then
  echo "ℹ️  Porta ${APP_PORT} já está em uso. Usando ${NEW_APP_PORT} para a aplicação."
  APP_PORT="${NEW_APP_PORT}"
fi

export APP_PORT
export POSTGRES_PORT
export DATABASE_URL="postgresql://postgres:postgres@localhost:${POSTGRES_PORT}/status_page?schema=public"
export NEXTAUTH_URL="http://localhost:${APP_PORT}"

if [ ! -f ".env" ]; then
  echo "⚠️  Arquivo .env não encontrado. Copiando de .env.example..."
  cp .env.example .env
fi

if command -v docker >/dev/null 2>&1; then
  echo "🐘 Iniciando Postgres via Docker Compose..."
docker compose up -d db >/dev/null

  echo -n "⏳ Aguardando Postgres ficar pronto"
  set +e
  for _ in $(seq 1 40); do
    docker compose exec -T db pg_isready -U postgres -d status_page >/dev/null 2>&1
    if [ $? -eq 0 ]; then
      echo " ✅"
      break
    fi
    printf "."
    sleep 1
  done
  set -e
else
  echo "⚠️  Docker não encontrado. Certifique-se de que o PostgreSQL está rodando em ${POSTGRES_PORT:-5439} antes de prosseguir."
fi

echo "📦 Instalando dependências..."
npm install

echo "🔐 Corrigindo e validando vulnerabilidades antes do start..."
npm run security:zero-vuln

echo "🛠️  Gerando cliente Prisma..."
PRISMA_CLI_QUERY_ENGINE_TYPE=wasm npx prisma generate

echo "📚 Aplicando migrações..."
PRISMA_CLI_QUERY_ENGINE_TYPE=wasm npx prisma migrate deploy

echo "🌱 Populando dados de exemplo..."
npm run db:seed

echo "💻 Subindo servidor Next.js em modo desenvolvimento..."
echo "   (Ctrl+C para encerrar)"
PORT="$APP_PORT" npm run dev -- --port "$APP_PORT"
