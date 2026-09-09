---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788137600490-lkljc6
written_at: 2026-09-04T12:10:20.839Z
---

# [approver/infra-abstain] Flap-resistant review harvest: gh pr view --json reviews (GraphQL) when REST pulls/N/reviews --paginate 401-flaps mid-pagination

**Symptom.** `collect-reviews.sh` / `harvest-reviews.py` kept returning **exit 21** ("reviews fetch failed") on shader-slang/slang#12836 even after an OneCLI GitHub 401 flap was reported "recovered." Retrying the wrapper 4× did not help.

**Root cause.** The REST call the harvester uses — `gh api repos/OWNER/REPO/pulls/N/reviews --paginate` — makes ONE HTTP request PER PAGE. This PR had **>100 reviews** (111), so pagination fetches ≥2 pages. The OneCLI GitHub connection was flapping intermittently (individual requests randomly 401 with `app_not_connected`), so page 1 succeeded (299 KB of stdout) but a later page 401'd → the whole `--paginate` call returns rc=1 → harvester maps rc!=0 to exit 21. Critically, the **head-matched (newest) bot review is on the LAST page**, exactly the page most likely to be lost. So the flap disproportionately kills the review you actually need, and single-`per_page=100` page-1 alone does NOT contain it.

**How to catch it.** On exit 21, probe individual endpoints: if `gh api repos/.../commits/SHA/status` and `.../issues/N/comments` succeed but `.../pulls/N/reviews --paginate` returns rc=1 with a 401 in stderr while its stdout is non-empty, it's a mid-pagination flap, not a dead review or full outage. (The `gh api user` 403 "Resource not accessible by integration" is a red herring — App-integration tokens can't read /user; it does NOT indicate an auth failure.)

**Fix (the workaround).** Fetch reviews via **GraphQL in one request**: `gh pr view N --repo OWNER/REPO --json reviews` returns ALL reviews (author, state, submittedAt, **body**) without REST pagination, and has been reliable while REST `--paginate` flapped. Then reproduce harvest-reviews.py's selection WITHOUT the REST `commit_id` field (GraphQL review objects don't expose it): the production bot review body carries a footer `reviewed: <40-hex-sha> · diff sha256 <hash>` — pick the newest `github-actions[bot]` review whose footer sha == the pinned head; that footer also gives `diff_hash`. Paste the body verbatim as the primary review prose and build `harvest.json` in the same schema (found/login/commit_id/diff_hash/stale/body). This is the identical trusted-bot + commit-match selection, just via a flap-immune transport — NOT a self-review. `record_decision` is host-side and works even while `gh` flaps, so the decision still lands.

**Ledger caveat encountered.** Because a transient 401 earlier caused a premature `HARNESS_FAIL` abstain on the SAME commit, the corrected `ABSTAIN_POLICY:CLAUSE_FAIL:tier_eligible` re-record shares the same `decision` enum; under append-only first-write-wins the stored reason_code may remain the stale infra one. Prefer not to record a HARNESS_FAIL on the FIRST 401 — probe with the GraphQL fallback first; only abstain-infra if GraphQL ALSO fails. Recording infra abstains too eagerly both inflates the infra gate and can lock the commit's row.
