---
name: feedback_a_stored_verification_command_is_code
description: "A stored 're-check with X' command is CODE: it needs a FAILING test before you trust it, and 'it ran clean today' is the weakest evidence because running clean is what a broken check does. The M9 family — six ways a stored check reports an unearned pass (wrong file set, non-discriminating pattern, unarmed absence, moved subject, grep -c counts LINES, recomputing count decays) — plus the APERTURE LADDER (match the claim's SHAPE not its vocabulary; every negative-control set needs the already-fixed case). Split 2026-09-01 from [[feedback_audit_grep_false_negatives_asymmetric]]."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 5c386752-328d-4e3b-85ea-e19e41121b53
---

# A stored verification command is CODE — it needs a failing test, not a clean run

**Split 2026-09-01** from [[feedback_audit_grep_false_negatives_asymmetric]] (which owns the
false-negative asymmetry and the five-part instrument). This file owns the distinct concept: a
command you *store* to re-check a perishable claim is code, and **"it ran clean today" is the
weakest possible evidence — running clean is exactly what a broken check does.**

Tally from one session (2026-08-03, #12331, two agents): **six stored checks, six independent
defects. Every one passed review when written; none was caught by re-running it.** Each was caught
only by *constructing the failure and demanding the command notice.*

## The M9 family — six ways a stored check reports a pass it hasn't earned

1. **Wrong FILE SET.** Without `shopt -s globstar`, `dir/**.py` collapses to `dir/*.py` (top level
   only), so a probe stored to re-check a claim whose corpus lives in a subdirectory returns a
   confident zero. A false-negative check on a *perishable* claim is worse than no check — it
   manufactures reassurance on the schedule you set. Prefer `grep -rnE … <dir>/` over any glob.
2. **Non-discriminating pattern** — right files, wrong question: returns the same answer whether or
   not the claim still holds (`grep -nE '"-O"|"-Os"'` → 1 before and after `"-Os"` is removed; the
   alternation still matches `"-O"`). The command must return one value on the current tree **and a
   different value on a planted failure.**
3. **Unarmed absence-check** — "nothing found" is indistinguishable from "nothing looked at"; the
   broken direction reads as a PASS. Arm it: guard the root, assert the target exists, carry a
   positive control that counts what was scanned, and emit **three** outcomes, not two —
   `CANNOT VERIFY` must be separable from `HOLDS`.
   ```bash
   cd "$R" 2>/dev/null        || { echo "CANNOT VERIFY: no checkout"; exit 3; }
   test -d tools/compile-perf || { echo "CANNOT VERIFY: target absent"; exit 3; }
   C=$(find tools/compile-perf -name '*.py' | wc -l); [ "$C" -gt 0 ] || { echo "CANNOT VERIFY: 0 scanned"; exit 3; }
   N=$(grep -rlIE 'getsize|st_size' tools/compile-perf/ | wc -l)
   [ "$N" -eq 0 ] && echo "HOLDS (scanned $C)" || echo "BROKEN ($N)"
   ```
   (Same ground as [[project_apparatus_probe_failures_rate_limit]]'s exit-2-isn't-evidence, reached
   from runnability rather than pattern.)
4. **Correct command, MOVED subject** — no defect in the command; the tree relocates under it.
   **Record the denominator, don't merely compute it**: a stored `0` is unfalsifiable, a stored
   `0 of 16` lets the next session see the ground moved. The drift is asymmetric — **C falls**
   (target moved ⇒ falsifier may sit where you no longer scan; distrust the zero); **C rises** (more
   scanned — benign for a zero, but **load-bearing for a HIT**: the added files may be out of scope,
   e.g. a `.so` byte-sequence reading as a source hit).
5. **`grep -c` counts LINES, not occurrences** — so a locator gated on `grep -c 'KEY' == 1` is an
   unsound uniqueness gate (two hits on one line pass). `grep -o 'KEY' | wc -l` counts occurrences;
   **disagreement between the two is itself the signal.** "A private helper invoked once is unique"
   is false as a heuristic (`GenerateWholeProgram` → 7 hits, `_getWholeProgramPath` → 4). The
   reliable predicate is **measured unique** — and a code LOCATOR is a stored check too: a stale
   *line number* lands on visibly-wrong code and announces itself, an ambiguous *grep key* returns
   plausible hits and does not. ⭐ **Publish the hit count beside the key; trading a loud failure
   for a silent one is a regression even when the pointer is "more robust."**
6. **`grep -r` scans whatever sits in the directory** (the mirror of form 1: too *many* files) —
   untracked build output / fetched binaries make a byte sequence in a `.so` read as a source hit
   ("P2 BROKEN, 13 matches" — all inside fetched `releases/*/lib/*.so`; tracked source → 0). Scope
   an absence-check to **tracked source** (`git ls-files … | xargs grep`) or at minimum pass `-I`
   (skip binary) / `--include`. What caught it was the **denominator** (16 → 26), not the matches.

**Also: `grep -c '--stat'` errors** (dash parsed as an option) — inside `N=$(…)`, `N` lands empty,
exit 2 reads as exit 1 reads as absence. Always `grep -ciF -e "$pat"`; **print the raw output on any
zero** before the loop converts it to a verdict.

**Five questions before you store a re-check:** (1) does it look at the file that would change?
(2) does its answer *differ* when the claim breaks — proven against a planted failure? (3) can **I**
run it here (a command needing a clone/binary I lack is a note, not a check)? (4) does it distinguish
*cannot verify* from *holds*? (5) does it record a **denominator** so a moved subject is visible later?

## A count in a hook is a claim — prefer self-backing hooks

Distinct from a wrong pointer: the link resolves, the file is right, but the **number** no longer
matches (compaction cuts the examples that backed N while the count survives). A **marker-count is
not an item-count** and errs both ways — prose-embedded items `(a)(b)(c)` have no markers to count.
Either enumerate items inline (`3 shapes: A · B · C`, self-backing, cannot drift) or number them in
the child so `grep -cE '^[0-9]+\. '` is the source of truth — and **RANGE-PIN** it
(`awk '/^start/,/^end/' | grep -c …`), because an append-only file *will* grow a second numbered
list and an unscoped count is a **scheduled** failure. Cf. [[feedback_name_what_you_held_fixed]].

⭐⭐ **A non-zero control validates DETECTION, never MAGNITUDE.** A ceiling-capped instrument (the
collapse-to-one-line cure, `grep -oic` on a `tr`-joined file) passes every existence control by
construction — four controls all returning exactly `1` was the only tell. If the claim is a COUNT,
the control must be a count with a **known value > 1**, and you must check the returned value
*matches* it. Suspect the instrument when several controls agree on the same small number. Cf.
[[feedback_a_guard_can_be_inert_and_read_as_passing]] — a capped counter is an inert guard wearing a
passing control.

## The aperture ladder — match the claim's SHAPE, not its vocabulary

When auditing whether a class of defect exists store-wide, the pattern's **width** is a variable and
every setting lies differently:

| aperture | targets | failure |
|---|---|---|
| **command-scoped** | the literal command string | blind to prose *claims* about it |
| **word-scoped** | one word (`recomputes`) | matches unrelated senses (`recomputeSet`) |
| **phrase-scoped** | a common phrase (`source of truth`) | ~150 hits, signal buried |
| ✅ **claim-scoped** | the **grammar** of the claim (a recompute assertion *adjacent to* a count command) | discriminates |

⭐⭐⭐ **2 hits and 150 hits are the SAME failure** — both leave you unable to say whether the store
is clean, and both feel like a completed sweep (the 150-hit case reads as *thoroughness*). Construct
the pattern from the defect's structure: which two things must be **adjacent** for the claim to be
wrong?

⛔ **Every negative-control set needs the ALREADY-FIXED case.** A pattern that also flags the fixed
form reports the defect forever — every future sweep "finds" it, the fix never registers as done,
and you learn to ignore the sweep (worse than the original defect: it disables the instrument).
Unrelated-sense negatives are the ones you think of; the fixed form only exists *after* you start
repairing, so it is absent from any fixture built before the fix. Build negatives from the **real
repaired text**, never an imitation — which clause is load-bearing depends on *your own* repair's
wording, so **don't adopt a peer's "that clause is inert" finding** (same fixture, opposite verdict).

⛔ **A windowed aperture makes every zero narrower than you state it.** "0 hits" from a
`recomputes.{0,80}` pattern means "0 within 80 chars"; a real defect worded ~150 chars apart is
missed. **Report an aperture's bound with its zero**, and when a fixture must sit *outside* a
numeric threshold, **measure the offset** — a first far-fixture at 81 against a window of 80 is
still *just inside* and returns the reassuring answer. Cf. [[feedback_unattributed_fact_reads_as_your_own]].
⇒ **any parameter of an instrument (window, depth, page size, timeout) is a scope on its result** —
state it with the finding.

## The recursion — a fix built with an instrument that shares the defect it fixes

A `grep -c`-counts-lines gate was accepted *while the same file documented that defect* — this note's
own meta-lesson firing verbatim: **having the rule filed does not execute it.** And a correction
inherits the burden of proof of what it fixes, **not** the credibility of the defect it repairs —
including when the fix is someone else's correction *of you* (scrutiny lapses exactly there). Ties to
[[feedback_correction_unapplied_until_every_restatement_fixed]] and the fix-inherits-burden-of-proof
row in [[slang-evidence-lessons-measurement-rows]].

✅ **What worked all six times:** run the instrument against the artifact and **publish the number**
so the next reader confirms instead of trusting. Not one defect was caught by re-reading the argument.
See [[feedback_narrowing_is_not_testing_check_own_store]] and
[[feedback_mechanism_must_predict_observed_coordinates]].
