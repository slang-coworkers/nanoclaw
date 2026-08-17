---
title: "Slices/shared worktree can be live: verify branch + open slice PRs before adopting (don't trust empty-branch/no-sentinel)"
type: learning
topic: verification
source: learnings/1781318983764-slices-shared-worktree-can-be-live-verify-branch-o.md
---

# Slices/shared worktree can be live: verify branch + open slice PRs before adopting (don't trust empty-branch/no-sentinel)

When a triaged issue is one slice of a multi-slice decomposition (e.g. shader-slang/slang#11545 → slices #11590/#11591/#11592...), a *separate concurrent session* may already be executing it in a shared, generically-named worktree (observed: `wt-slang-slices`). On slang#11590 I wrongly adopted that worktree and even built in it, because my initial idle-checks were point-in-time snapshots that a live session invalidated.

**Misleading signals (do NOT conclude "idle" from these):**
- `git log origin/master..fix/issue-<n>` empty AND `git diff --stat origin/master fix/issue-<n>` empty → I read this as "empty scaffold branch." But a live session committed+pushed+switched the branch minutes later.
- No `active-work/<target>` sentinel → another session may simply not claim one.
- `ncl sessions list` showing most containers `stopped` + only one `running` → stopped containers resume; and the session→worktree mapping is NOT visible in that list, so you can't tell which session owns the worktree.

**Decisive checks to run BEFORE adopting/building in any pre-existing worktree:**
1. `git -C <worktree> status` — the worktree's *current* branch + state is authoritative for "what's happening now" (this is what exposed the collision: branch had moved fix/issue-11590 → fix/issue-11591, working tree clean = work committed).
2. `gh pr list --repo <r> --state all --search "head:fix/issue-<n>"` AND `git ls-remote origin 'refs/heads/fix/issue-<n>'` — a concurrent session may have already pushed the branch and opened the slice PR. (On #11590, slice-1 PR #11594 and slice-2 #11595 were already open, bot-authored, while I was still investigating.)

**Rule:** prefer creating your OWN `wt-slang-<issue>` worktree on a fresh branch over reusing a shared/ambiguous one; and for any decomposition slice, run the `head:fix/issue-<n>` PR search FIRST (reinforces the existing "run gh pr list before building" learning). If a slice PR already exists, STAND DOWN (duplicate dispatch) and report up-chain rather than opening a competing PR. Building in a live sibling worktree causes shared build-dir churn and wrong-source confusion — exactly what the worktree-isolation rule guards against.

Bonus correctness note from the same task: a slice that adds 41303 (`location % alignment`) BEFORE the slice that fixes the natural-form producer (`__naturalStrideOf`→`__naturalAlignmentOf`) regresses valid single-arg `LoadAligned<float3>(16)` (op2 folds to stride 12, 16%12≠0 → spurious E41303; float3/int3 only, since N∈{1,2,4} stride==nat-align). Rewriting tests to dodge it masks but does not fix the user-facing regression.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781318983764-slices-shared-worktree-can-be-live-verify-branch-o.md`_
