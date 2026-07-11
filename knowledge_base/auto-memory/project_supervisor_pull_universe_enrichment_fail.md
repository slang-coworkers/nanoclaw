---
name: project_supervisor_pull_universe_enrichment_fail
description: supervise-issues pull-universe per-chain enrichment can silently fail — verify before trusting scan.py nudge flags
metadata: 
  node_type: memory
  type: project
  originSessionId: fc0067db-fabb-4b9a-bd71-dd1e80052ad2
---

Tick 80 (2026-07-10): `scripts/pull-universe.sh` returned all 294 chains but its per-chain **enrichment** silently failed — only **1/137 open chains** got PR data, 3/137 got comments (`pr:null`, `comments:[]` everywhere). Root cause: the batched graphql fallback erroring `gh: Could not resolve to an Issue with the number of N` (it feeds PR numbers / cross-repo numbers into an issue-batch query). `issue_open` and `our_last_outbound` were still populated correctly.

**Consequence:** `scan.py` saw no comments → classified 133 chains as `silent` and flagged **134 needs_nudge / 125 escalate**. These were ALL false positives from missing data. Firing them would have been the exact documented over-nudge failure.

**How to detect:** after the pull, run `python3 -c "import json;c=json.load(open('universe-raw.json'))['chains'];print(sum(1 for x in c.values() if x.get('issue_open')), sum(1 for x in c.values() if x.get('pr')))"`. If `has_pr` ≪ `open`, enrichment failed.

**Recovery (works — `gh` itself is healthy):** re-enrich the open set directly with parallel `gh issue view --json comments,labels` (ball direction = last-comment author vs BOTS) + `gh pr list --head fix/issue-<n>` (PR) + `gh run list --branch fix/issue-<n> --workflow ci.yml` (CI). ~137 chains in <2min at 12 workers. Scripts left in `/workspace/agent/memory/{enrich,ci,classify,build_board}.py`.

**Rule:** never fire scan.py nudge/escalate flags without first confirming enrichment populated PR+comment data. Related: [[feedback_verify_regression_claims_at_precision]], defend-parks discipline.

**FIX INBOUND (2026-07-10): slang-coworkers/nanoclaw#886** — bot PR `fix(supervise-issues): partial-tolerant PR enrichment` (branch `fix/nv-main/pull-universe-partial-salvage` → `nv-main`), reviewed inline clean, 25/25 tests green locally at head `66a3ad9`. Fixes exactly this: `gh_graphql()` salvages partial-success (data + errors[], rc≠0) instead of discarding the batch; resolver `issue()` → `issueOrPullRequest()` so PR-keyed chains stop 404-poisoning batches (their own PR → `self_pr`). Merge is maintainer's (`nv-main` upstream-tracked). **Until #886 merges + this container picks up the new skill, the detect-and-recover discipline above still applies.** See [[project_nanoclaw_pr874_webhook_route_approver]] #886 entry.
