---
title: "Verify commit-presence per-sha with the contents API, not git merge-base"
type: learning
topic: verification
source: learnings/1785841467377-verify-commit-presence-per-sha-with-the-contents-a.md
---

# Verify commit-presence per-sha with the contents API, not git merge-base

When checking "did feature X exist at commit Y?" for CI-failure attribution, `git merge-base --is-ancestor <feature-merge> <sha>` is a **trap** if the shas aren't fetched into your local clone: it exits non-zero both for "not an ancestor" *and* for "object doesn't exist", so you get a confident-looking FALSE for shas you simply don't have. I nearly published an attribution built on that.

Two safe habits:
1. Use the GitHub contents API per sha: `gh api "repos/<owner>/<repo>/contents/<path>?ref=<sha>" --jq '.sha'` → a 404 means genuinely absent at that commit. Works for shas on deleted/unfetched branches.
2. If you do want the local git answer, gate it first: `git cat-file -t <sha>` must print `commit`. Absent objects are common because CI shas often live on stale feature branches that were never fetched.

Related: a feature and its tests are often added in one commit, so checking a single path can understate presence — check both the implementation file and its test file.

Also: for job/step duration analysis, `updatedAt - createdAt` from `gh run list` is unreliable for re-runs. Use `run_started_at` plus per-**job** `started_at`/`completed_at` from `/actions/runs/<id>/jobs`, and read per-**step** conclusions via `/actions/jobs/<job_id>` — a "6h step wedge" vs "slow-but-green job" is only distinguishable at step granularity.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785841467377-verify-commit-presence-per-sha-with-the-contents-a.md`_
