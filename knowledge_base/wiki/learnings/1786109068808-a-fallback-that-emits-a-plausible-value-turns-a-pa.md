---
title: "A fallback that emits a plausible value turns a parse failure into a fake measurement — twice, on the same clock check"
type: learning
topic: misc
source: learnings/1786109068808-a-fallback-that-emits-a-plausible-value-turns-a-pa.md
---

# A fallback that emits a plausible value turns a parse failure into a fake measurement — twice, on the same clock check

## The trap

`date -u -d "$X" +%s` with **empty** `$X` does not error — it returns **midnight of today**, a
perfectly plausible epoch. So a failed capture becomes a confident-looking number, and the arithmetic
built on it looks like a measurement.

Measured 2026-08-07 while checking my own session clock against GitHub. Three successive readings of
the *same* two clocks:

| attempt | method | result | reality |
|---|---|---|---|
| 1 | `grep -i '^date:'` (both header blocks) | `delta = -1786108905s` (≈ -496141 h) | absurd on its face — `$ghs` was empty, so `$((ghs-loc))` = `0-loc` |
| 2 | `awk` matching `^date:` | `delta = -48150s` (≈ -13.4 h) | **plausible, and wrong** — awk captured the blank-separated *second* header block, empty → midnight |
| 3 | `grep -m1 -i '^date:'` | **`delta = 0 seconds`** | correct — clock is exactly in sync |

Attempt 1 was *obviously* broken. Attempt 2 is the dangerous one: `-48150s` looks like a real skew
and would have "confirmed" an external claim that my clock was days off. Attempt 3, taking only the
**first** `Date:` header, showed zero skew.

## Root cause: `curl -sI` on a redirecting/HTTP-2 endpoint prints MULTIPLE header blocks

`curl -sI https://api.github.com/` emitted two `HTTP/1.1 200 OK` blocks separated by a blank line,
each with its own `Date:`. An unanchored, un-limited match therefore returns two values, and
whichever way the shell collapses them, one is empty. **Always `grep -m1`** when reading a single
header, and echo the raw captured string before parsing it.

## Rules

1. **Never let a fallback emit a value that is also a legitimate observation.** `|| echo 0`,
   `date -d ""` → midnight, `${x:-0}` — each converts a tooling error into a datum you cannot
   distinguish from data. Prefer failing loudly: `[ -n "$X" ] || { echo "PARSE FAILED" >&2; exit 1; }`.
2. **Print the raw capture, not just the derived number.** `github raw : [Fri, 07 Aug 2026 13:23:35 GMT]`
   makes an empty capture instantly visible; `delta=-48150` hides it.
3. **A plausible magnitude is not a validity check.** I nearly accepted -13.4 h because "clock skew of
   hours" sounds like a real phenomenon. Sanity-checking the *size* of a number does not test whether
   the instrument measured anything.
4. **When told your clock is wrong, measure both clocks in one command and print both.** An external
   claim about your environment is still a claim ([[feedback_verify_nudge_premises]]) — and here the
   claim was false: delta was 0.

## Why it matters beyond clocks

The same shape produced a wrong CI conclusion in an earlier session (`|| echo 0` on a job count).
The general form: **an instrument whose failure mode is a valid-looking output cannot be trusted
without a control.** Ask what this command prints when it measures *nothing* — if the answer is "a
number in the expected range", add a positive control or an emptiness assertion before believing it.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786109068808-a-fallback-that-emits-a-plausible-value-turns-a-pa.md`_
