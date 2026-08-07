---
name: feedback_gh_pr_checks_dedups_runs_rollup_does_not
description: gh pr checks COLLAPSES repeated runs of one check name; statusCheckRollup returns all. 51 vs 56 entries on one PR. Dedup can hide a RED run behind a green one of the same name — use rollup for did-anything-fail.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 8246ae29-ea58-4221-b5b7-ef70556a0a7b
---

Measured on shader-slang/slang PR #12379, 2026-08-06, both instruments against the same head
`2876c3a7b2`:

```
gh pr checks 12379 --json name,bucket   → 51 entries: 47 pass, 4 skipping, 0 fail
gh pr view 12379 --json statusCheckRollup → 56 entries: 47 SUCCESS, 6 SKIPPED, 3 null
```

⭐⭐⭐ **The difference is DE-DUPLICATION, not filtering. `gh pr checks` collapses repeated runs of the
same check name; `statusCheckRollup` returns every run.** Verified duplicate names in the rollup:
`board-sync / board-sync` **5×**, `Claude Code Assistant` 2×, `bridge` 2×, `reuse-compliance-check` 2×.
The two duplicated *skips* are exactly the 4-vs-6 skip delta.

⇒ **Pick by question:**
- **"Did anything fail?" → rollup `conclusion`.** Dedup can collapse a **red** run into a green one of
  the same name, which is strictly worse than over-counting.
- **"How many distinct checks exist?" → `gh pr checks`.** Repeats are noise for that question.

## Two instrument traps in the rollup itself

⚠️ **`conclusion` is null for `StatusContext` nodes — 3 of 56 here.** The rollup mixes node types:
53 `CheckRun` (which have `conclusion`) and 3 `StatusContext` (which have `state` instead — here
`CodeRabbit`, `SlangPy Tests`, `license/cla`, all `SUCCESS`). A `group_by(.conclusion)` shows them as
`null` and they read as "pending." Node-type-agnostic form:

```
gh pr view <n> --json statusCheckRollup \
  --jq '[.statusCheckRollup[]|.conclusion // .state]|group_by(.)|map({v:.[0],n:length})'
→ 50 SUCCESS, 6 SKIPPED     # the honest total; 0 pending, 0 failures
```

⚠️ **Never grep check *names* for failures.** `gh pr checks | grep -i fail` matches the literal string in
the job name **`retry-on-gpu-failure`**, producing a confident "1 failed" on a fully-green PR. Read the
structured field.

## ⭐⭐⭐ The two instruments distort in OPPOSITE directions — neither is a safe default

Verified on the same PR: **`gh pr checks` does NOT share the `StatusContext` blind spot.** It normalizes
all three (`CodeRabbit`, `SlangPy Tests`, `license/cla`) to `bucket: pass`, and **zero entries** have an
empty or null bucket.

| instrument | distortion | symptom |
|---|---|---|
| `gh pr checks --json bucket` | **de-duplicates** repeated runs of one name | under-counts; could hide a red run behind a green one of the same name |
| rollup, bare `.conclusion` | `StatusContext` nodes have no `conclusion` | **invents pending** — 3 nulls on a fully-green PR |

⇒ **There is no "just use the safe one." The move is knowing which distortion each carries:** rollup with
`.conclusion // .state` for *did anything fail*; `gh pr checks` for *how many distinct checks exist*.

## ⛔ FOURTH distortion — my own `.conclusion // .state` fix is WRONG MID-RUN. Empty string is not null.

I published `.conclusion // .state` as the node-agnostic form. **It is only correct once every check has
finished.** Measured mid-run on the same PR (2026-08-06 23:38, 29 rows):

```
[.conclusion // .state]          → 17 SUCCESS, 1 SKIPPED, 1 PENDING, **10 ""**
```

⭐⭐⭐ **A running `CheckRun` has `conclusion: ""` — an EMPTY STRING, not null — so jq's `//` operator
does NOT fall through** (`//` only catches `null` and `false`). The 10 empties were
`{__typename: CheckRun, status: IN_PROGRESS, state: null}`: still running, and my expression rendered
them as a nameless `""` bucket that reads as neither pass, fail, nor pending. Correct form:

```
gh pr view <n> --json statusCheckRollup --jq '[.statusCheckRollup[]
  | (.conclusion // "") as $c
  | (if $c=="" then (.state // "PENDING") else $c end)]
  | group_by(.)|map({v:.[0],n:length})'
→ 17 SUCCESS, 1 SKIPPED, 11 PENDING     # reconciles exactly with gh pr checks
```

⛔ **AND MY "reconciles exactly with `gh pr checks`" WAS ITSELF A TIMING ARTIFACT — the two readings I
compared were minutes apart on a live PR.** The peer nearly filed a second bug against the corrected
expression on that basis (3 macOS jobs `SUCCESS` in one snapshot, `pending` in the other). Captured
**simultaneously** — two backgrounded calls, one `wait` — they agree exactly:

```
( gh pr view <n> --json statusCheckRollup --jq '<corrected expr>' > /tmp/r &
  gh pr checks <n> --json bucket --jq '...'                       > /tmp/c & wait )
rollup: 21 SUCCESS / 7 PENDING / 1 SKIPPED   (29 rows)
checks: 21 pass    / 7 pending / 1 skipping  (29 rows)   → 0 disagreements
```

⇒ ⭐⭐⭐ **When comparing two instruments against a MOVING system, capture them simultaneously.**
Sequential reads of a live PR differ because the **subject** changed, and that is indistinguishable from
the **instruments** disagreeing. Population, ref, **and instant** all have to be pinned before a
comparison counts as evidence. Both of us were one step from publishing a false defect against a correct
tool — in opposite directions, one turn apart.

⇒ ⭐⭐ **The two node types carry completion in DIFFERENT fields: `CheckRun` uses `status`
(`IN_PROGRESS`/`COMPLETED`) + `conclusion`; `StatusContext` uses `state`.** Any single-field read is
wrong for one of them in some phase.

⇒ ⭐⭐⭐ **I validated that fix only against a SETTLED PR, where every `conclusion` was populated — so the
bug was structurally invisible at the moment I tested.** Same defect as everything else in this file: the
instrument was exercised on a population that could not expose its failure mode. **A rollup expression
must be tested mid-run, not on a green PR.**

## ⭐⭐⭐ Third distortion: on a FRESH PUSH, `pending == 0` is true and VACUOUS

Measured on the same PR after a force-push (2026-08-06 23:30): a monitor fired
`CI SETTLED clean: {'pass': 2}` about one minute in, on a PR whose full run is **~51 checks**.

**The only two rows present were `CodeRabbit` and `license/cla` — exactly the two `StatusContext`
nodes.** Those are the ones that **carry over a head change**; all 49 workflow `CheckRun`s had not yet
registered (`gh run list` showed one job `in_progress`). So `pending == 0` was **literally true and
completely vacuous.**

⭐⭐⭐ **The same `StatusContext`/`CheckRun` split that makes bare `.conclusion` invent phantom *pending*
also makes a fresh head look *settled*** — because the carried-over contexts are precisely what survives
a push. One structural quirk, two opposite false readings, depending on when you look.

⇒ **"Nothing pending" is not "everything ran."** Sibling of *empty is not a pass*. Gate any
settled-detection on a **plausibility floor** — total row count ≥ some fraction of the known run size
(`len(rows) >= 20` was used here) — before honouring `pending == 0`. A settle-check with no floor reports
success from an empty starting gate.

⚠️ **Practical consequence in this chain: "N pending" figures I reported repeatedly were partly jq
artifacts, not live checks** — they never converged because 3 of them never could. **A count that refuses
to converge is a signal to audit the instrument, not to wait longer.**

✅ **Counter-example worth keeping, from the same exchange:** the `StatusContext` finding above was an
instrument claim I asserted and a peer then *verified* — and it was right, where my dedup explanation was
plausible and wrong. ⇒ **The discipline is not "distrust the relay," it is "measure it." Measuring cuts
both ways, and a rule that only ever produces distrust would have discarded a correct finding here.**

## The meta-lesson, which is why this file exists

I published the `grep -i fail` substring collision as the **cause** of the 4-vs-6 delta. It wasn't —
the fixer had parsed the JSON `bucket` field and never grepped. My explanation was **plausible,
self-consistent, testable, and named a mechanism that was not operating.** The recommendation it
supported ("read `conclusion`, don't grep names") was correct and is *better* founded by the real cause
than by the one I invented.

⭐⭐⭐ **A misdiagnosis OF an instrument reads exactly like a diagnosis BY one.** Same session generator
(instrument population ≠ claim population), first instance aimed *at* an instrument rather than produced
*by* one. ⇒ **Being right about the remedy is not evidence you are right about the cause — and a correct
remedy will happily carry a wrong mechanism downstream.** Before explaining someone else's number, ask
what command *they* ran; do not infer it from what would produce that number.

See [[feedback_mechanism_must_predict_observed_coordinates]] — same failure, larger stakes there.
