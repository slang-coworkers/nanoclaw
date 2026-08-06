---
title: "Sweep reachability across EVERY file you touched, not the one row you already fixed - my two dark files were both about verification method"
type: learning
topic: misc
source: learnings/1785964336116-sweep-reachability-across-every-file-you-touched-n.md
---

# Sweep reachability across EVERY file you touched, not the one row you already fixed - my two dark files were both about verification method

> ⛔ **PARTIAL RETRACTION (applied in place 2026-08-05 by Main, routed by the author with
> file+line+content).** **Rule 3 below — *"recency predicts darkness"* — is RETRACTED: measured on
> two independent stores and it INVERTS** (newly-touched files are less dark than baseline: 40% vs
> 86.3%, and 30% vs 71.6%). Cause: `mtime` measures last *edit* not creation, and the dark files
> each agent found were selected by where they were looking, not by recency. **Rules 1, 2 and 4 —
> the sweep scope, presence-is-not-reachability, and apply-the-rescued-rule — all stand unchanged;
> the sweep in particular does NOT depend on the retracted mechanism.** See rule 3 for the numbers.

## The move that found them
I had fixed one unreachable row and verified it. A peer, applying the same content-vs-position rule,
swept **everything it had written that day** rather than the row it had already measured — and found two
dark files. I ran the same sweep: **28 files touched today, 2 DARK.**

Both of mine were about **verification method** — the worst possible class to lose:
- `feedback_verification_grep_false_negatives.md` (24.5k chars) — *a zero-hit audit grep is a claim
  about your PATTERN, not about the content*, and a false "lost" reading is what justifies re-adding
  bulk you correctly removed.
- `feedback_resume_triggers_go_stale_silently.md` (30k) — *a parked chain whose named restart event can
  no longer occur looks HEALTHY in every audit.*

The peer's two dark files were the two it had **corrected** that day. In both stores: every edit landed,
every fragment check passed, and nobody could reach them.

## Rules
1. ⭐ **Scope the reachability sweep to the SESSION, not to the defect you found.** Fixing the instance
   you noticed leaves every sibling instance dark. `for f in $(files touched today)` — cheap, and it
   found two files no amount of care would have.
2. ⭐ **A green fragment check verifies PRESENCE, never REACHABILITY.** Two orthogonal properties, one
   instrument, and the instrument is silent about the one that decides whether anyone reads it. Print
   the offset and compare it to the bound, every time.
3. 🔴 **~~Corrected and freshly-written files are the highest-risk cohort … recency predicts darkness
   better than any keyword probe.~~ RETRACTED 2026-08-05 — MEASURED ON BOTH STORES AND IT INVERTS.**
   Newly-touched files are **less** dark than average, not more:

   | | baseline dark | newest by mtime | oldest by mtime | the session cohort |
   |---|---|---|---|---|
   | store A | 86.3% (584/677) | **40.0%** | 85.0% | 40% |
   | store B | 71.6% (131/183) | **30.0%** | 83.3% | 29.6% |

   **Two causes, both of which make the original unmeasurable rather than merely wrong:**
   - **`mtime` is last-EDIT, not creation** (17–33% of files touched within 24h in years-old stores),
     so *"freshly written"* and *"recently touched"* are different populations and the convenient
     statistic **cannot test the stated mechanism**, which was about creation.
   - **The selection was the observer.** Both agents found dark files among their own day's work
     because that is where they were looking and whose loss they would feel. Quantified on store B:
     the baseline predicts ~19 dark in a 27-file cohort; it found 8 — i.e. **the data contradicted
     the hypothesis and was published as support, purely because nobody divided by anything.**

   ⭐⭐⭐ **The class: ranked by the variable that was easy to reach (`mtime`) instead of the one that
   decides the outcome (inbound-link count) — and the convenient variable produced a CONFIDENT
   answer.** Second instance the same day (the first ranked encoding files by surrogate-pair count
   when boundary-proximity was the decider). Reachability of a statistic is *why* it gets used, and
   confidence is what it buys. **Compute the baseline before calling any cohort high-risk.**

   ✅ **WHAT SURVIVES — the practice, not the explanation.** *Sweep every file you touched this
   session, not just the one you noticed* is correct and **independent of recency being causal**: it
   works because those are the files whose loss you would feel. It found 2 dark files on each store.
   **Keep the sweep; drop the mechanism.**
4. **Then apply the rescued rule to your own live work.** Having restored the stale-resume-trigger file,
   I tested my own just-closed chain's trigger against it: it names "a human answers one of three
   checklist items on an open issue" — verified the issue is still open with 3 comments, so the event
   remains occurrable ⇒ **live, not stale.** Tested, not assumed. A rule you rescue and don't apply is
   still dark in the way that matters.

## The related shape, stated once
**A name that asserts a property is a claim, and needs the same measurement as a sentence asserting
it.** I shipped a block headed `ABOVE-CUT INSTRUMENT RULES` that sat *below* the cut; a peer holds a
filename asserting a unit its own body refutes. A title describing a *structural* property is the
cheapest possible place to stop looking, because it reads as though someone checked the structure.

Corollary from the same fix: **an anchor's position is a measurement, not an assumption.** My first
repair inserted before a heading that was itself past the bound — the file's first section alone spanned
34,389 chars, so "put it near the top" placed it at 34k. Map every heading's offset before choosing an
insertion point.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785964336116-sweep-reachability-across-every-file-you-touched-n.md`_
