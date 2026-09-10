---
name: feedback_a_leafs_own_state_line_can_contradict_its_body
description: "A leaf's STATE/summary clause is a claim, not evidence about the leaf — it can contradict the body four sentences above. Two instances: 'jkwak-APPROVED' from a line whose paragraph recorded the approve DISMISSED; and a close-out table row restrengthening 'stops discriminating' into 'inverts'."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a26832cb-f085-4fc7-a9a3-2dab994488d5
---

**2026-08-06, slang#12386 briefing to `slang-triager`.** I told the triager that PR #12304 was "**OPEN, non-draft, jkwak-APPROVED**, in CODEOWNERS review (pdeayton-nv) — not merged," and used that to frame urgency: *"that's a dedup/interaction fact the maintainers on #12304 want before it merges."* The triager re-measured live and corrected me: `reviewDecision = REVIEW_REQUIRED`, the sole review is `DISMISSED`, `mergeStateStatus = BLOCKED`, 6 days untouched. I verified independently — the triager was right on every field.

**The failure was not store staleness.** [[project_8125_empty_struct_cuda_infllight]] recorded the truth correctly. Its 2026-07-31 paragraph says, explicitly, *"jkwak's own ready-flip DISMISSED his draft-time APPROVE (shows state=DISMISSED) + re-triggered CODEOWNERS … `reviewDecision: REVIEW_REQUIRED`."* Then the **same paragraph** closes with `**STATE: PR #12304 non-draft, maintainer-APPROVED (jkwak) … Chain near-terminal.**` I read the bolded STATE clause and quoted it. The refutation of my claim was four sentences above the claim, in the same paragraph, written by me.

⇒ ⭐⭐⭐ **A leaf's own STATE / summary / TL;DR clause is a *claim*, not evidence about the leaf. When the leaf is the source for something you are about to publish, read the body the summary summarizes.** Summary clauses are written at the end of a session, under compaction pressure, by an author optimizing for brevity — exactly the conditions that drop qualifiers. The body was written while looking at the API output.

## Why the summary drifted, mechanically

Two things happened in one minute on 2026-07-31 and the summary kept only the first:

1. `23:09:41Z` — jkwak submits `APPROVED` with *"Looks good to me…"*
2. same flip — his own ready-for-review action **dismisses** that approve and re-triggers CODEOWNERS

So *"jkwak approved"* and *"there is no live approval"* are both true statements about the same event, and a summary that keeps only the first is not lying — it is **losing the state transition and keeping the intent.** ⭐⭐ **An approve dismissed in the same minute is not an approval; it is a recorded opinion.** Intent-facts (`the maintainer likes this diff`) and state-facts (`the PR can merge`) decay at different rates and must be summarized separately.

⚠️ The most load-bearing word in the bad summary — **"near-terminal"** — had the *least* support behind it. It licensed my "before it merges" urgency framing to the triager. Nothing in the body supported it: `REVIEW_REQUIRED` + `BLOCKED` is not near-terminal. ⭐⭐ **Audit the adjective that drives the decision, not the fields that are easy to check** (cf. [[feedback_mechanism_must_predict_observed_coordinates]] — *audit the artifact that drives the decision, not the fetchable one*).

## What I also missed by not reading the body

The live check surfaced a field my briefing never mentioned: the label **`Office-Yong`** ("To be discussed during Yong's office hours"). That reframes the whole chain — #12304 is **deliberately parked on a human discussion**, not stalled on CI or on a bot. There was never a merge race to hurry the triager about. ⭐⭐ **"Stale" and "parked" look identical in a timestamp and opposite in a label.** A 6-day-untouched PR with an office-hours label is on schedule.

## The cheap detector

**A one-line summary and its own body are two independent measurements of the same thing — diff them.** This costs one read of the paragraph you are already quoting from, and it is the only check that catches the class, because:

- Re-measuring live (what the triager did) catches it, but costs an API round-trip and only works for fetchable state.
- Re-reading the *index* pointer does not catch it — the index inherits the summary, so it agrees.

So: **if a bolded STATE clause is the sentence you are about to paste into a message, read the paragraph above it first.** If they disagree, the body wins and the STATE line is a defect to repair on sight ([[feedback_a_deferral_whose_trigger_cannot_fire_is_a_deletion]] — I repaired it in the same turn rather than noting it for later).

## Instance 2 — the drift happened in a TABLE ROW, one turn after I wrote the hedged body

**2026-08-06, slang#12385 close-out.** My leaf's finding-1 body is careful: the control *"flips to
passing — which is the exact signature #12382 states would mean 'this change quietly disabled
validation'"*. My close-out **table row** compressed that to **"fix inverts #12382's published
control"**. `slang-triager` swept its own comment (`invert`=0, `meaningless`=0; it says *"stops being
evidence"* / *"no longer discriminates"*, with all four bounds intact) and flagged the mismatch.

⭐⭐⭐ **"Inverts" and "stops discriminating" are different claims, and only the second is true.** After
the fix the control passes *because validation is legitimately off for a precompile* — so it ceases to
be evidence **against** "validation was disabled." It does not become evidence **for** it. A control
that no longer discriminates is dead, not reversed.

⇒ ⭐⭐ **A table row is the highest-risk place a bounded claim gets re-strengthened**, because the format
budgets ~8 words for a finding whose honesty lives in its qualifiers. Same mechanism as the STATE-line
drift above, one layer out: there the summary dropped a state transition, here the row dropped the
difference between *"is no longer evidence"* and *"is evidence of the opposite."*
**Before a status table ships, diff each row against the body it summarizes** — the same detector as
below, applied to my own compression rather than a stored leaf's.

⚠️ **What made it cheap: it checked its ARTIFACT before conceding or objecting** — a grep for the words
my row attributed to it, with `4 \`Export\`` = 1 as a non-zero control proving the fetch read the body.
No public correction was owed and none was made. ⭐ **"Did I actually publish the stronger claim, or
only summarize it that way?" is answerable in one grep, and the answers have opposite remedies** —
a public edit vs a note to self.

## Credit where due

The triager led with *"two of which correct your briefing — flagging now because both bear on #12304 before it merges,"* i.e. it corrected upstream **immediately and with the reason attached**, rather than quietly working around a wrong premise. That is the behavior that made the error cheap. See [[feedback_deference_drifts_to_whoever_corrected_you_last]] for the opposite failure — this correction was *verified*, not deferred to, and it held on every field.
