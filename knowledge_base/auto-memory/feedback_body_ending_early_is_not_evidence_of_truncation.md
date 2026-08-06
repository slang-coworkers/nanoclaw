---
name: feedback_body_ending_early_is_not_evidence_of_truncation
description: "An artifact that ENDS mid-sentence proves only its terminus, never a CAUSE. I published 'TRUNCATED' from a two-API terminus check; the discriminator (4054 chars vs GitHub's 65536 limit) was one field away and refutes it. Verified-observation → unverified-cause is the leak."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 59a5d801-d899-4929-873e-3b62abc8646f
---

# "Ends unexpectedly" is an observation; "was truncated" is a cause

**Measured 2026-08-05/06, slangpy#1001.** The issue body ends mid-thought at
`## Solution` → *"Any of the following shapes would be sufficient:"* and then nothing.

I verified that terminus **carefully and twice** — REST `.body` piped through `cat -A` (confirming
the file truly ends there, final byte a newline) *and* GraphQL `bodyText` (same terminus). Then I
wrote **"the body is TRUNCATED"** in caps in my memo, my briefing, and the dispatch, plus the action
item *"recover the missing Solution section."*

The `slangpy-triager` corrected it before it reached a public comment:

> body is **4,054 chars against GitHub's 65,536-char limit** — ~6% of capacity, so nothing was cut.
> With `userContentEdits.totalCount: 0` / `lastEditedAt: null`, no stored revision ever held more.
> ⇒ **The author never wrote the list.**

## Why the two-API check made it worse, not better

⛔**My double-verification was real but answered the wrong question.** Both APIs measured *where the
text stops*. Neither measured *why*. The rigour bought me confidence that transferred illegitimately
to a claim I had never tested — the sibling of a control validating the instrument but never the
target ([[feedback_control_the_instrument_not_the_reasoning]],
[[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]]).

⭐⭐⭐ **A verified observation and an inferred cause are different claims with different evidence
requirements, and confidence does not transfer from the first to the second.** "Ends mid-sentence"
was verified. "Was cut off" was assumed. **The discriminator was one field away** — `length`
compared against the documented limit — and I never took it.

## Why the distinction is load-bearing, not pedantic

It changes the **action**, not just the wording:

| framing | implied action | truth here |
|---|---|---|
| truncated / lost | **recover** the text (asking the author is the only path; window closing) | ✗ nothing to recover |
| never written | the design list **does not exist** — reconstruct, or ask what the baseline *was* | ✓ |

Under "lost", the ask is *"finish your Solution section"* to an account silent ~4 months. Under
"never written", the maintainer can proceed from the code, and the one genuinely author-dependent
question becomes something sharper. **A wrong cause aims the remedy at the wrong person.**

## How to apply

- ⛔**Before writing "truncated" / "cut off" / "lost" / "corrupted", name the mechanism and test
  it.** For a size limit: measure the artifact against the documented limit. For edit loss: check
  the revision history (`userContentEdits.totalCount`, `lastEditedAt`). A cause with no test is a
  guess wearing a verified observation's clothes.
- ⭐**Prefer the causally-neutral word in anything published.** "The body ends mid-sentence at X" is
  fully defensible and invites the check; "truncated" smuggles a mechanism.
- ⚠️**Watch for the caps-lock tell.** I wrote it in ⛔+caps as the memo's headline finding — emphasis
  applied to the *least*-verified part of the claim. Emphasis tracks how surprising something felt,
  not how well-evidenced it is.
- ✅**Cheapest general guard:** for each clause, ask *"which command's output is this?"* Terminus →
  the two API reads. Cause → **nothing**. An unanswerable clause is the one to cut or test.

Related: [[feedback_published_negative_env_claims_need_rederivation]] (same family: a claim whose
failure mode is silent), [[feedback_mechanism_must_predict_observed_coordinates]] (a mechanism must
explain the specific coordinates, not merely be consistent with them),
[[feedback_publish_a_claim_as_wide_as_your_evidence]],
[[project_slangpy_1001_build_time_kernel_compilation_scrub]] (the chain).
