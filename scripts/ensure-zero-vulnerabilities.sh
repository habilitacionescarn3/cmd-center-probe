#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

AUDIT_ARGS=()
if [ "${AUDIT_OMIT_DEV:-0}" = "1" ]; then
  AUDIT_ARGS+=(--omit=dev)
fi

AUDIT_FIX="${AUDIT_FIX:-1}"
fix_exit=0

if [ "${AUDIT_FIX}" = "1" ]; then
  echo "🔐 Aplicando correções automáticas de vulnerabilidades (npm audit fix)..."
  if [ "${#AUDIT_ARGS[@]}" -gt 0 ]; then
    set +e
    npm audit fix "${AUDIT_ARGS[@]}"
    fix_exit=$?
    set -e
  else
    set +e
    npm audit fix
    fix_exit=$?
    set -e
  fi
else
  echo "🔎 Modo validação: pulando npm audit fix e verificando apenas o estado atual."
fi

if [ "${fix_exit}" -ne 0 ]; then
  echo "⚠️  Nem todas as vulnerabilidades foram corrigidas automaticamente. Validando estado final..."
fi

echo "🛡️  Validando que não restaram vulnerabilidades..."
if [ "${#AUDIT_ARGS[@]}" -gt 0 ]; then
  npm audit "${AUDIT_ARGS[@]}" --audit-level=low
else
  npm audit --audit-level=low
fi

echo "✅ Dependências validadas com 0 vulnerabilities."
