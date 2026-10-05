#!/usr/bin/env bash
# Stop hook: the turn does not end while a PR this session created or pushed to
# has a description that explains an older head (or nothing).
#
# The PR's explanation comment is the /explain-diff-html explanation of its current
# head. pr-auto-map.sh only REMINDS after a create or a push, and a reminder was
# followed on 4 of the fixer's last 8 PRs; the operator requirement is that the
# description is refreshed on every push. So at Stop, if any PR owes a refresh
# (lib/explain-diff-owed.sh), block once with the reason. `stop_hook_active` is
# true when the agent is already continuing because of a Stop hook, so the
# block fires at most once per stop and can never loop the session.
#
# Active only where the critique gate is (CRITIQUE_GATE_ACTIVE=1, else the
# .overlay-critique-gate marker). EXPLAIN_DIFF_GATE=0 disables.
#
# Stdin: Stop hook JSON ({stop_hook_active, ...}). Stdout: {"decision":"block",
# "reason":…} to keep the agent working; nothing (exit 0) to let it stop.
set -euo pipefail

# shellcheck source=lib/explain-diff-owed.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib/explain-diff-owed.sh"

explain_diff_gate_active || exit 0

INPUT=$(cat)
ACTIVE=$(jq -r '.stop_hook_active // false' <<< "$INPUT" 2>/dev/null || echo false)
[ "$ACTIVE" = "true" ] && exit 0

OWED=$(explain_diff_owed_lines)
[ -z "$OWED" ] && exit 0

jq -nc --arg owed "$OWED" '{
  decision: "block",
  reason: ("Explanation comment is stale: " + ($owed | split("\n") | map(select(length > 0)) | join("; and ")) + ". Run /explain-diff-html for the new head (upsert_pr_body.py --repo <owner/repo> --pr <n> --head <sha> --explanation <file>) before ending the turn — every push must leave the explanation comment explaining the pushed head. For a push that changes nothing a reader would notice, re-run upsert_pr_body.py on the new head with the previous explanation.")
}'
exit 0
