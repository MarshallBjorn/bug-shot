#!/bin/bash
# Argumenty (pozycyjne, opcjonalne):
#   $1 = nazwa skryptu ktory zawiodl
#   $2 = numer linii
#   $3 = exit code

set -uo pipefail

script_name="${1:-unknown}"
line="${2:-?}"
exit_code="${3:-?}"
timestamp="$(date -u +%FT%TZ)"
hostname="$(hostname)"

echo "[${timestamp}] notify-failure: ${script_name} line ${line} exit ${exit_code}" >&2

# Dev-friendly skip: brak webhooka albo placeholder z .env.example nie powinien
# byc traktowany jako blad. Loguje warning i wychodzi 0.
if [[ -z "${DISCORD_WEBHOOK_URL:-}" ]] || [[ "${DISCORD_WEBHOOK_URL}" == *PLACEHOLDER* ]]; then
    echo "[notify-failure] DISCORD_WEBHOOK_URL not set (or placeholder), skipping" >&2
    exit 0
fi

# Discord webhook przyjmuje JSON: {"content": "text", ...}. Escape zawartosci
# przez jq — bez tego cudzyslowy/nowe linie/backslashe rozwala JSON parser.
# jq -n --arg pattern to standardowy sposob zbudowania JSON-a z bash string.
payload=$(jq -n \
    --arg content ":rotating_light: **bug-shot backup FAILED**" \
    --arg script "${script_name}" \
    --arg line "${line}" \
    --arg exit_code "${exit_code}" \
    --arg host "${hostname}" \
    --arg ts "${timestamp}" \
    '{
        content: $content,
        embeds: [{
            color: 15158332,
            fields: [
                {name: "Script",   value: $script,   inline: true},
                {name: "Line",     value: $line,     inline: true},
                {name: "Exit",     value: $exit_code, inline: true},
                {name: "Host",     value: $host,     inline: true},
                {name: "Time UTC", value: $ts,       inline: true}
            ]
        }]
    }')

# curl: max 10s total, retry raz z backoff, --fail zeby wyjsc niezerem przy 4xx/5xx.
# Jesli Discord nie odpowiada — logujemy i wychodzimy 0. Nie chcemy dolozyc
# drugiej klopoty do juz zaraportowanej porazki backupu.
if curl -sS --max-time 10 --retry 1 --retry-delay 2 --fail \
    -X POST \
    -H "Content-Type: application/json" \
    -d "${payload}" \
    "${DISCORD_WEBHOOK_URL}" >/dev/null 2>&1; then
    echo "[notify-failure] Discord notified" >&2
else
    echo "[notify-failure] Discord notification failed (webhook down?)" >&2
fi

exit 0
