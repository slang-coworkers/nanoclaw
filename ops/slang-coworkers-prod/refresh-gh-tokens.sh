#!/bin/bash
# Refresh the GitHub App installation token everywhere prod uses it: the GH_TOKEN fallback in the prod .env,
# the gh CLI login, six api.github.com OneCLI secrets (raw token) and sixteen github.com OneCLI secrets
# (Basic base64(x-access-token:TOKEN)). Cron runs it every 30 minutes because the token lives one hour.
#
# Prod runs this file from ~/.config/nanoclaw/refresh-gh-tokens.sh; this copy is the reviewed source.
# It holds secret ids only, never a token.
#
# Every OneCLI call goes to the management API at $API. The gateway publishes that API on 127.0.0.1 only
# (scripts/onecli-gateway-swap.sh binds it there), so the default is the loopback address.
#
# A failed update does not stop the others. Each failure writes one ERROR line to the log with the secret id,
# the last line counts the updated and failed secrets, and the exit status is 1 when anything failed.
#
# Environment (the defaults fit prod):
#   ONECLI_API_HOST       the OneCLI management API   (default http://127.0.0.1:10254)
#   NANOCLAW_CONFIG_DIR   gh-app-token.py and refresh.log   (default /home/ubuntu/.config/nanoclaw)
#   NANOCLAW_PROD_ENV     the .env that keeps GH_TOKEN  (default /home/ubuntu/slang-coworkers-prod/nanoclaw/.env)
set -uo pipefail

# Cron runs with a minimal PATH; onecli and gh live in user-local bin.
export PATH="/home/ubuntu/.local/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

API=${ONECLI_API_HOST:-http://127.0.0.1:10254}
CFG=${NANOCLAW_CONFIG_DIR:-/home/ubuntu/.config/nanoclaw}
PROD_ENV=${NANOCLAW_PROD_ENV:-/home/ubuntu/slang-coworkers-prod/nanoclaw/.env}
LOG=$CFG/refresh.log
UPDATED=0
FAILED=0

log() { echo "$(date): $*" >> "$LOG"; }

TOKEN=$(python3 "$CFG/gh-app-token.py" 2>/dev/null)
if [ -z "$TOKEN" ]; then
  log "ERROR: Failed to generate GitHub App token (shader-slang install)"
  exit 1
fi

# lego-nanoclaw / haaggarwal-dev / jhelferty use the OneCLI proxy for GitHub auth and keep no GH_TOKEN in
# their .env. Only prod still has GH_TOKEN in .env as a fallback.
if [ -f "$PROD_ENV" ]; then
  if ! sed -i "s|^GH_TOKEN=.*|GH_TOKEN=$TOKEN|" "$PROD_ENV"; then
    log "ERROR: could not write GH_TOKEN to $PROD_ENV"
    FAILED=$((FAILED + 1))
  fi
fi

# The host has no gh today; a gh login failure never counts as a failed refresh.
command -v gh >/dev/null 2>&1 && echo "$TOKEN" | gh auth login --with-token 2>/dev/null || true

# update_api_secret <id>: store the raw token in one api.github.com secret through the onecli CLI. On failure
# it logs the exit status and the first line of output, with the token replaced by <token>.
update_api_secret() {
  local out rc
  out=$(ONECLI_API_HOST=$API onecli secrets update --id "$1" --value "$TOKEN" 2>&1)
  rc=$?
  if [ "$rc" = 0 ]; then
    UPDATED=$((UPDATED + 1))
  else
    out=$(printf '%s\n' "${out//"$TOKEN"/<token>}" | head -1 | cut -c1-160)
    log "ERROR: OneCLI update of secret $1 failed at $API (exit $rc): $out"
    FAILED=$((FAILED + 1))
  fi
}

# patch_git_secret <id>: store the Basic value in one github.com secret through the management API. A status
# other than 2xx is a failure; 000 means the API did not answer.
patch_git_secret() {
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' -m 20 -X PATCH "$API/api/secrets/$1" \
    -H "Content-Type: application/json" -d "{\"value\":\"$GIT_PUSH_VALUE\"}")
  case "$code" in
    2??) UPDATED=$((UPDATED + 1)) ;;
    *)
      log "ERROR: OneCLI update of secret $1 failed at $API (HTTP $code)"
      FAILED=$((FAILED + 1))
      ;;
  esac
}

# --- api.github.com App-token secrets (raw token) ---
# /rate_limit — the quota endpoint that `gh api rate_limit` and health probes call; without a secret on this
# path the gateway answers 401 "app not connected", which agents read as a GitHub outage. This is the old
# catch-all secret (display name "GitHub (gh CLI)") with its path narrowed to /rate_limit: every agent already
# holds a published grant for it, and a newly created secret gets no grant while OneCLI's grant write times
# out.
update_api_secret 70e49372-173a-41c6-8d6b-8355977b1879
# /repos/shader-slang/* — App-token guard so the shader-slang API stays on the App (wins over the
# nv-slang-bot USER PAT /repos/* because this is cron-refreshed = newest tuple).
update_api_secret 48ed702b-6f5c-4a9d-bd99-0be32353e685
# /repos/shader-slang/slang/actions/* — App token for workflow_dispatch and run rerun. The /repos/* USER PAT
# is read-only on the public repo (push:false) and gets 403 "Must have admin rights" there. This secret must
# be refreshed LAST of the /repos/shader-slang/* set so it stays the newest tuple on the actions path.
update_api_secret 8b1c3365-486d-4f0f-ac16-4bf8f3175907
# /graphql, /search/* and /user — dedicated App-token secrets that replace the catch-all.
update_api_secret bcb9d4d2-2caa-4c19-95c3-c1baf45dba76
update_api_secret ea6a6dd9-8b88-4587-bf56-d3642df8efc1
update_api_secret 5145efc4-a517-4d70-aa0a-cb25276013b0
API_OK=$UPDATED

# --- github.com App-token git-push/read secrets (Basic base64(x-access-token:APP)) ---
# shader-slang/slang fix/issue-* push and public submodule reads. d5a3bb2e is the read secret for
# github.com/KhronosGroup/* (the glslang, SPIRV-Tools, SPIRV-Headers and Vulkan-Headers submodules).
# Pushes to the slang-coworkers forks use separate nv-slang-bot user-PAT secrets that this job does not touch.
GIT_PUSH_VALUE=$(printf '%s' "x-access-token:$TOKEN" | base64 -w0)
for SID in 3002afd1-33e5-4141-9df9-e69849f89272 26887f9a-b1ab-45d7-95bb-c0b30d3c79c6 \
  d5a3bb2e-a551-4825-bab8-b342eaa8f4cb dbb9d06a-cf0e-4440-b9f6-391ebbaaca79 \
  1eabfbd5-d495-49aa-a9a5-e23b1da1f625 887b65a0-4151-4016-8e08-9b2a6ce87b4b \
  6fe1c742-0843-474c-8601-bb1554d097ff d69f7e1e-fbbd-4ebe-832d-44da5c2549d9 \
  d064bddd-2214-4e67-a933-a0a229d600c7 0e32cb9e-83b7-459f-ad6b-b3b171ec57dc \
  8def8b88-e286-46f6-8baf-db14fdff8f07 2ff244f6-30fa-4ccc-aa85-755e97aaa2e3 \
  cd899aaa-25c5-48ea-af89-d5faaf848605 648a9447-5cd3-4d14-af1c-2741d7d89e56 \
  e15ad1fc-88aa-4d67-977e-611d8c2aa2f4 91709378-f903-4525-ba02-84e25e3df157; do
  patch_git_secret "$SID"
done
GIT_OK=$((UPDATED - API_OK))

if [ "$FAILED" = 0 ]; then
  log "Tokens refreshed (shader-slang; $API): $API_OK/6 api secrets, $GIT_OK/16 git secrets"
  exit 0
fi
log "ERROR: token refresh incomplete (shader-slang; $API): $API_OK/6 api secrets, $GIT_OK/16 git secrets, $FAILED failed"
exit 1
