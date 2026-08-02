---
title: "gh pr checks phantom-greens the CI sweep when GraphQL is 401 but REST is healthy"
type: learning
topic: ci-tooling
source: learnings/1785586525718-gh-pr-checks-phantom-greens-the-ci-sweep-when-grap.md
---

# gh pr checks phantom-greens the CI sweep when GraphQL is 401 but REST is healthy

**Signature (observed 2026-08-01 12:00Z on Slang CI babysitter):** GitHub GraphQL returns `401 Bad credentials` while REST is fully healthy — including Actions-write. Tell-tales: `gh auth status` = token invalid, `gh api rate_limit` = OneCLI `app_not_connected` 401 with a connect URL, YET `gh api repos/<o>/<r>/pulls/<n>`, `commits/<sha>/check-runs`, `commits/<sha>/statuses`, and `actions/runs/<id>` all return real data, and `gh run rerun --failed` works (verified: a rerun reached `run_attempt=3`).

**The trap:** `gh pr checks` (the documented step-1 tool for a CI sweep) is GraphQL-backed. When GraphQL 401s and you swallow stderr (`2>/dev/null`, or grep on a merged stream), every PR reads as "no failures" — a **phantom all-green sweep**. I got a clean 20/20 twice before catching it. Silence looked exactly like health.

**Defense — cross-verify the whole sweep via REST, never trust `gh pr checks` alone when GraphQL is flaky:**
```bash
sha=$(gh api repos/<o>/<r>/pulls/$pr --jq '.head.sha')
gh api "repos/<o>/<r>/commits/$sha/check-runs?per_page=100" --paginate \
 | jq -s '[.[]|.check_runs[]?]|[.[]|select(.conclusion=="failure" or .conclusion=="cancelled" or .conclusion=="timed_out" or .conclusion=="startup_failure")]|group_by(.name)|map(.[0])'
gh api "repos/<o>/<r>/commits/$sha/statuses?per_page=100" \
 | jq '[.[]|select(.state=="failure" or .state=="error")]|group_by(.context)|map(.[0])'
```
Notes: (1) `--paginate` concatenates JSON objects, so use `jq -s '[.[]|.check_runs[]?]'` (slurp + optional `?`), not a bare `.check_runs[]`, or jq dies on page 2. (2) Some required gates (merge-queue aggregators, cross-repo checks like SlangPy Tests) are commit **statuses**, not check-runs — check both. (3) The wake payload's `evicted` list may itself be GraphQL-derived → cross-check merge-group evictions via REST `actions/runs?event=merge_group&per_page=50` filtered by `created_at`.

**Posture:** because REST reads AND reruns work, do NOT hold read-only for this facet — classify and rerun normally, just route head-checks through REST. This is distinct from a full actions:write outage (where `gh run rerun` returns 403 "Must have admin rights").

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785586525718-gh-pr-checks-phantom-greens-the-ci-sweep-when-grap.md`_
