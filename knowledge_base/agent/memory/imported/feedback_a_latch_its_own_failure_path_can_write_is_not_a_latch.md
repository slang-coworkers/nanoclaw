---
name: feedback_a_latch_its_own_failure_path_can_write_is_not_a_latch
description: "A state-change latch whose stored value the FAILURE path can also write self-poisons: one failed probe blanks the fingerprint, differs from the good one => wakes, overwrites the latch, so the next HEALTHY fire differs again and wakes too. Measured: 8 spurious 20-min wakes on i12371-pr-guard, prior_fingerprint='|human=0'. Fix = bail without touching the latch; test by INJECTING failure."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6a1c7a56-c426-4cb7-9fac-631acf54a0b7
---

# A latch its own failure path can write is not a latch

⛔ **Measured 2026-08-06 11:0xZ on `i12371-pr-guard-0175`, a guard I had built and
"tested two-directionally" 4.5 hours earlier.** Observed cadence: **8 consecutive wakes at
exactly 20-minute spacing** (09:00, 09:20, 09:40, 10:00, 10:20, 10:40 …) on a PR whose state had
not moved since 06:51Z. The latch was supposed to cap this at one wake per 4 hours.

## The mechanism

The wake payload handed me `prior_fingerprint: "|human=0"` — a **degenerate** value: five empty
fields and a literal. Reproduced it exactly, byte-for-byte:

```
gh pr view … 2>/dev/null      # on ANY API error: empty stdout, non-zero exit
  => $d = ""
jq --argjson cr "$cr" '. + {failing_headsha:$cr}' <<<""   => outputs NOTHING
jq -r '[…]|join("|")' <<<"" 2>/dev/null                   => "" (rc=5, suppressed)
fp="$fp|human=$human"                                     => "|human=0"
```

A second, subtler route to the same place: `gh api --jq` on an error prints the **error JSON
object** to *stdout* and exits non-zero. `[ -z "$cr" ] && cr='[]'` therefore does **not** fire —
`$cr` is non-empty — so `--argjson` happily grafts `{"message":"Not Found"}` into the record, and
then `sort` throws *"object … cannot be sorted, as it is not an array"*, blanking the whole
fingerprint the same way.

⇒ **The failure path could write the latch file.** And because the degenerate value *differs* from
the healthy one, the sequence is self-sustaining:

```
fire N   probe fails  -> fp="|human=0" != stored  -> WAKE, and STORE "|human=0"
fire N+1 probe fine   -> fp="f93eb…"   != stored  -> WAKE, and STORE "f93eb…"
fire N+2 probe fails  -> fp="|human=0" != stored  -> WAKE …
```

⭐⭐⭐ **One transient failure is enough to start it, and it needs no further failures to continue** —
the healthy fire *after* a poisoned one is itself a spurious wake. That is why the loop looked like
flapping infrastructure rather than a bug in my own script.

## Why my earlier "two-directional test" missed it

I tested **fire → wake, fire again → silent**. Both cells ran with a **healthy** `gh`. The failure
path — the only path that produces the bug — was never executed.

⭐⭐⭐ **"Two-directional" must mean the two directions of the MECHANISM (works / breaks), not two
repetitions of the happy path.** A latch has three inputs, not two: changed, unchanged, and
*unknown*. I had asserted the first two and left the third to inference.

## The fix, and how to test it

Three guards, each at a different layer — validate **shape**, never non-emptiness, and **`exit`
without writing the latch**:

1. Comment count must match `*[!0-9]*` → bail. (`[ -z "$h" ] && h=0` turned a 404 into
   *"no human has commented"* — the precise value meaning "nothing to do".)
2. `$d` must be non-empty **and** its `.number` must equal the PR number asked for → bail.
3. `$cr` must have `jq type == "array"` → bail. An empty check-run list and a failed check-run
   query are **not the same fact**.
4. Backstop: a fingerprint whose head field is empty can never be a real PR state → bail.

**Tested by injecting failure**, with a `gh` stub earlier on `PATH`:

| test | injection | result |
|---|---|---|
| T1 | none, unchanged state | silent, latch intact ✅ |
| T2 | `gh` always fails (401) | `wakeAgent:false`, latch intact ✅ |
| T3 | **only** `gh pr view` fails | bails, latch intact ✅ |
| T4 | **only** `…/check-runs` fails | bails, latch intact ✅ |
| T5 | healthy + latch holding a genuinely different fp | **wakes** ✅ (positive control) |

T5 is the cell that keeps the fix from being "never wake again" — without it, four bail paths are
indistinguishable from a broken guard. See
[[feedback_published_negative_env_claims_need_rederivation]] on negatives with no failure signature.

## The general rule

⭐⭐⭐ **Any probe whose output feeds a stored comparison value must make FAILURE distinguishable from
a NEGATIVE RESULT, and must leave the stored value untouched when it cannot measure.** The store is
the invariant; a value written from an unknown state destroys it for every future comparison, not
just this one.

⚠️ Corollary specific to `gh`: `gh api --jq` writes error JSON to **stdout**, so `[ -z "$x" ]` is
the wrong emptiness test for every `gh` call — check the *shape* (integer / array / expected key),
or check `$?`. Related: [[feedback_never_read_an_exit_status_through_a_pipe]].

Related: [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]] (this guard's reason
for existing), [[feedback_a_remedy_that_can_reproduce_its_own_bug]] (the 06:30Z latch *was* the
remedy for an unconditional wake loop, and reintroduced a wake loop by a new route).
