---
name: feedback_a_recovery_copy_is_a_claim_not_an_authority
description: "A byte-faithful reconstruction of destroyed work can be OBSOLETE — the owner improved and pushed it between snapshot and loss. I ordered the restore as 'the only open action'; applying it would have stripped a safety bound and shipped a regression as recovery."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: dd6c5348-62db-4101-8b01-d603c9d1d751
---

# A recovery copy is a claim about lost work, not authority over it

**"Restore the lost work" feels like the one action that cannot be wrong.** It can. A reconstruction
is a snapshot of a moving artifact, and the interval between the snapshot and the loss is enough for
the owner to have improved and pushed something better. Restoring then **overwrites the newer work
with an older subset, in the name of rescuing it.**

## The instance (slang, 2026-08-07)

A peer's `reset --hard` on the shared clone destroyed a sibling's uncommitted `[ForceUnroll]` edit to
`source/slang/hlsl.meta.slang`. It reconstructed the edit byte-exactly from the sibling's own
`scratch-12396/hlsl.meta.slang.patched`, staged the copy, correctly did **not** apply it, and gave an
exact recipe.

⛔ **I told it the restore was "the only open action."** That instruction was wrong, and the peer's
check-before-acting is what caught it:

- **The work was never at risk.** Draft PR **#12417** already existed on `fix/issue-12396`, head
  `637fc739a`, 8 files +145/−2. The clobbered edit was a *local re-application of already-pushed work*.
  Zero durable loss.
- **The pushed version is strictly ahead of the snapshot.** Verified independently at source:
  `git diff 88fa1206d 637fc739a -- source/slang/hlsl.meta.slang` is **+10/−1** and contains
  `[ForceUnroll]` **plus a bound** —
  `for(int i = 0; i < N && i < $(kCoreModule_MaxVectorElementCount); ++i)` (absent at my HEAD:
  `grep -c` → **0**, so it is new in the PR) — plus comments recording that the *integer* arm is
  deliberately left un-unrolled because GLSL and Metal reach it. The snapshot had **two bare
  `[ForceUnroll]` lines** and none of that.
- ⇒ **Applying the faithful copy would have stripped the width bound and re-introduced the
  unbounded-unroll hazard the PR exists to prevent.** A regression, delivered as recovery.

⭐⭐⭐ **And the tree repaired itself.** ~16 minutes after the clobber, tracked mods went 0 → 3, all
three files staged at mtime 05:46, `git diff --quiet 637fc739a -- <file>` matching PR head for each —
the owning session re-established its own state with no intervention. A restore would have raced a
**live writer**, overwriting a staged PR-matching tree with a 2-line subset, mid-session, invisibly.
**A shared tree can repair itself; a restore race cannot be undone.**

## ✅ Closed by measuring the DELIVERABLE, not the tree (2026-08-07 06:04Z)

Final sequence: clobber 05:30 → owner re-applied 05:46 (staged, byte-matching then-head
`637fc739a`) → **pushed ~06:04, PR head advanced `637fc739a` → `80f38cb2d`** (`updated_at`
06:04:18Z, verified independently; the width bound survives the push — `grep -c
kCoreModule_MaxVectorElementCount` at the new head = **2**) → tree cleaned to 0 mods,
`ForceUnroll` back to the HEAD baseline of 10. **Zero durable loss.**

⭐⭐⭐ **A CLEAN TREE IS AMBIGUOUS: it reads identically as "work lost" and "work pushed."** Only the
**remote SHA moving** discriminates. Checking `git status` alone would have re-opened a closed
incident and reported a *second* loss that never happened. ⇒ **when the question is "did the work
survive?", measure the deliverable (PR head / remote ref), never the working tree.**

## How to apply

⛔ **Before treating a recovery copy as authority, establish the work's real status: committed?
pushed? superseded?** `gh pr list --head <branch>`, `git fetch origin pull/<n>/head`, and a diff of
the copy against the pushed head. Cheap, and it is the difference between a no-op and a regression.

⛔ **Never apply another agent's reconstructed work into a shared tree.** Route it to the owner with
the recipe and let them judge. Their `HEAD` may already be ahead of your snapshot in ways your copy
cannot express.

⭐⭐ **Relief is the tell.** Holding a byte-faithful reconstruction produces exactly the confidence in
which nobody re-checks it — the same failure as
[[feedback_an_artifact_that_corrects_you_gets_less_scrutiny]], pointed at an artifact that *rescues*
you rather than one that corrects you. **Vetting scales with stakes, not with how much you want the
artifact to be right.**

⚠️ **My error specifically was urgency substituting for verification.** I wrote "do it now rather than
at the end of the queue — an unrestored edit is the kind of thing that gets abandoned." The premise
(edits get abandoned) was reasonable; I never checked whether *this* edit was at risk, and one
`gh api` call would have shown the PR. **Framing something as time-critical is not evidence that it
is**, and urgency is the state in which verification gets skipped.

Related: [[feedback_tracked_mods_on_a_shared_clone_is_a_reading_not_a_state]] (the clone is a live
multi-writer surface — ~1-minute half-life measured here; use `git worktree` for anything needing
stability, and gate every destructive verb so the check can *stop* it),
[[feedback_a_working_fix_does_not_confirm_the_cause_you_credit]],
[[project_12411_coopvec_bfloat16]].
</content>
