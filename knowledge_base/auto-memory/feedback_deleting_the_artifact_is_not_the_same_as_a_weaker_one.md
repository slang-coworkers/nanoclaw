---
name: feedback_deleting_the_artifact_is_not_the_same_as_a_weaker_one
description: "Failing-first by DELETING the artifact proves almost nothing — every case dies at rc=127 for the same reason. To show a test suite is non-vacuous, run it against MUTANTS a plausible author would have written; measured on nanoclaw#1173, that separated 3 cases that each kill a different mutant."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 3f9468d7-c88d-494c-8925-c3e6e43fb225
---

# Deleting the artifact is not the same as weakening it

**TRIGGER: whenever I am about to certify a test suite as non-vacuous, or accept an author's
"all N fail with the script absent" as evidence that the tests are meaningful.**

## The measurement (nanoclaw#1173, 2026-08-10)

The PR added `scripts/check-task-snapshots.test.ts` (6 cases) and claimed *"all 6 fail with the
script absent."* I reproduced it — and the result was **useless**:

```
case1 rc=127  msg=bash: scripts/check-task-snapshots.sh: No such file or directory
case2 rc=127  ...same...
case3..6 rc=127 ...same...
```

⭐⭐⭐ **Every case failed for the SAME reason, and that reason was not the behavior under test.**
A suite of 6 tests that all assert "the file exists" would produce this identical transcript. Absence
is one failure mode shared by every case, so it cannot distinguish a case that tests something from a
case that tests nothing.

## What actually worked: mutants, not absence

I wrote two scripts a **plausible lazier author** would have written, and re-ran the cases:

| mutant | missing-md-half | bad SECOND snapshot | empty glob |
|---|---|---|---|
| M1 — `--md` passed only when the file exists | **rc=0 ESCAPES** | caught | rc=1 (wrong reason) |
| M2 — `head -1`, no empty-glob notice | caught | **rc=0 ESCAPES** | **rc=0 `OK` ESCAPES** |
| real script | rc=1 | rc=1, names the 2nd file | warns + "verified NOTHING" |

⇒ Each of the three interesting cases **kills at least one mutant the others let through.** That is
what upgrades the script's comments ("`--md` is passed UNCONDITIONALLY", "every snapshot is checked")
from style notes to load-bearing claims. Absence testing could never have shown it.

## The same move on the production code

Applied to the dependency the whole check rests on: mutated `check_published` to
`elif False and stored != recomputed` (accept any well-formed id, skip the hash recompute) and re-ran
the contents-edited case → **`EXIT=0`**. That is the proof the recompute is the only thing catching a
hand-edited definition. Reading the function cannot establish that; a mutant does it in one command.

## The rule

⭐⭐⭐ **A test's value is measured against the WEAKER IMPLEMENTATIONS it rejects, never against the
missing one.** Before certifying a suite:

1. Ask: *what would a lazy-but-reasonable version of this code look like?* Write it. 10 lines is enough.
2. Run the suite against it. A case that passes on the mutant tests nothing the mutant got wrong.
3. Do the same to the **production function** the tests depend on — one `and False` in the load-bearing
   comparison tells you whether the assertion is doing the work.
4. Report the mutant table, not the absence transcript.

⚠️ **Corollary — a mutant can fail for the wrong reason and read as "caught."** M1 exited 1 on the
empty-glob case, but with `unreadable or not JSON: …scheduled-tasks.*.json` — the literal glob string,
i.e. it never matched anything and stumbled into an unrelated error. **Check the MESSAGE, not just the
exit code**, or a coincidental non-zero gets scored as coverage. Same family as
[[feedback_a_control_that_fires_by_luck_is_not_a_control]] and
[[feedback_a_positive_marker_beats_an_absence_in_a_log]].

Related: [[feedback_a_green_checker_that_excludes_the_changed_file]] (the suite ran but the changed
file wasn't in its program — the *other* way a green suite means nothing).
