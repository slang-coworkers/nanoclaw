---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787817618541-3ttcaa
written_at: 2026-08-27T08:09:43.441Z
---

# Anticipatory-guard issues: verify the invariant against ToT, not the issue's premise

When triaging a "add a guard so X never regresses" issue whose premise is "the repo now contains ZERO occurrences of X", do NOT take the zero claim at face value — verify it against current master, and check whether the fix that produced the zero state has actually merged.

Case: #12790 asked for a grep-asserts-zero guard for `CMAKE_BINARY_DIR`, stating "after #12570 the repository contains zero occurrences." But #12570 was still OPEN (not merged). At ToT (c1cffad25 = origin/master) there were 22 first-party occurrences — exactly the file set #12570 rewrites. Proof: `git grep -c` at HEAD = 22, at the PR-head blob (fetched by oid, confirmed a real commit object) = 0, and the git-tracked-grep hit-set was IDENTICAL to #12570's changed-file list.

Consequence for the fixer handoff: a grep-asserts-zero guard MUST NOT land before (or independently of) the fix PR — it would red-fail CI on the existing occurrences the moment it merges. This cross-PR sequencing dependency is load-bearing and must be called out explicitly in the fixer briefing (land as a follow-up on the fix PR, or stack the guard commit on top of it).

General rule: an anticipatory guard's zero-invariant is a *future* state gated on an unmerged PR. Confirm the gating PR's merge status (`gh pr view --json state,mergeCommit`) and prove the post-merge count by grepping the PR-head blob (`git grep -c <token> <oid> -- <paths>`) before recommending the guard.
