#!/usr/bin/env bash
# Print the NVIDIA inference gateway's list rates (LiteLLM /model/info) as
# rate-table rows, for the models whose gateway name matches a pattern. The
# rate tables take these per-token values: container/agent-runner/src/codex-cost.ts,
# src/cli/inference-pricing.ts and dashboard/codex-costs.ts (nv-dashboard).
#
# The gateway key lives in OneCLI, so the request runs inside a running coworker
# container, whose proxy adds the key. The script prints no key.
#
# A model served by several deployments prints one row per deployment, and a
# deployment can list $0; the table takes the model's non-zero list rate.
#
# Usage: scripts/gateway-model-rates.sh [model-regex]
#   scripts/gateway-model-rates.sh 'glm|kimi'
set -euo pipefail

pattern="${1:-.}"
base="${GATEWAY_BASE_URL:-https://inference-api.nvidia.com}"
container=$(docker ps --format '{{.Names}}' | grep '^ncl-' | head -1 || true)
if [ -z "$container" ]; then
  echo "gateway-model-rates: no running coworker container (ncl-*) to ask through" >&2
  exit 1
fi

docker exec -i "$container" sh -s -- "$pattern" "$base" <<'IN'
pattern="$1"
base="$2"
curl -sf -H 'Authorization: Bearer ROUTED_VIA_ONECLI_PROXY' "$base/model/info" | jq -r --arg p "$pattern" '
  .data[]
  | select(.model_name | test($p))
  | select(.model_info.input_cost_per_token != null)
  | "  \"\(.model_name | split("/") | last)\": { input: \(.model_info.input_cost_per_token), output: \(.model_info.output_cost_per_token), cacheRead: \(.model_info.cache_read_input_token_cost // 0) }, // \(.model_name)"
' | sort -u
IN
