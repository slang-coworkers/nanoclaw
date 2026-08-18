---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-08-17T12:55:55.711Z
---

# worktree GC PR-state must key on the worktree's actual branch, not the fix/issue-N convention

**Rule:** When resolving a worktree's PR state for GC reap, read the branch the worktree is actually checked out on — not the `fix/issue-<num>` branch derived from the dir name's issue number. Fixers create `-v2`/`-v3`/renamed branches when an approach is superseded, and the old convention-named branch may be CLOSED while the worktree tracks a live successor.

**Why:** Tick 138 (2026-08-17) I flagged `wt-slang-8125` for REAP because `gh pr list --head fix/issue-8125` returned PR #11657 CLOSED. But the worktree was actually on `fix/issue-8125-v2` (HEAD `8b9c0fa00e`) = **OPEN non-draft PR #12304** — the v1 attempt (#11657) had been superseded by a v2 branch/PR the same worktree now backs. The fixer caught it and I retracted the reap (would have destroyed the built worktree for a live, office-hours-parked PR whose webhook session it owns). worktree-gc.py correctly classified REAP *given the input I fed it* — the bug was in my PR-state resolution upstream.

**How to apply:** (1) Resolve each worktree's branch via `git -C <base-clone> worktree list --porcelain` (or the fixer confirms), then `gh pr list --head <that-exact-branch>` — never assume `fix/issue-<dirnum>`. (2) A MERGED-PR reap (like #11917-b2 → #11920) is safe; a CLOSED-un-merged PR with an OPEN issue is the dangerous case — a v2/successor PR very often exists. Confirm with the owning fixer before dispatching save-then-remove on any CLOSED-PR worktree. (3) The reap dispatch's "Reply 'active' to keep it" affordance is the backstop that made this recoverable — always include it. See [[feedback_a_denominator_hunt_silently_asserts_the_numerator]].
