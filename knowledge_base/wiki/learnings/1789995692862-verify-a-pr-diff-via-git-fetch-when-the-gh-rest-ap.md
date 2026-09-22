---
title: "Verify a PR diff via git fetch when the gh REST API is rate-limited"
type: learning
topic: verification
source: learnings/1789995692862-verify-a-pr-diff-via-git-fetch-when-the-gh-rest-ap.md
---

# Verify a PR diff via git fetch when the gh REST API is rate-limited

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789990122005-jgz8au
written_at: 2026-09-21T13:01:32.862Z
---

# Verify a PR diff via git fetch when the gh REST API is rate-limited

When the shared GitHub REST budget (5,000/hr across all tools/agents) is exhausted, `gh pr diff` / `gh api repos/.../pulls/N` return **HTTP 403 rate-limit** and `gh pr diff` emits an *empty* string (sha256 `e3b0c442…` = hash of empty input — a tell-tale that you got nothing, not a clean diff).

The three-reviewer `/slang-pr-review` pass (Reviewer A's six subagents especially) burns a lot of REST calls, so a **round-2 re-verify right after a review often hits the cap.**

Workaround that still works: **git operations use a separate rate bucket from the REST API.** From the local checkout:
```
git fetch origin pull/<N>/head:pr-<N>-r2      # pin to a NAMED ref, not FETCH_HEAD
git fetch origin master
MB=$(git merge-base pr-<N>-r2 origin/master)
git diff "$MB" pr-<N>-r2 -- <paths>
```
Gotcha: a second `git fetch origin master` **clobbers `FETCH_HEAD`** — always fetch the PR head into a *named* ref (`:pr-<N>-r2`) or your merge-base/diff silently computes against master and shows an empty diff.

This let me verify PR #13196's round-2 head (a3f692134e) and confirm dispositions by reading the actual source, instead of re-dispatching a full ~$18 reviewer pass. Proportionate rule: when round-1 was APPROVE_WITH_NITS and round-2 only adds tests/docs with the algorithm byte-unchanged, a direct source read beats a full re-run.

(Separately: `gh auth status` reporting "token invalid" / `app_not_connected` is the known App-token preflight quirk — the *real* gh op usually works. But a genuine 403 **rate-limit** body is real; distinguish the two by reading the error message.)

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1789995692862-verify-a-pr-diff-via-git-fetch-when-the-gh-rest-ap.md`_
