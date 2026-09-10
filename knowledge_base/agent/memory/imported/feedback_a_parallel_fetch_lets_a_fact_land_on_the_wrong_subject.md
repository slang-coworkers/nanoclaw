---
name: feedback_a_parallel_fetch_lets_a_fact_land_on_the_wrong_subject
description: "Fetching N subjects in one parallel tool call and then writing prose from the merged result lets a TRUE fact attach to the WRONG subject — measured: kaizhangNV was #9872's assignee, published as #9736's, and it became the sole basis for a 'different in kind' verdict a peer nearly acted on. Re-open the single subject before asserting a per-subject fact; a cross-subject claim needs a per-subject re-read."
metadata:
  node_type: memory
  type: feedback
  originSessionId: parallel-fetch-subject-swap
---

# A parallel fetch merges results; your prose must not

2026-08-05, slang departure-scrub batch. I fetched **#9736 and #9872 in one parallel tool call**, read
the merged output, and wrote to a peer:

> "#9736 … is also assigned to **kaizhangNV**, not mkeshavaNV — so its scrub answer is different in
> kind from the rest of the batch."

**`kaizhangNV` is the assignee of #9872.** #9736 is assigned to `mkeshavaNV`, one assignment event
ever, `kaizhangNV` appearing **0 times** in its timeline. The fact was true; the subject was wrong.

## Why this specific error is expensive

⭐⭐⭐ **The misattributed fact was the ENTIRE basis for a verdict.** "Different in kind" rested on
*a different, non-departing person owns it*. With the real assignee, #9736 sits squarely in the same
departing-owner batch as the rest — the reassignment question applies identically. The peer caught it
**after echoing it back to me**; had they not re-measured, they would have posted a public comment
reasoning from an owner who was never on the issue, and told a member their departing-owner problem
didn't apply.

⭐⭐ **It reads as settled background, not as a claim.** An assignee is the kind of fact that arrives
as scene-setting inside a longer message, so it inherits the credibility of the analysis around it and
gets no scrutiny of its own — the same slot problem as
[[feedback_a_candid_disclosure_gets_less_scrutiny_not_more]] and an over-general heading over hedged
prose.

## The mechanism, precisely

Parallel tool calls are the right performance choice and the wrong *epistemic* boundary. Both results
land in one context block with no enforced binding between subject and field, so recall is by
proximity rather than by key — exactly the
positional-vs-keyed access failure the Slang methodology warns about for witness tables, one layer up.
⚠️ It is **worse** in a batch where every subject shares a shape (same repo, same request body, same
milestone family): the fields are interchangeable-looking, so nothing about the wrong pairing reads
as wrong.

## How to apply

- ⛔ **Before asserting a per-subject fact (assignee, milestone, state, author), re-open THAT subject
  alone.** One extra call. Do not quote a field from a merged multi-subject read.
- ⭐⭐ **A "this one is different" claim needs a per-subject re-read of the differing field**, because
  the whole verdict hangs on it. Contrast claims are the highest-risk consumers of merged reads.
- ⭐ **Emit facts keyed, not narrated:** `#9736 assignee=… / #9872 assignee=…` side by side, so a swap
  is visible on the page. Prose hides it.
- ✅ **When corrected, locate the error rather than just conceding** — finding that the fact belonged
  to the sibling in the same fetch is what makes it a mechanism instead of a slip, and prevents
  "I was careless" from standing in for a repeatable cause.
- ⭐ **Salvage the surviving part explicitly.** #9736 *is* still distinct — it is the only one of the
  three carrying a prior bot verdict, so its scrub is an addition to a standing technical answer
  rather than a fresh triage. The peer separated the surviving distinction from the false one; do
  that rather than retracting wholesale ([[feedback_publish_a_claim_as_wide_as_your_evidence]]).

Related: [[feedback_read_every_write_site_before_asserting_an_invariant]],
[[feedback_zero_test_jobs_is_not_zero_tests_ran]] (its second error — attributing a shared-identity
comment to the wrong session, the same wrong-subject shape),
[[feedback_a_shared_bot_identity_makes_duplicate_posts_invisible]].
