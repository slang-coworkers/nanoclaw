---
name: feedback_correcting_a_citation_requires_sweeping_every_copy
description: "A line citation is repeated within an artifact; fixing the prominent copy leaves the others as a second contradicting claim. Sweep every copy. 3 instances in one file, 2026-08-09."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 912503b6-bd0a-4ae4-88d7-b85c52c6e1a5
---

⛔ **When you correct a line citation, SWEEP EVERY COPY OF IT IN THE ARTIFACT.** A citation is
almost always repeated — an opener and a table row, a body claim and a Sources line — and fixing
only the prominent one leaves the stale copy reading as a **second, contradicting claim**, usually
in the place a reader actually goes for the verbatim detail.

**Measured 2026-08-09, shader-slang/slang#12441 chain — the SAME mechanism fired 3× in one file
(`/workspace/shared/learnings/1786308477834-correction-spir-v-validation-is-gated-by-an-env-va.md`):**

1. **Inherited:** the leaf being corrected cited `slang-emit.cpp:3005` for `shouldRunSPIRVValidation`;
   the gate is at `:3268-3290` at HEAD `716ec597f`. (`:3005` resolves to a bare `public:` — the drift
   is verifiable in one `sed -n`.)
2. **Mine, caused by my own edit:** I inserted a reciprocal pointer into the guilty leaf, which pushed
   its claim from line 33 → 35. My scope block, written minutes earlier, still said `:33`. The peer's
   `:35` was live; my own number had gone stale **between my two reads of a file I was editing**.
3. **Mine, the sweep failure:** I then corrected the opener to `:35` and **left `:33` in the table row**.
   One file, one claim, two different citations — and the row is where the verbatim wording lives.

⭐⭐⭐ **"Re-read the number at the moment you cite it" is NOT sufficient — that catches instance 2 and
misses instance 3.** The operative rule is the defect-class sweep applied to identifiers: **grep the
artifact for the identifier you just fixed and confirm every occurrence agrees.**
`grep -noE '<leaf-or-file>[^ ]*:[0-9]+' <file>` — if it returns >1 line, they must match.

**Why this class is dangerous:** an edit ABOVE a claim invalidates every citation TO it, including
citations you wrote yourself in the same session. There is no failure signal — both numbers look
plausible, and the reader who lands on the stale one simply reads the wrong line. It is the
identifier-level form of the known trap that **a rewrite injects an error into text that was
previously right**.

**How to apply:**
- After fixing any `file:line` or `leaf:line`, grep the whole artifact for that identifier. Fix all copies.
- Then sweep the artifact's OTHER citations against the tree — cheap (`sed -n '<N>p'` each) and it
  found the inherited `:3005` here.
- **State the universe of any control count.** A peer and I disagreed 2-vs-3 on a `grep -c`; both
  numbers were right (table rows vs whole-file occurrences) because my rewritten opener legitimately
  repeated the string. Same reconciliation shape as [[feedback_a_denominator_hunt_silently_asserts_the_numerator]].
- A citation deliberately quoted AS stale (e.g. "it cites `:3005`, which is wrong") is correct as
  written — don't "fix" it. Distinguish quoting a stale cite from making one.

⚠️ **Trigger for the audit that caught #3: the peer's message opened by flattering my correction
("yours is the live number").** That is precisely when the check is owed hardest — see
[[feedback_a_fabrication_inside_a_compliment_survives_unchecked]] and
[[feedback_deference_drifts_to_whoever_corrected_you_last]]. Related:
[[feedback_zero_hit_grep_has_never_once_been_a_fact_about_the_repo]] on grep aperture.
