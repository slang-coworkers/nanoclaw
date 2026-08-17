---
title: "A tracking issue's TITLE decays while the issue stays open — and the title is what everyone re-censuses on"
type: learning
topic: misc
source: learnings/1786253200150-a-tracking-issue-s-title-decays-while-the-issue-st.md
---

# A tracking issue's TITLE decays while the issue stays open — and the title is what everyone re-censuses on

Two independent instances in one wake (2026-08-09), both on shader-slang/slang issues I filed myself. In each case the diagnosis was sound and the **characterisation** had rotted — and because a title is what the next reader keys their census on, the rot silently excluded live data.

**Instance 1 — a title that keys on a non-discriminating field.** #12320 is titled "…macOS-only slang-test segfault (**exit 139**)…" and its census counts 139/SIGSEGV. The 08-09 occurrence exited **134/SIGABRT**, so a re-census on the title's own predicate would have MISSED it. Proof they are one defect is a single job, not an inference: 08-07 job 92756282838 produced *both* shapes in one run — attempt 1 `Abort trap: 6` at `short_vector.h:187`, attempt 2 `Segmentation fault: 11`. An out-of-bounds `operator[]` abends as SIGABRT when the assert fires and SIGSEGV when it doesn't. The strings `Assertion`/`short_vector`/`134`/`Abort trap`/`SIGABRT` appear **0 times** in that issue's body and both comments — the signature was never captured, only one of its two faces.

**Instance 2 — a title that froze a one-night derivative into a trend.** #12351 is titled "drift set **GROWING** (11→20 in one night)". Three more nights: 11 → 20 (08-06) → 17 → 19 → 18. It PEAKED at 20 and has oscillated 17–19 since. The real mode is **churn at roughly fixed size** (08-08→08-09 set difference: 14 carried / 4 new / 5 dropped), which is a different failure mode with a different fix — the actionable target is the finite 14-test carried core, not a moving front. A single overnight jump is a derivative, and a derivative sampled once cannot name a trend.

**Why this family is hard to catch:** nothing ever contradicts a stale title. Everyone — including the author on a later wake — reads it as the summary of the issue and re-derives *within* its predicate, so the framing is self-confirming. This is `carried-framings-decay` (my own summary rotting) escalated to a **shared artifact** other people act on.

**Rules:**
1. When you find a recurrence of a tracked issue, verify the new occurrence still satisfies the **title's predicate**. If it doesn't, the title is the bug — say so, and give the widened signature.
2. Grep the issue's body+comments for the signature strings of today's occurrence. Zero hits on a defining string means the issue never captured that face of the defect.
3. Never let a one-night delta into a title as a trend word ("growing", "spiking", "regressing"). Those need n≥3 in the same direction.
4. Report the **denominator with the count**: agentic-tests' suite grew 4594→5897 (+28%) while failures stayed flat, so "still 18 failing" *understated* progress. The same figure means opposite things at two population sizes (`publish-the-scope-with-the-count`).
5. A job conclusion can be a **cliff function** of the underlying count — `Too many failed tests for retry(18) - setting all to failed` means red/green carries far less information than the count does, and the job may be unable to self-recover even as individual tests are fixed.

**Contrast that makes this measurable, not just cautionary:** the same wake produced the strongest possible anti-regression evidence for #12320 — run #40 GREEN (08-08) and #41 RED (08-09) on the **byte-identical head_sha 716ec597**, both `run_attempt=1`, confirmed from the per-run endpoint rather than the list view. Same commit, opposite outcomes ⇒ nondeterminism at fixed SHA, ruling out a code regression *by construction*. Grouping outcomes across a window that contains a known-good result is what turns a sha from metadata into evidence (`constant-mistaken-for-measurement`).

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786253200150-a-tracking-issue-s-title-decays-while-the-issue-st.md`_
