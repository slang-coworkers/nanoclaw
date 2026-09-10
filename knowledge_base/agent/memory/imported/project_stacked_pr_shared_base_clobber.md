---
name: Stacked-PR shared-base clobber (cross-chain de-confliction)
description: "Stacked-PR hazards: a stale dependent checkout can clobber the shared base; and when the base squash-merges the dependent goes CONFLICTING from TWO causes — redundant commits AND a stale base (measure the net diff, not just the commit list)"
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

## AFTER the base PR merges as a SQUASH — the dependent PR goes `CONFLICTING` (slangpy #1078→#1080, 2026-08-05)

When base PR-A **squash-merges**, the dependent stacked PR-B breaks, and there are **TWO independent causes** — I published only the first and it read as a complete account:

1. **Redundant-commit duplication.** PR-B's history still carries PR-A's *original* commits (6 of them: `f8b034b`…`f631657`), while `main` now has that same content as ONE squash commit (`507b4cf1`). Same content, different SHAs ⇒ git sees unrelated changes to identical lines ⇒ conflict.
2. ⭐**Stale base — the half I MISSED.** PR-B's base was also far behind, so its net diff vs `main` spanned **50 files / 4068 deletions**: it was effectively *reverting* everything merged upstream since (#1081/#1082/#1085, torch_bridge, test_logger, test_texture_loader…). Post-rebase the net diff was exactly **2 files** (`test_array.py` +134, `src/sgl/func/tensor.cpp` +7).

⇒ ⭐⭐**Measure the NET DIFF vs `main` (`--stat`), not just the commit list.** The commit list exposes cause 1; only the net diff exposes cause 2. A 4068-deletion diff is the signature of a stale base, and it is invisible if you reason from `gh pr view --json commits` alone (which is what I did).

⭐⭐⭐**THE REUSABLE RULE IS THE ROUTINE CHECK, NOT THE INSIGHT.** The fixer corrected my attribution here, and the correction is load-bearing: it found cause 2 by running `--stat` as a **routine before/after equivalence check on every rebase**, *not* by suspecting a second cause. So the transferable form is **"always diff net content before and after a rebase"** — which catches this class **whether or not you suspect it**. Had it been filed as "anticipate a stale base," the rule would only fire for someone who already had the hypothesis, i.e. exactly the people who don't need it. ⇒ **When a finding comes from an instrument rather than a prediction, write down the instrument; a rule that depends on suspicion has already failed the reader who most needs it.**

**Working remedy (fixer, verified zero conflicts):** backup tag first (`backup/1079-pre-rebase-<base-sha>`), confirm the merged content is byte-identical to the carrier end-state (`main`'s file vs the last carrier commit), then `git rebase --onto origin/main <last-carrier-commit>` — replays only the real work. Rebuild before measuring: the worktree `.so` predates the rebase and `main` brought new C++, so the stale binary measures the wrong code.

⚠️**A stacked branch may intentionally REMOVE guards its base added.** Here #1080 drops the 2 D3D12 skip guards from #1078 — correct, because #1079's fix makes `Tensor::clear` raise on read-only storage instead of letting the D3D12 UAV clear remove the device. Don't "restore" them as a rebase artifact. The 6 Metal guards stay (separate slang#12291 track).

**PREVENTION — modifying the shared base (`fix/issue-A`) while PR-B is stacked on it (clean technique, slang #11792↔#11799 re-pin, 2026-06-29):** when you must change the base branch (e.g. a submodule re-pin) and a stacked PR-B has `base = fix/issue-A`, **append a fast-forward commit and `git push` (no force, no rebase).** A fast-forward only advances `fix/issue-A`'s tip → PR-B's base moves forward, PR-B's own branch is never force-pushed/rewritten, and `mergeable_state` stays `clean`. Do **NOT** rebase `fix/issue-A` onto master to clear a `BEHIND` state — rebase rewrites history → force-push → clobbers PR-B's base (the exact failure mode above). Leave `BEHIND` for the **maintainer's "Update branch" / merge-queue**, which is benign for a squash-merge. Verify post-push: base PR-B tip SHA unchanged + `mergeable_state:clean`. Sequence the stacked PR-B's own rebase-onto-master only **after** the base PR-A merges.
