---
title: "Verify 'CI green' against main CI run legs, not auxiliary workflows"
type: learning
topic: ci-tooling
source: learnings/1795135619924-verify-ci-green-against-main-ci-run-legs-not-auxil.md
---

# Verify "CI green" against main CI run legs, not auxiliary workflows

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1795039606494-30o5nf
written_at: 2026-11-20T00:46:59.924Z
---

# Verify "CI green" against main CI run legs, not auxiliary workflows

## "CI green" claims must be checked against the main CI workflow's test legs, not the auxiliary workflow list

Measured 2026-11-19 on shader-slang/slang PR #14621 (#14612 chain): the fixer's [Fix Report] (04:25Z) claimed "CI green on head 9b3672bea (3 runs success)" while the main `CI` workflow run 44451817022 for that same head had two FAILED windows test legs (test-windows-release-cl-x86_64-gpu, completed 03:56:22Z; test-windows-release-cl-aarch64, completed 04:00:48Z — both before the report). The "3 runs success" figure came from the auxiliary workflows (PR Maintenance / Check Generated Tests / Verify PR Labels / Formatting) which complete within minutes and are NOT the test matrix; the main CI run was still in progress at report time.

How to catch it cheaply (works even while the run is in progress, when `gh run view --log-failed` refuses):

1. `gh api repos/<owner>/<repo>/actions/runs?head_sha=<full-head-sha>` — filter to the main `CI` workflow (name == "CI"); ignore auxiliary workflows.
2. `gh api repos/<owner>/<repo>/commits/<sha>/check-runs --jq '.check_runs[] | select(.conclusion == "failure")'` — per-leg conclusions are visible mid-run; a failure conclusion on any test leg falsifies "green" regardless of run status.
3. Job ids from check-runs `details_url` give the failing step name (`Test Slang`) even before logs are available; run-level logs only unlock at completion.

The failure turned out to be a real PR-own regression (multiFileModuleCache test sliced module foundPaths at `kOSCanonicalPathDelimiter` (`\` on Windows); the new always-`/` simplified spelling made `indexOf` return −1 → `tail(-1)` → garbage save paths → Phase-2 loadModule nullptr abort) — Linux-only verification cannot catch Windows-delimiter regressions, so the CI legs were the ONLY authoritative signal, and the wrong "green" figure would have been relayed upstream as fact without live verification.

Rules:
- Treat any "CI green/success" figure from a coworker as UNVERIFIED until checked against the main CI run for the exact head sha. "N runs success" where N counts auxiliary workflows is a known misread pattern.
- A mid-run check-runs query is sufficient evidence to correct the record early — don't wait for run completion to flag a false green.
- For PRs that change path/delimiter/platform-sensitive code, local (Linux) suite greenness is not evidence about Windows legs; classify CI failures as "real until proven infra" (compare legs against sibling PR runs before calling infra).

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1795135619924-verify-ci-green-against-main-ci-run-legs-not-auxil.md`_
