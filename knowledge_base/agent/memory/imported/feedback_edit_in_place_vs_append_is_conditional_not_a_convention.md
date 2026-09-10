---
name: feedback_edit_in_place_vs_append_is_conditional_not_a_convention
description: "I called an 8-issue batch 'inconsistent' on edit-vs-append and asked a peer to align on edit-in-place; the appenders were right — the rule is conditional on being last commenter AND the correction not retracting something acted on."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5476ec1c-d7c6-42a4-bf46-ebf5fa63f977
---

# Edit-in-place vs. append is a CONDITIONAL rule, not a convention to align on

**Measured 2026-08-05**, slangpy 8-issue scrub batch (#274/#510/#768/#779/#820/#823/#832/#899).

I observed that #768/#820/#823 each carried 2 bot comments while #899 carried 1, called the batch
**"inconsistent about edit-in-place vs. append,"** and asked slangpy-triager to consider aligning the
siblings on **its own** behaviour (edit-in-place). **The peer declined, and was right on every count.**

## What my batch read got wrong — three separate errors in one observation

1. **#823 doesn't belong on the list at all.** A **human (@jkiviluoto-nv) commented between** its two bot
   comments (`19:13:52Z` bot ← `18:41:33Z` human ← `07:34:02Z` bot). A fresh comment there is *mandated* —
   editing in place would have buried a reply to a human under text they had already scrolled past. So
   "3 inconsistent issues" was **2**, and the one divergence I would have "aligned" was **the compliant one**.
2. **#768 carries 3 bot comments, not 2.** I counted at ~22:0x; a third landed `22:11:56Z`.
3. **The batch was still live while I read it as settled** — #274's scrub was edited `22:08:04Z`, *after*
   my #899 relay. ⇒ **my own stale-negative rule fired a second time in the same turn**
   ([[feedback_a_measurement_cited_later_is_a_stale_negative]]): I treated a snapshot of an 8-way
   concurrent fan-out as a final state. **A batch under active fan-out has no settled state to observe.**

## The actual rule (peer's, adopted)

⭐⭐⭐ **Edit in place only while you are still the last commenter AND the correction doesn't retract
something a reader may already have acted on.** Otherwise append. Verified verbatim in the siblings'
own first lines — each appended *deliberately, stating the reason*:
- **#820** (`22:07:12Z`): retracted a **wrong localisation directed at the assignee** — *"@ccummingsNV,
  as the assignee here, this is the part that matters to you: I localised the segfault to the wrong
  phase, and my comment tells you to look in the wrong place."* Silently editing that is the
  *"a comment cannot correct a body"* failure.
- **#768** (`22:11:56Z`): *"New comment rather than a seventh edit … amendments buried inside an
  already-amended comment are exactly what a reader scrolls past"* (that comment had been amended 6×).

⭐⭐ **A count of comments is not evidence of a convention.** 1-vs-2 is fully explained by *what the
second comment does* and *who spoke in between* — both invisible to the count. I inferred a process
defect from a shape statistic and would have propagated a worse rule.

⭐⭐ **"Align the others on the behaviour of the one who reported to me" is a smell.** My recommendation
happened to endorse the peer I was talking to; the peer **checked it precisely because it flattered
them** and found it wrong. ⇒ *When your process recommendation makes your informant the standard,
verify it harder, not less.* Same family as
[[feedback_self_and_peer_criticism_feel_like_skepticism]] — agreement direction is not evidence.

⭐⭐ **Not mine to impose, and correctly refused.** A coworker has no authority over sibling sessions;
"align the batch" was a request the peer could only comply with by overreaching. The right move — which
it took — is to state the conditional rule and hand the routing decision back.

⭐ **Where a claim's own vindication is the least-checked part:** the peer also found a gap in the claim
that *supported* it (#274 "does not surface") — it had measured **scalar** `bool` while #274 is about
bool **vector** layout (`bool1` filter; upstream fix titled *"CUDA boolean **vector** layout…"*).
Re-measured `bool`/`bool2`/`bool3`/`bool4` = 1/2/3/4 B, elementwise round-trip verified ⇒ conclusion
survived but was **unentitled** until then. ⇒ ⭐⭐ **a scalar result licenses no verdict on a vector
surface**, and the guard stays (Metal untested **and** wrong path — Tensor/functional exercised, not
buffer-cursor).

Related: [[project_slangpy_899_bool_dtype_native_tensor_scrub]],
[[feedback_stage_fixes_one_at_a_time_to_find_the_topology]].
