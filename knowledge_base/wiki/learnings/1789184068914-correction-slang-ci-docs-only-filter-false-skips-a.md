---
title: "CORRECTION: Slang CI docs-only-filter false-skips a MERGE-COMMIT head (not a draft-gating issue)"
type: learning
topic: slang-compiler
source: learnings/1789184068914-correction-slang-ci-docs-only-filter-false-skips-a.md
superseded_by: 1789184828074-precise-mechanism-slang-docs-only-filter-false-ski
---

# CORRECTION: Slang CI docs-only-filter false-skips a MERGE-COMMIT head (not a draft-gating issue)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787274270223-isexye
written_at: 2026-09-12T03:34:28.914Z
---

# CORRECTION: Slang CI docs-only-filter false-skips a MERGE-COMMIT head (not a draft-gating issue)

Supersedes my earlier learning "manual ci.yml workflow_dispatch skips the whole matrix on a DRAFT PR" — that diagnosis was WRONG. Verified from the actual `filter` job log of run 34669196010.

What actually happens on shader-slang/slang: the `filter` job in `.github/workflows/ci.yml` runs on `workflow_dispatch` regardless of draft status (its `if` only excludes draft *pull_request* events, ci.yml:15). It computes changed files via `git diff --name-only "$BASE...HEAD"` where for non-pull_request `BASE=HEAD^1`, on a `fetch-depth: 2` checkout. When HEAD is a **merge commit** (e.g. you `git merge origin/master` into your PR branch to refresh it), `HEAD^1...HEAD` on that shallow checkout yields an empty / non-representative file list, so the `docs-only-filter` action classifies it as documentation-only and sets `should-run=false` → the ENTIRE build/test matrix is SKIPPED. The run then reports overall `success` (check-ci aggregates skipped-as-ok) = a **false green**.

Consequences / how to actually get real CI:
- Do NOT trust a green `workflow_dispatch` CI run whose head is a merge commit — inspect the `filter` job; if it says "Only documentation files changed, skipping", the matrix never ran.
- A normal (non-merge) commit on top makes `HEAD^1...HEAD` = your real changed files → the matrix runs. So to refresh a stale branch and still get manual CI, prefer a rebase (single-parent head) over a merge, OR push a subsequent normal commit.
- The `pull_request` path is unaffected: it diffs `origin/master...HEAD` (fetches BASE_REF), so marking the PR ready-for-review runs real CI even with a merge-commit head.
- Draft status is still relevant for the *pull_request* trigger (drafts get no pull_request CI), but it does NOT gate workflow_dispatch. The real unblock to enter the review/merge queue is still an operator marking the PR ready (bot never self-promotes).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789184068914-correction-slang-ci-docs-only-filter-false-skips-a.md`_
