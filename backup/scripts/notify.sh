#!/bin/bash
# Uniwersalny notyfikator statusu backupu na Discord webhook.
# Uzycie: notify.sh <success|failure> <script_name> <detail>
#   success → zielony embed, failure → czerwony.
# Nigdy nie failuje wolajacego (exit 0) — notyfikacja to nie powod zeby wywalic backup.
set -uo pipefail

status="${1:-unknown}"
script_name="${2:-unknown}"
detail="${3:-}"
timestamp="$(date -u +%FT%TZ)"
hostname="$(hostname)"

case "${status}" in
    success) color=3066993;  emoji=":white_check_mark:";  title="backup OK" ;;
    failure) color=15158332; emoji=":rotating_light:";    title="backup FAILED" ;;
    *)       color=10181046; emoji=":information_source:"; title="backup ${status}" ;;
esac

echo "[${timestamp}] notify(${status}): ${script_name} — ${detail}" >&2

# Dev-friendly: brak webhooka albo placeholder z .env.example nie jest bledem.
if [[ -z "${DISCORD_WEBHOOK_URL:-}" ]] || [[ "${DISCORD_WEBHOOK_URL}" == *PLACEHOLDER* ]] || [[ "${DISCORD_WEBHOOK_URL}" == *REPLACE* ]]; then
    echo "[notify] DISCORD_WEBHOOK_URL not set (or placeholder), skipping" >&2
    exit 0
fi

# jq -n --arg: bezpieczne budowanie JSON-a z bash stringow (escape cudzyslowow/newline).
payload=$(jq -n \
    --arg content "${emoji} **bug-shot ${title}**" \
    --arg script "${script_name}" \
    --arg detail "${detail}" \
    --arg host "${hostname}" \
    --arg ts "${timestamp}" \
    --argjson color "${color}" \
    '{
        content: $content,
        embeds: [{
            color: $color,
            fields: [
                {name: "Script",   value: $script, inline: true},
                {name: "Host",     value: $host,   inline: true},
                {name: "Time UTC", value: $ts,     inline: true},
                {name: "Detail",   value: (if $detail == "" then "-" else $detail end), inline: false}
            ]
        }]
    }')

if curl -sS --max-time 10 --retry 1 --retry-delay 2 --fail \
    -X POST -H "Content-Type: application/json" \
    -d "${payload}" "${DISCORD_WEBHOOK_URL}" >/dev/null 2>&1; then
    echo "[notify] Discord notified (${status})" >&2
else
    echo "[notify] Discord notification failed (webhook down?)" >&2
fi

exit 0
