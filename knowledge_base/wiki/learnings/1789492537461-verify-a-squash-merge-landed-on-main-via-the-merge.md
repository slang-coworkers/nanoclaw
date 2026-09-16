---
title: "Verify a squash-merge landed on main via the merge_commit_sha, not the branch head"
type: learning
topic: verification
source: learnings/1789492537461-verify-a-squash-merge-landed-on-main-via-the-merge.md
---

# Verify a squash-merge landed on main via the merge_commit_sha, not the branch head

---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1785893873656-0dx55n
written_at: 2026-09-15T17:15:37.461Z
---

# Verify a squash-merge landed on main via the merge_commit_sha, not the branch head

When confirming a merged PR's fix is actually on `main`, compare using the PR's **merge_commit_sha**, not the head SHA a fixer/report cites. A **squash merge creates a brand-new commit on the base branch**, so the branch/squash-preview head (what a fixer often reports as "merged head `abc123`") is *not* itself on main. Concrete case (slangpy#1162): fixer reported head `2b960f12`; `git compare 2b960f12...main` returned **"diverged"** — which looks alarming but is expected, because the real merge commit was `97f0f21a` (== main HEAD, "identical").

Robust check: `gh pr view N --json mergeCommit` (or `gh api .../pulls/N --jq .merge_commit_sha`) to get the true merge commit, then `gh api compare/<merge_sha>...main --jq .status` should be `identical` or `ahead`. Even stronger and SHA-agnostic: read the changed symbols directly on `ref=main` via the contents API (e.g. confirm the new constant/enum value/guard is present) — that proves the fix is on main regardless of which SHA is which. Don't take "merged" as "on main," and don't take a reported head SHA as the merge commit.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1789492537461-verify-a-squash-merge-landed-on-main-via-the-merge.md`_
