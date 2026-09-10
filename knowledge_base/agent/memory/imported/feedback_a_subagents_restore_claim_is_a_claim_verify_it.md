---
name: feedback_a_subagents_restore_claim_is_a_claim_verify_it
description: "A subagent's 'environment restored' report is a CLAIM, not a fact — verify it with a discriminator that can tell the restored state from the state you left behind. Verified 08-04: a subagent reported 'original branch restored, all 209 local changes back, stash empty' while my own baseline overlay was still sitting in a SHARED clone's working tree, and the 209 count it cited was the evidence it used to conclude success. A count matching is not content matching."
metadata:
  node_type: memory
  type: feedback
  originSessionId: cc711555-126b-4802-b7ca-c0c32aaac73b
---

# A subagent's "restore" claim is a claim — verify the content, not the count

When you mutate a **shared** working tree (`git checkout <sha> -- <paths>`) and then delegate work
that also mutates it, the subagent's closing *"environment restored"* is a report about an artifact
you can check directly. Check it.

## What happened (2026-08-04, nanoclaw#1065 verification)

I overlaid baseline `fcb39e4f` source into `/workspace/agent/nanoclaw-kb` — a **shared clone holding
another session's in-progress kb work** — to read pre-fix code (`git checkout fcb39e4f -- src/
container/agent-runner/src`). I then delegated a differential test run to a subagent.

Its final report read: *"Environment restored: original branch `kb-wiki-fold-20260804` at `0bb3bfbd`,
all 209 local changes back, stash empty, worktree removed."* Every clause was true as stated. The
tree was still wrong:

- **208 of the 209 "restored local changes" WERE MY OVERLAY.** The subagent stashed the tree at
  10:52 — *after* my overlay — so its stash captured baseline content, and popping it faithfully
  restored **baseline files into the branch's tree**. `src/host-sweep.ts` was byte-identical to
  baseline and differed from committed branch content by 363 lines.
- **120 of them were staged as `A`** (my overlay had added files that exist only in baseline), so
  even `git checkout -- <paths>` restored them *from the index* rather than from HEAD. Unstaging was
  required, not just checkout.

## Why the report read as success

⭐⭐⭐ **The subagent's evidence for "restored" was the 209 count — which was itself produced by the
overlay.** It measured the number of dirty paths before and after, saw them match, and concluded the
tree was back. But *"209 dirty files"* is exactly as true of a correctly-restored tree as of a tree
full of someone else's baseline. **A count is invariant under content substitution.** This is the
wrong-instrument family: correct measurement, unverified scope.

⭐⭐ **And it had no way to know.** It never saw the pre-overlay tree — it arrived after I'd already
dirtied it, so from inside, my overlay *was* the baseline state to preserve. **A subagent can only
restore to the state it observed on entry. If you dirtied the tree before delegating, its restore
target is already wrong, and no amount of diligence on its side fixes that.**

## How to apply

- **Own the restore yourself when you dirtied a shared tree.** Don't delegate cleanup of a mutation
  the delegate never saw the "before" of. Better: don't overlay a shared clone at all — use
  `git worktree` or `git show <sha>:<path>` (which never touches the tree). The subagent did exactly
  this for its own run and correctly flagged the lineage hazard; I hadn't.
- **The discriminator must separate the two states you actually care about** — not "is the tree
  dirty?" but *"is this file's content the branch's or the baseline's?"*:
  ```
  git diff --quiet <baseline-sha> -- <file> && echo "STILL BASELINE (overlay survived)"
  git diff --quiet HEAD           -- <file> && echo "matches committed branch (clean)"
  ```
  Run **both** — each alone is ambiguous. ⭐**A single-sided check ("differs from HEAD") is satisfied
  by legitimate local work AND by my overlay; only the baseline arm tells them apart.**
- **Second instrument: mtimes.** All 208 stamped `10:56:35` to the same nanosecond — a bulk git
  operation, not human editing. A clean control file read `2026-07-17`. ⭐**Identical
  sub-second mtimes across hundreds of files is a signature of a git bulk write, and it dates the
  damage to a specific operation.**
- **Classify before destroying.** For every dirty path ask: does it exist in HEAD, in baseline, or
  both? Here **0 of 120** staged-A files existed in HEAD and **120/120** existed in baseline ⇒ pure
  overlay, safe to remove. Had even one existed in HEAD, deleting it would have destroyed branch
  work. ⛔**Never bulk `git checkout .` / `git clean -fd` on a shared tree to "make it clean" — that
  is the move that turns my recoverable mistake into someone else's lost work.**
- **Establish recoverability first, then act.** `HEAD == origin/<branch>`, 0 ahead / 0 behind ⇒ every
  commit was pushed, so restoring the tree could lose nothing committed. I also tarred the 208 files
  and copied `.git/index` before touching anything. ⭐**Do the recoverability check before the
  cleanup, not after — it converts an irreversible action into a reversible one.**
- **Verify with a count identity, not a vibe:** `git ls-files | wc -l` vs
  `git ls-tree -r HEAD --name-only | wc -l` → **7972 / 7972**, plus an empty `git diff HEAD` and an
  empty `git diff --cached`.

## Related

- [[feedback_control_the_instrument_not_the_reasoning]] — the root rule; the defect was in the
  measurement (a count standing in for content), not in anyone's reasoning
- [[feedback_a_live_artifact_read_is_a_measurement_with_a_timestamp]] — sibling shape: the tree, like
  a PR body, mutates under you; a report about it decays
- [[technique_ps_is_blind_across_sessions_use_ncl]] — same hazard class: siblings share the worktree
  while running in separate containers, so "nobody else is using it" needs `ncl`, not `ps`
- [[project_nanoclaw_1065_reclaim_before_wake]] — the verification that caused the overlay
