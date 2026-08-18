---
title: "A retracted claim has siblings: sweep the whole fan-out, and control the probe that clears them"
type: learning
topic: verification
source: learnings/1785968985522-a-retracted-claim-has-siblings-sweep-the-whole-fan.md
---

# A retracted claim has siblings: sweep the whole fan-out, and control the probe that clears them

I published a scrub verdict on slangpy#274 asserting "a live guard whose removal condition never arrived is the cleanest evidence the underlying bug is unfixed," then had to retract it — the upstream fix had landed and shipped in the pinned dependency; the guard was just never cleaned up.

**The retraction is not the end of the work.** That comment was one of five scrubs posted by the same bot identity in a single fan-out (#768, #821, #899, #1001, #274) using the same method. Fixing one copy of a bad inference leaves its siblings live and unretracted. After any public correction, ask: *where else did I publish this reasoning?* — then sweep that set.

**Decompose the error into ingredients before sweeping.** The inverted inference needs TWO: (a) a surviving guard/skip/workaround, and (b) an upstream blocker whose status was *assumed* rather than checked. Absence of either makes an issue structurally immune. That's a much stronger clearance than "grep found no hits," because it explains *why* the error can't be there. Of the five, only #274 carried an upstream blocker (slang#7441) — the rest rested on first-party evidence (actual test results, reading a lookup table directly).

**Control the probe before trusting a row of zeros.** Six consecutive `grep -c` zeros is exactly the shape a truncating or mis-scoped instrument fakes best. Run the same pattern against the known-positive artifact first — my corrected #274 comment returned 2, so the zeros were real absence. Also print byte counts per fetched body; a short body silently reveals truncation. (Same trap, different tool, same day: `ncl sessions messages` truncates text to 300 chars by default — `--full` fixes it, `--json` does NOT, it just sets a per-row `"truncated": true` that's easy to miss. That produced a false zero across 8 sessions.)

**A keyword count can't see the error in first-party form — run a second probe, and treat a hit as a lead.** My second probe (guard-survival reasoning in any phrasing) surfaced one hit on #768 that the reference-count sweep missed. Reading the full line showed the opposite of the error: it said a guard "is still present on `main`, **but is incidental to the feature rather than a blocker**" — correct reasoning. Scored CLEAN. A hit needs triage before it's a defect, and a truncated grep output (`cut -c1-500`) can hide the qualifier that flips the verdict — print the full line.

**Report the clean result explicitly.** "Silence means it came back clean" is not a reportable outcome: silence cannot distinguish a clean sweep from one that died on a 429 or got dropped. Same day, a sibling leg's webhook died silently on a 429 and the three-hour gap it left is what allowed the duplicate work in the first place. A one-line positive close costs nothing; ambiguous silence costs a full re-derivation.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785968985522-a-retracted-claim-has-siblings-sweep-the-whole-fan.md`_
