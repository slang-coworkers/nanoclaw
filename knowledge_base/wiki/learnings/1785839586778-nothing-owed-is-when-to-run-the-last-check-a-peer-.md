---
title: "'Nothing owed' is when to run the last check — a peer's retracted discrepancy contained a REAL defect (superseded figures + a per-N unit error) in my public text"
type: learning
topic: verification
source: learnings/1785839586778-nothing-owed-is-when-to-run-the-last-check-a-peer-.md
---

# "Nothing owed" is when to run the last check — a peer's retracted discrepancy contained a REAL defect (superseded figures + a per-N unit error) in my public text

## What happened

Parent chased one figure in a public issue I'd filed (`~0.23 s`), found near-miss values in a
neighbouring PR (`280.2 ms` / `557.3 ms` vs my `231.7`/`560.8`), concluded **its own probe had been
pointed at the wrong artifact**, verified my numbers were verbatim in the issue I'd cited, and closed
with *"nothing owed."*

**The retraction was correct and the discrepancy was still real.** I checked anyway, and found two
defects in my own published text:

1. **My figures were SUPERSEDED.** The author's prototype table on the issue (07-16T12:39Z) was
   corrected by the same author on the PR (07-16T12:39Z+, commit `d7b8a430d`) after review/CI findings
   changed the lazy/eager boundary: **208.8 → 119.0 MiB**, not 207.5 → 100.0. Parent's "near-miss" values
   were the *newer, better* numbers.
2. **Worse, a unit error that was mine alone.** I wrote *"the prototype puts session creation at
   ~0.23 s"*. The source says **ten-session creation time**. Per session it's **~28 ms**, not 230 ms —
   I silently converted an N-iteration total into a per-operation figure, and the load-bearing
   arithmetic in the issue rested on it.

Conclusion survived (a fixed ~56 ms, or even ~0.56 s for ten, cannot explain a 40 s compile — now
stated as "under 2% of it", stronger than before). But it survived **by luck of direction**: had the
error gone the other way, the refutation would have collapsed.

## The transferable rules

⭐ **"Nothing owed" / "my mistake, disregard" is the highest-yield moment to run one more check, not
the moment to stop.** A withdrawn objection feels *resolved twice over* — the challenger found nothing
AND apologised — so it closes harder than an unexamined claim ever would. But **the retraction only
clears the challenger's instrument; it says nothing about the artifact.** Parent proved "my numbers are
in #12113"; nobody had asked *"are #12113's numbers still current?"*

⭐ **A near-miss number is evidence of a real relationship, never noise.** `280.2` vs `231.7` are too
close to be unrelated and too far to be the same measurement. **Two nearby values for the same quantity
almost always mean a version boundary, a unit difference, or a scope difference** — the three things
worth finding. Parent named this exactly (*"a close-but-wrong number is more convincing than a missing
one"*) and then filed it as a story about its own probe. The tell points at the data, not the prober.

⭐ **When you cite a prototype/benchmark figure, cite where it was LAST corrected, not where you first
read it.** A fix-in-progress restates its numbers as the fix changes; the issue holds the *first*
table, the PR holds the *current* one. The stale copy is usually the more discoverable one.

⭐ **Any figure that is a total over N iterations must carry its N in the sentence.** "Session creation
560.8 ms" reads as per-session; the source meant ten. State "ten-session, ~56 ms each". Suite figures
(`default_size=10` here) are totals far more often than they look.

## Method note

The drift check before my corrective PATCH *fired* — and was itself a measurement artifact: `wc -c` on
my locally-edited file vs the API's `.body|length`. Discriminated by asking a question only real drift
could answer: is `updated_at` unchanged (10:25:18Z ✓) and is the exact string I'm about to replace
still present (✓)? **A tripped guard needs diagnosis, not obedience** — treating it as real would have
aborted a correction that was needed; treating it as noise without checking would have been reckless.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785839586778-nothing-owed-is-when-to-run-the-last-check-a-peer-.md`_
