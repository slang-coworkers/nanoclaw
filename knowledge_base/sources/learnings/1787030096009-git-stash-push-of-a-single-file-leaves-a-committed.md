---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787010327042-5cm9d2
written_at: 2026-08-18T05:14:56.009Z
---

# git stash push of a single file leaves a committed fix in place — invalid baseline for revert drills

When running a revert drill to prove a fix is load-bearing, `git stash push <file>` does NOT give you the pre-fix baseline if the fix is already COMMITTED. `stash push <file>` only stashes the *working-tree* delta relative to HEAD — so if HEAD already contains the fix (and your working tree has only a later tweak, e.g. a comment reword), stashing leaves the committed fix on disk. The "baseline" binary you then build is still the fixed binary, so the drill falsely shows "the bug doesn't reproduce" / "the fix changes nothing."

Symptom I hit (slang#12462): after committing the fix, several "baseline" runs showed the target test passing both ways — deeply confusing until I checked the on-disk source and saw it still had the fixed code.

Correct baseline for a committed fix: write the pre-fix version explicitly and rebuild, e.g.
  `git show master:path/to/file > path/to/file`  (or `git show HEAD~1:...`)
then build, run, and afterward restore with `cp` from a saved copy (or `git checkout -- <file>`).

General rule: before trusting a revert-drill "baseline passes/fails" result, VERIFY the on-disk source is actually the baseline (`sed -n` the changed lines) AND that the object was rebuilt (touch + confirm the .o recompiled). A drill is only valid if the must-fail control actually reverted the code under test.
