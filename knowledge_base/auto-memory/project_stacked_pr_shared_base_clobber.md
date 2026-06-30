---
name: Stacked-PR shared-base clobber (cross-chain de-confliction)
description: When a decomposition uses stacked PRs (fix/issue-B based on fix/issue-A), a stale checkout of the dependent chain can force-push the shared base back to stale state, silently reverting the base chain's rebase
type: project
originSessionId: 338b3b51-7e24-4538-a007-76254ea47d63
---
When a #-decomposition is implemented as **stacked PRs** — PR-B (later slice, branch `fix/issue-B`) has `base = fix/issue-A` (earlier slice's branch) — the shared base branch `fix/issue-A` is a cross-chain clobber hazard. If the dependent (Slice-B) chain pushes from a **stale checkout** where `fix/issue-A` still points at an old commit, it force-pushes `fix/issue-A` back to that stale state, silently reverting the Slice-A chain's later rebase.

**Detection signature (verify all at HEAD before concluding):**
- Base PR-A suddenly `BEHIND` master (e.g. `gh api .../compare/master...fix/issue-A` shows high `behind_by`, `diverged`).
- The dependent PR-B was `updated` at the *same timestamp* as the force-push to `fix/issue-A`, and PR-B's `base == fix/issue-A`.
- The pushed commits all **predate** the base chain's last known good push (no fresh commits dated at the collision time) → an accidental stale re-push, not an intentional combine. No "combine" announcement / PR comment.

**De-confliction stance (incident: slang #11591 Slice-2 vs #11596 Slice-3, 2026-06-22):**
- **Do NOT force-push the base back** to the Slice-A state — it just reverse-clobbers PR-B's base = a force-push war. As long as ONE side holds, there is no war and the branch is stable; both PRs draft + ready/merge gated means no merge risk and no urgency.
- **Don't unilaterally pick the resolution** if it depends on a pending design/decomposition decision (here jkwak's separate-stacked-PRs vs. one-combined-PR call). Whatever structure is chosen, rebase onto **current master**, not the stale base.
- **Make GitHub honest** so a maintainer landing on the stale base isn't misled: edit-in-place the live decision-request comment with a factual base-collision note (branch paused, rebase pending the decision).
- **Reaching the dependent chain may be impossible:** if a thread-routed message to the coworker (e.g. `slang-triager` on `gh-issue-…-B`) lands in the *other* chain's session, that mis-route means there is **no live distinct Slice-B session** — the push came from a stale/idled source (idled session checkout, leftover worktree, or a phantom re-run per project_fork_reentrancy_phantom_codriver), not a puppet-able chain. Don't keep trying to route to a non-existent session; freeze the holding side, flag the unidentified source to the operator, and re-verify branch state when the design decision triggers the coordinated rebase.

**PREVENTION — modifying the shared base (`fix/issue-A`) while PR-B is stacked on it (clean technique, slang #11792↔#11799 re-pin, 2026-06-29):** when you must change the base branch (e.g. a submodule re-pin) and a stacked PR-B has `base = fix/issue-A`, **append a fast-forward commit and `git push` (no force, no rebase).** A fast-forward only advances `fix/issue-A`'s tip → PR-B's base moves forward, PR-B's own branch is never force-pushed/rewritten, and `mergeable_state` stays `clean`. Do **NOT** rebase `fix/issue-A` onto master to clear a `BEHIND` state — rebase rewrites history → force-push → clobbers PR-B's base (the exact failure mode above). Leave `BEHIND` for the **maintainer's "Update branch" / merge-queue**, which is benign for a squash-merge. Verify post-push: base PR-B tip SHA unchanged + `mergeable_state:clean`. Sequence the stacked PR-B's own rebase-onto-master only **after** the base PR-A merges.
