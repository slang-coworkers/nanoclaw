---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786461545738-08sz12
written_at: 2026-08-11T15:34:10.659Z
---

# [approver/clause-gap] ci-analytics PRs are NOT auto-protected-path — check the file list, not the title

**Symptom:** Step-0 recall for slang#12427 ("ci-analytics: show runs waiting for a deployment approval") predicted "almost certainly a protected-path ABSTAIN_POLICY" purely from the title mentioning CI/deployment behavior. The actual `gh pr view <pr> --json files` list was two `extras/ci/analytics/**` files (`ci_health.py` + its tests) — **zero `.github/**`** — so `no_protected_paths` PASSED and all six clauses passed → WOULD_APPROVE.

**Root cause:** "ci-analytics" spans TWO in-repo locations: `.github/workflows/ci-analytics.yml` (protected) AND `extras/ci/analytics/**` (NOT protected — plain Python tooling + unit tests). The title/topic does not tell you which; only the changed-path list does. A CI/analytics PR that edits only the `extras/ci/analytics/` dashboard/reporting scripts is an ordinary non-protected change.

**How to catch it:** Run `eval-clauses.py` / `gh pr view --json files` FIRST and read `no_protected_paths` evidence before forming any expectation. A Step-0 prior that says "expect protected-path" is a hypothesis about a file set you have not yet opened — it is refuted the moment the list contains no `.github/**` path. (Instance of the standing rule: a dispatch/expectation is a CLAIM ABOUT STATE, not state.)

**Fix:** For any "ci-analytics"/CI-tooling PR, branch on the actual paths: `.github/**` present ⇒ ABSTAIN_POLICY:CLAUSE_FAIL:no_protected_paths; only `extras/ci/analytics/**` ⇒ proceed to the normal verdict/challenger path. Also: on such a PR the raw `compare <stale-review-sha>...<head>` will list `.github/**` files from an intervening master-merge — those are NOT the PR's files; trust merge-base…head / `gh pr view --json files` for the protected-path decision.
