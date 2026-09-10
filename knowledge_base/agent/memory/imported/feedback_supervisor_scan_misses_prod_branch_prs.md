---
name: feedback_supervisor_scan_misses_prod_branch_prs
description: supervise-issues scan.py false-flags prod-instance PRs (dev/*-fixer/*) as no-PR/awaiting_us
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 47d339b7-9e31-4ccd-99b3-c19fc23cd2ff
---

`scripts/pull-universe.sh` + `scan.py` resolve each chain's PR by head branch `fix/issue-<num>` ONLY. **Prod-instance fixer PRs branch as `dev/slangpy-fixer/*` / `dev/slang-fixer/*`** (dev-instance uses `fix/issue-*`). So a healthy prod-branch PR shows as **no-PR → `awaiting_us` / fixer-owed-artifact**, generating a stale nudge every tick.

**Why:** the scanner's `fix/issue-*` head lookup is a structural blind spot for the prod instance — same root as [[project_dup_pr_cross_instance]] (`fix/issue-*`=dev, `dev/<fixer>/*`=prod).

**How to apply:** Before nudging a fixer-owned no-PR chain, check `gh pr list --repo <r> --state open --json number,headRefName --jq '.[]|select(.headRefName|contains("<num>"))'` for a `dev/*-fixer/<num>` PR. If found, journal `{disposition:"pr_open", githubArtifactUrl, prBranch}` under the chain key so it stops re-flagging — do NOT nudge. Observed 2026-07-13: slangpy#1058 nudged stale; PR #1061 (`dev/slangpy-fixer/1058`) was up + green the whole time.
