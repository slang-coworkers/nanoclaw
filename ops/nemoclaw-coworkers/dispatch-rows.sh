#!/usr/bin/env bash
# Dispatch gap-matrix rows to the Orchestrator, one thread per row, via the dashboard's loopback chat API.
# Usage (on the box): bash dispatch-rows.sh GOV-F24 GOV-F26 LOOP-F38     # ids as args; default = batch 1
set -euo pipefail
case $(hostname) in slang-cpu-coworkers*) ;; *) echo "WRONG_HOST=$(hostname)"; exit 1;; esac
API=${API:-http://127.0.0.1:3937/api/chat/send}
GAP=~/haaggarwal/nemoclaw-coworkers/data/shared/hermes/gap-matrix.md
ROWS=("$@")
[ ${#ROWS[@]} -gt 0 ] || ROWS=(LOOP-F35 LOOP-F36 SELF-F56)   # batch 1a: the P2 compose plugin — blocks every other plugin exit

for ID in "${ROWS[@]}"; do
  ROW=$(grep -m1 -E "^\| *${ID} *\|" "$GAP" || true)
  [ -n "$ROW" ] || { echo "SKIP $ID — not in gap-matrix.md"; continue; }
  NAME=$(printf '%s' "$ROW" | awk -F'|' '{gsub(/^ +| +$/,"",$3); print $3}')
  read -r -d '' CONTENT <<EOF || true
Dispatch ${ID} — ${NAME}.

Requirement row: /workspace/shared/hermes/gap-matrix.md (row ${ID}); evidence: /workspace/shared/hermes/gap-matrix-evidence.md (section ${ID}). Cite the pinned release tree; author plugin code against the MAIN module paths named in the evidence (dual tag/main cites).

Do: add the ${ID} row to /workspace/agent/reports/ledger.md (row-id = ${ID}), then dispatch to hermes-architect on thread_id "hermes-${ID}" for the ADR + acceptance test. Merge only through the merge gate (P1–P6 all green). Reply here only with the outcome line when the row is merged or blocked.
EOF
  BODY=$(jq -cn --arg g orchestrator --arg c "$CONTENT" --arg t "hermes-${ID}" '{group:$g, content:$c, thread_id:$t}')
  CODE=$(curl -sS -o /tmp/dispatch-$ID.out -w '%{http_code}' -X POST "$API" -H 'content-type: application/json' -d "$BODY")
  echo "$ID → HTTP $CODE $(head -c 160 /tmp/dispatch-$ID.out)"
  sleep 2
done
