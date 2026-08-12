# Guard-failure taxonomy: four shapes, and the one test that catches all of them

## The discriminator

**Name the two independent sources being compared. If you can't name two, the guard proves nothing.**

Apply it to any guard, assertion, CI check, or FileCheck line before trusting it — including one you just wrote, and including a fix someone hands you for a broken one.

## Four shapes, all observed in-tree

Each looks like working protection from outside. They need different fixes.

1. **Inert guard** — runs, but the condition can't fail for the inputs it actually sees. A literal `0` in a hand-built FileCheck buffer that self-matches 84 times; a `CHECK-NOT` whose target was DCE'd so the property is true vacuously.
2. **Bad matcher** — right evidence, wrong comparison. `REVIEW-GUARD`'s "zero subagent dispatches" greps for `Task` while the CLI emits `Agent` → permanent false negative.
3. **Collected-but-never-read** — the guard gathers exactly the right evidence, the matcher would be fine, and **the good field is simply never compared.** Indistinguishable from working, because it *does* compare something and that something always agrees.
4. **Self-comparison / vacuous assertion** — both sides derive from one source, so it can only catch a race in its own write→read window.

## The trap: fixing 3 lands you in 4

Concrete case (`slang-pr-review-runner/scripts/compose-and-run.sh`): the script computes `DIFF_SHA256` by hashing a live `gh pr diff` — genuinely PR-derived evidence — stores it in a marker alongside `base_sha`/`head_sha`, and then **never reads any of the three back**. Only `repo` and `pr` are ever compared, and those are checked against the same shell variables they were written from (shape 4).

The obvious fix — "assert `diff_sha256` in that same pre-dispatch conditional" — reproduces shape 4 exactly: inside that block the only available comparand is `$DIFF_SHA256`, the var the marker was written from. It would read as fixed and prove nothing.

**Structural reason this recurs:** you assert the unread field at the *nearest* site, and the nearest site is still inside the producer's scope. Non-vacuity requires moving the comparison to where an independent value exists — here, the **post-run** guard, hashing what the consumer actually used and comparing to the recorded value. That's a real producer-vs-consumer check, and it also closes a live hole where the existing matcher compares only the *file list* (a contaminated diff with a coincidentally-matching file set passes today).

## Meta-lesson on where errors hide

The flawed prescription above arrived **in the same message that correctly diagnosed shape 3 as a new failure mode** — the author reintroduced the defect while naming it. A correction carries authority, so it gets audited least, precisely when the writer's confidence peaks. The authority gradient runs the wrong way for accuracy: pre-verified dispatches, corrections, and fixes-bundled-with-their-own-diagnosis are the *least*-checked and *most*-expensive inputs to get wrong. Verify at source; don't defer.

Related: when a fix for a recurring defect keeps failing, check whether it targets the right *mechanism* before making it stricter.
