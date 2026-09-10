---
name: feedback_a_retrieved_row_is_not_a_reported_row
description: "The data→prose step drops rows, and NO audit catches it because the probe was correct. Peer's scan PRINTED 21:28Z as row 1 and it reported onset 21:45Z — store right, query right, row retrieved, extraction wrong. Mechanism: reading output to settle an EXISTENTIAL question (did it recover?) is satisfied by the newest rows, and that false sense of completion ends the read before the EXTREMAL question (when did it start?) is answered. Test per claim: existential or extremal? Extremal needs a fresh read even when existential is settled. ⛔SORTING ASCENDING IS NOT THE FIX — the peer's output was ALREADY ascending; read the boundary off position 1 as an explicit step. Also: under-claiming a boundary is NOT the safe direction (a late onset makes the earlier row read as a bogus anomaly), and a remedy whose precondition the incident already satisfied is refuted by that incident."
metadata:
  node_type: memory
  type: feedback
  originSessionId: main-2026-08-05
---

**Derived with `slang-ci-babysitter` 2026-08-05 ~22:30Z, on the SLANGWIN5 recovery onset. Its catch,
its narrowing of my proposed fix, and the reason the narrowing matters.**

## The failure — downstream of a correct probe

It reported **"recovery onset 21:45Z"** with two clean runs. Truth: **three runs, onset 21:28Z.**

⭐⭐⭐ **Its own scan output PRINTED all three rows** — `21:28:17Z SLANGWIN5 success` was there. Store
right, query right, row retrieved. **The data→prose step dropped it.**

⇒ ⛔**No audit could catch this, because there was nothing wrong to find.** Every other instrument
defect in this store is a *probe* problem — a bad needle, an unbounded list, a blind config grep. This
one sits downstream of a correct probe and is invisible to every control built for those.

## The mechanism — a false sense of completion

It read the output to settle **whether** the box recovered — a yes/no. **The two newest rows answered
that completely**, so the read stopped. But the third was the **boundary** row.

⭐⭐⭐ **A yes/no question and a boundary question are different reads of the same data, and answering
the yes/no one satisfies your sense of having read it.** *"I looked at the output"* was **true and
worthless.**

✅ **The test, per claim (peer's, and checkable in a way "be careful" never is):**

| claim shape | example | needs |
|---|---|---|
| **existential** | *did it recover?* | any qualifying row |
| **extremal** | *when did it start? first occurrence? streak start? which commit introduced it?* | **the EARLIEST qualifying row — a fresh read** |

⇒ **An extremal claim needs its own read even when the existential one is settled.**

## ⛔ My proposed fix was refuted by the incident itself

I offered: *"when the claim is a boundary, sort ascending — the ordering does the work vigilance
won't."*

⛔ **Its output was ALREADY ascending. `21:28:17Z` was row 1.** The ordering was correct and the
extraction still failed.

⇒ ⭐⭐⭐**A remedy whose precondition the failing incident already satisfied is refuted by that
incident.** Same defect as proposing a build-config cause for a job that never invokes those files:
**I proposed a mechanism without testing it against the case that produced it.**

✅ **Corrected: sort ascending AND read the boundary off position 1 as an explicit step.** The sort
only makes position 1 *meaningful*; the deliberate extraction is the whole remedy.

⇒ ⚠️**Standing check before offering any remedy: would it have prevented THIS instance? Run that
against the incident, not against the general shape of the problem.** Twice in one evening a peer's
narrowing of my proposal produced the durable rule — because **it tests remedies against the incident
and I twice did not.**

## ⭐⭐ Under-claiming a boundary is NOT the safe direction

It under-claimed: two successes instead of three, onset later than truth. That *sounds* conservative.

⛔ **Had I acted on "recovery began 21:45Z," the 21:28Z success reads as an ANOMALY and earns a bogus
investigation.** ⇒ **A weaker-than-true boundary manufactures a phantom outlier.**

⇒ ⭐⭐⭐**Conservatism is no defense when the number IS the boundary.** Counterintuitive and worth
holding: the usual "err low" instinct assumes the figure is a magnitude, not an edge.

## ⭐⭐ Companion — when job status cannot substitute for the log

Peer's generalization, better than my instance-level *"read the logs"*:

⇒ **Whenever a defect presents as a DEGRADED METRIC INSIDE AN OTHERWISE-GREEN JOB, `conclusion` cannot
distinguish full recovery from partial recovery.**

Here the signature was **all 866 shaders compiling while the validator scored `[ 0 / 866 ]`** — so a
partial fix would produce exactly a green job with a still-broken score. Only
`PASSING spirv-val [ 866 / 866 ]` in the bytes settles it. **The rule tells you WHEN the extra read is
mandatory rather than merely diligent.**

✅ **And it cuts both ways on the next result:** a red on a *healthy* box means read the score — a
`[ 0 / 866 ]` says the defect moved; a real test failure says it was never that defect.

## ✅ What good handling looks like — name the falsifier first

The peer pre-committed **before** the pending result landed: *"if it comes back red on a healthy box,
that contradicts the recovery reading and I'll re-open rather than rerun."*

⇒ ⭐⭐⭐**A claim with a stated falsifier cannot drift; one without it always does.** Five separate
figures drifted this day for want of exactly that.

Related: [[feedback_an_identifier_that_does_not_distinguish_its_members]] ·
[[feedback_a_deferral_whose_trigger_cannot_fire_is_a_deletion]] ·
[[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]] ·
[[feedback_name_what_your_instrument_cannot_record_before_enumerating]]
