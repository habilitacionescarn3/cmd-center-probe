#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

if ! command -v jq >/dev/null 2>&1; then
  echo "Erro: jq não encontrado no PATH. Instale o jq para continuar." >&2
  exit 1
fi

INSTANA_BASE_URL="${INSTANA_BASE_URL:-https://apm-dafiti.instana.io}"
INSTANA_BASE_URL="${INSTANA_BASE_URL%/}"
INSTANA_TOKEN="${INSTANA_TOKEN:-}"
WINDOW_MS="${1:-3600000}"

if [[ -z "$INSTANA_TOKEN" && -f "$PROJECT_ROOT/.env" ]]; then
  # shellcheck disable=SC1090
  source "$PROJECT_ROOT/.env"
  INSTANA_TOKEN="${INSTANA_TOKEN:-}"
fi

if [[ -z "$INSTANA_TOKEN" ]]; then
  cat <<'EOS'
# ❌ Instana token não encontrado

Defina a variável `INSTANA_TOKEN` no ambiente ou no arquivo `.env` antes de executar.

Exemplos:

```bash
export INSTANA_TOKEN=seu_token
./scripts/instana-test.sh
```
EOS
  exit 1
fi

format_time() {
  local epoch_ms="$1"
  local epoch_s=$((epoch_ms / 1000))
  date -r "$epoch_s" +"%d/%m/%Y %H:%M:%S"
}

TO_SECONDS="$(date +%s)"
TO_MS="$((TO_SECONDS * 1000))"
FROM_MS="$((TO_MS - WINDOW_MS))"

API_URL="$INSTANA_BASE_URL/api/events?windowSize=$WINDOW_MS&from=$FROM_MS&to=$TO_MS&excludeTriggeredBefore=true&filterEventUpdates=true&eventTypeFilters=incident&eventTypes=incident"
INCIDENTS_JQ=$(cat <<'JQ'
def events_list:
  if type == "array" then .
  elif type == "object" then (
    if (.items? | type) == "array" then .items
    elif (.data?.items? | type) == "array" then .data.items
    else [] end
  )
  else [] end;

events_list
| map(select(type == "object"))
| map(
    select(
      ((.type // "") | ascii_downcase) == "incident"
      or ((.event.type // "") | ascii_downcase) == "incident"
      or ((.incident.type // "") | ascii_downcase) == "incident"
    )
    | . as $raw
    | ($raw.event // $raw.incident // $raw) as $base
    | ($raw.problem | if type == "object" then . else {} end) as $problem
    | ($raw.problem | if type == "string" then . else "" end) as $problemText
    | {
        id: ($base.id // $raw.id // "N/A"),
        title: (
          $base.label
          // $base.name
          // $base.title
          // $base.description
          // $problem.title
          // $problemText
          // $raw.detail
          // $raw.problem
          // "Incidente Instana"
        ),
        description: (
          $base.description
          // $problem.description
          // $problemText
          // $raw.detail
          // ($base.title // "")
          // $raw.problem
        ),
        severity: ([
            $base.severity,
            $base.issueSeverity,
            $raw.severity
          ]
          | map(select(. != null))
          | first
          | tostring
          | ascii_upcase),
        state: (
          $base.state
          // $base.eventState
          // $raw.state
          // $raw.eventState
          // ""
        ),
        startedAt: (
          $base.startTime
          // $raw.startTime
          // $raw.start
          // ((now * 1000) | floor)
        ),
        endedAt: (
          $base.endTime
          // $raw.endTime
          // $raw.end
          // null
        )
      }
  )
| map(
    .startedAtIso = ((.startedAt / 1000) | todateiso8601)
    | .endedAtIso = (
        if .endedAt == null then null else ((.endedAt / 1000) | todateiso8601) end
      )
  )
| sort_by(.startedAt)
| reverse
JQ
)

cat <<EOF
# 🔍 Instana incidents – teste local

**Endpoint:** \`GET $API_URL\`
**Window (ms):** $WINDOW_MS (de $(format_time "$FROM_MS") até $(format_time "$TO_MS"))

---

## ▶️ Executando requisição
EOF

RESPONSE="$(curl -sSf \
  -H "Authorization: apiToken $INSTANA_TOKEN" \
  -H "Accept: application/json" \
  "$API_URL" )"

INCIDENTS="$(printf '%s' "$RESPONSE" | jq "$INCIDENTS_JQ")"
COUNT="$(printf '%s' "$INCIDENTS" | jq 'length')"
STATE_TABLE="$(printf '%s' "$INCIDENTS" | jq '
  map(.state // "unknown")
  | group_by(.)
  | map({ state: .[0], count: length })
')"

cat <<'EOF'

## 📦 Incidentes normalizados
EOF
echo '```json'
printf '%s' "$INCIDENTS" | jq .
echo '```'

SHOW_RAW="${INSTANA_SHOW_RAW:-false}"
SHOW_RAW_NORMALIZED="$(printf '%s' "$SHOW_RAW" | tr '[:upper:]' '[:lower:]')"
if [[ "$SHOW_RAW_NORMALIZED" == "true" ]]; then
  cat <<'EOF'

### 📄 Payload bruto retornado pela API
EOF
  echo '```json'
  printf '%s' "$RESPONSE" | jq .
  echo '```'
fi

cat <<EOF

## 🧮 Incidentes na última hora
- Total: $COUNT incidentes
- Por estado:
EOF

echo '```json'
printf '%s\n' "$STATE_TABLE" | jq .
echo '```'

cat <<'EOF'

## ✅ Resumo por incidente
EOF

if [[ "$COUNT" != "0" ]]; then
  printf '%s' "$INCIDENTS" | jq -r '
    .[]
    | "### \(.title)
- ID: \(.id)
- Severity: \(.severity // "N/A")
- State: \(.state // "N/A")
- Started: \(.startedAtIso)
- Ended: \(.endedAtIso // "-")
- Description: \((.description // "" | gsub("[[:space:]]+"; " ") | if . == "" then "-" else . end))
"
  '
else
  echo "Nenhum incidente retornado no período informado."
fi

cat <<'EOF'

## ℹ️ Observação

Esta consulta replica o endpoint `GET /api/events` utilizado pelo backend (`src/server/instana/events.ts`). Ajuste a janela informando `./scripts/instana-test.sh 900000` e utilize a flag `INSTANA_SHOW_RAW=true` para debugar o payload original sempre que necessário.
EOF
