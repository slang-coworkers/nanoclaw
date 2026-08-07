---
name: feedback_a_waiting_metric_names_an_actor_verify_the_state_permits_the_wait
description: "I escalated '0 reviews in 19 days' as the blocker on a DRAFT PR — GitHub never solicits review on a draft, so the figure was expected, and my framing pointed a human at the wrong actor"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 35469e7f-5e4c-4768-9736-7c4a31447a3b
---

# A "waiting on X" figure implicitly accuses X — check the state even permits X to act

**2026-08-06, slang#12155.** I escalated to the operator dashboard: *"PR #12155 has sat at **0 reviews / 0 comments** since 2026-07-18 … it's draft+BLOCKED and can't progress without one"*, and closed my summary calling it **"the real blocker."** True figure. Wrong meaning.

The triager checked it because *an escalation figure is read by a human*, and Main-verified via API:
- `draft: true` — and **`ready_for_review` events = 0** across the full paginated timeline. It has never left draft.
- Sole review event: `review_requested actor=jhelferty-nv reviewer=jkwak-work @ 2026-07-18T16:27:47Z` — **13 seconds after creation**, i.e. a request registered *against a draft*.
- **GitHub does not solicit review on a draft.** So "0 reviews in 19 days" is the *expected* output of the state, carrying ~no information about any reviewer.

⛔ **The damage is directional, not numeric.** "Waiting on review" invites a human to go chase `jkwak-work` — and in the same breath I had told the triager *not* to route to jkwak (the issue had moved to `zangold-nv`). My own escalation pointed at the actor I had just ruled out. The actionable fact was entirely different: **nobody has flipped the draft**, and the PR's author is **`nv-slang-bot[bot]` — it is our own draft**, so the un-flipped state is ours to surface rather than a maintainer's oversight.

⭐⭐⭐ **Any "waiting N days on X" metric is a latency claim about X. Before publishing it, verify the state PERMITS X to act.** If the artifact is draft / closed / blocked / unassigned / unpublished, the wait is structural and naming a party is a false accusation with a human's attention attached. The question is not *"how long has it been?"* but *"was the thing I'm measuring ever solicited?"*

✅ **Cheap discriminators, both one API call:**
- `ready_for_review` event count — `0` means the review clock never started, so review-latency is undefined, not large.
- Precedent check: on this repo, #12115 sat similarly until a **human (`szihs`) flipped draft→ready himself**; only then did real `pull_request` CI and review begin. A draft-held bot PR waiting on a human ready-flip is the *normal* shape here, not an anomaly.

⚠️ **Companion trap, same PR:** **`mergeable_state=blocked` on a draft is NOT a merge conflict.** Draft status alone produces `blocked`; `mergeable: true` on the same object confirms no conflict. I had been carrying `BLOCKED` in status tables as if it were a merge problem. ⇒ read `mergeable` before interpreting `mergeable_state`.

## Why this belongs with the dedup error
Same session, same message, same shape as [[feedback_a_dedup_claim_i_relayed_as_verified_was_my_own_unrun_search]]: **a figure whose absence-of-signal I read as a substantive finding.** There: an empty search = "no matches" (it hadn't run). Here: zero reviews = "neglect" (they were never requested). ⇒ ⭐⭐**Absence of a signal has two causes — the thing didn't happen, or the thing was never solicited/measured — and escalation-grade claims require ruling out the second.** The peer caught both, and in both cases the trigger was the same discipline: *this figure is going to a human, so re-derive it.*

**Related:** [[feedback_published_negative_env_claims_need_rederivation]], [[feedback_a_dedup_claim_i_relayed_as_verified_was_my_own_unrun_search]].
