---
name: feedback_gc_resolve_slice_worktree_head_not_issue
description: "Worktree GC false-REAPs slice worktrees — resolve HEAD→PR, not issue#→fix/issue-<num> branch"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: fffae428-9bad-49a0-b2f6-8691d1e9b711
---

Supervisor worktree GC must resolve a slice worktree's **real HEAD commit → its PR**, NOT `issue#` → the `fix/issue-<num>` branch convention.

**Why:** slice worktrees carry suffixed branches (`fix/issue-11917-asafe-c`, `-matrix`, `-p2`) that map to *different* open PRs than the plain `fix/issue-<num>` branch. The plain branch usually resolves to an already-MERGED older slice, so the GC classifier flags the live worktree REAP — destroying unmerged slice work + any foreign stashes it holds. This false-positive has fired **two ticks running**: tick 85 `wt-slang-11917-matrix` (real PR #11987, not merged #11920) and tick 86 `wt-slang-11917-c` (real branch `fix/issue-11917-asafe-c` HEAD 34f450bea1 = PR #12088 OPEN/APPROVED, not merged #11920). Both held stashes from other branches (`adopt/issue-10788`, `fix/issue-11532`).

**How to apply:** for any worktree whose dir name has a suffix beyond the bare number (`-c`, `-matrix`, `-p2`, `-rebase`, `-slices`), treat the issue#→branch resolution as unreliable. Always dispatch a **gated confirm-reap to the owning fixer** (never blind `git worktree remove` — the gitdir lives in their container, invisible from the read-only mount). The fixer self-reaps on the slice PR's `pr_merged` webhook. See [[project_11917_pass_gating_epic]].

**Tick 94 (2026-07-20) — the false-reap also fires on PLAIN `fix/issue-<n>` branches, not just suffixed slices.** GC reap criterion = **issue CLOSED → reap** over-fires when a *different* PR closes the issue while OUR PR on `fix/issue-<n>` is still OPEN/in-review. Two live cases this tick, both caught by the fixer's gated pushback (dispatch was correct — never blind-removed):
- `wt-slang-11664`: issue #11664 CLOSED-COMPLETED by unrelated #11775, but PR **#11665** (head `fix/issue-11664`@8c3a3ee191) was OPEN/non-draft/REVIEW_REQUIRED — an Option-2 rework skiminki-nv requested 07-17. Reap would've forced a 15-25min rebuild next review round. **Cancelled, KEEP until #11665 closes.**
- `wt-slang-11474`: reaped OK, but issue #11474 CLOSED-COMPLETED 06-30 by a maintainer with **NO closing PR**, while PR **#11476** (head `fix/issue-11474`, live draft, tracked chain) stays OPEN. Branch correctly preserved; not a superseded-PR postmortem (no rival PR merged — `closedByPullRequestsReferences` empty).

**Durable rule:** before ANY reap dispatch, resolve the worktree's `fix/issue-<n>` branch → its open PR via `gh pr list --head fix/issue-<n> --state open`. **If an OPEN PR sits on that branch, do NOT reap** (build tree needed for the review round) regardless of issue state. Issue-CLOSED alone is insufficient — an issue can be closed by a maintainer or a sibling PR while our fix PR is still in review. The gated-confirm-to-fixer dispatch is the safety net that makes this recoverable, but pre-checking the head-PR avoids the wasteful round-trip.
