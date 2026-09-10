---
name: feedback_genuine_redelivery_drops_the_rerun_not_undelivered_work
description: "Confirming a duplicate trigger is a genuine redelivery licenses dropping the RE-RUN — never skipping work whose artifact was never delivered; check the artifact exists, not just that the trigger repeated"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 923efebb-f582-4c0a-8373-9ce7d67b41d0
---

# "Genuine redelivery" ≠ "nothing to do"

2026-08-05, nanoclaw#1079. A second byte-identical `pr_ready_for_review` webhook arrived. I ran the
correct debounce discriminator ([[feedback_debounce_approver_dispatch_deterministic_abstain]]):
`head.sha` unchanged (`02a5426`), `merged_at` unchanged, 0 comments, 0 reviews ⇒ **genuine
redelivery, confirmed.** The reflex that follows "genuine redelivery" is *drop it*.

That reflex would have been wrong here: **the review from the first delivery had never been
posted.** The first turn ended after verifying merged-blob hashes, before publishing. So the
duplicate trigger was the only remaining prompt to deliver work that existed but had never shipped.

**Why:** the debounce rule exists to prevent *doing the work twice*. It says nothing about whether
the work was ever *delivered once*. Those are different predicates, and the redelivery check only
measures the first. Conflating them converts a duplicate-suppression rule into a silent
work-dropping rule — the same failure shape as a chain that "looks done" and gets no dispatch.

**How to apply:**
- ⛔**Before dropping a duplicate trigger, check for the ARTIFACT, not just the trigger's sameness.**
  Concretely: `gh api repos/<r>/issues/<n>/comments --jq '.[]|.user.login'` — is *my own* output
  actually on the PR? Zero bot comments on a chain I believe I reviewed means the work is
  undelivered, whatever the trigger says.
- ⭐⭐**Two questions, two instruments:** *"has this event already been processed?"* (head sha /
  merged_at / delivery id) vs *"does my output exist where it belongs?"* (fetch the comments,
  reviews, or file). Answering the first does not answer the second.
- ✅The correct log line is "redelivery confirmed; artifact absent ⇒ posting" or "redelivery
  confirmed; artifact present at `<id>` ⇒ dropping". Naming the artifact forces the check.

## Second case, opposite outcome — slang#6434 (08-05): artifact PRESENT ⇒ drop the re-run

A peer's turn errored **429** and it re-sent its whole report, flagging it as a possible duplicate.
Same two predicates, and this time the artifact check **passed**: exactly **one** bot comment on the
issue (`5196133459`, 5562 B, `nv-slang-bot[bot]`) against a non-zero control of 4 total comments, and
`state`/`assignees`/`milestone`/`labels` all still at their pre-scrub values. ⇒ **the 429 cost a
message, not an artifact** — so the correct action was to drop the re-run and post nothing new.

⭐⭐ **This is the rule's other arm, and it's what makes it a rule rather than a bias toward re-doing
work.** Case 1: trigger repeated, artifact absent ⇒ *do the work*. Case 2: trigger repeated, artifact
present ⇒ *drop it*. The artifact check decides; the trigger's sameness never does. A version of this
lesson that only ever fires in the "post anyway" direction would manufacture duplicate public
comments on every transient API error.

⭐ **A 429 on the reporting hop is the high-frequency generator of this shape** — the work and the
publish already happened, only the *narration* failed. Check the public surface before assuming a
failed turn means failed work; and prefer a duplicate-suppressing read over a "just re-post to be
safe," because the artifact is public and the message is not.

✅**EVIDENCE BASE: THREE incidents** (nanoclaw#1079 absent→post, slang#6434 present→drop,
slang#6572 present→drop). The two predicates are structurally distinct and both arms are now
observed, so this is past the single-case hypothesis stage — but still name the artifact in the log
line rather than executing from memory.

## Third case, and the sharpest one — slang#6572 (08-05): TWO 429s, work COMPLETE in between

⛔ I read two identical `429` errors from the same peer as *"the same failure, twice"* and armed a
retry after each. **They were different events.** The 1st (19:11) was a real pre-work failure — the
2nd (20:08) came **26 minutes AFTER the triager had posted a 5,800-byte scrub comment** to GitHub
(`5196537512`, 19:42:52). The 429 was **the reporting hop dying on a completed task**.

⇒ ⭐⭐⭐ **A retry is a claim that the work did not happen. I made that claim twice without ever
checking the artifact — and my second retry re-dispatched a fully-finished job, telling the peer
"nothing has been posted to GitHub; the issue is untouched" when a comment was already live.** The
`<github-post-authorized />` marker rode along with it, so the only thing standing between that
false premise and a duplicate public comment was the peer's own artifact check, not mine.

⭐⭐⭐ **The failure was a MISSING PRECONDITION, not a wrong action.** Both retries were locally
defensible; neither was licensed, because *"is the artifact absent?"* was never asked. **An error
message is evidence about a hop. It is silent about a deliverable — and it looks exactly the same
whether the deliverable exists or not.**

⭐⭐ **N identical errors on one chain are not N instances of one failure — sequence matters.**
[[feedback_a_repeated_turn_error_is_a_fleet_signal_not_a_chain_signal]] correctly says to sample the
fleet on error #2 (and the fleet WAS saturated here: 24 running triager containers, 19 sessions born
in one hour, 429s in 10/10 sampled siblings — all true, all irrelevant to whether #6572 was done).
**Fleet-wide corroboration made the retry feel MORE justified while the artifact check was still
unrun** — breadth of evidence substituting for the one decisive question, the exact shape of
[[feedback_zero_test_jobs_is_not_zero_tests_ran]].

✅ **One command, before any retry, unconditionally:**
`gh api repos/<r>/issues/<n>/comments --jq '.[]|"\(.created_at) \(.user.login)"'` — a bot comment
timestamped **after** the dispatch means the work landed and the retry must be cancelled. Cheaper
than the retry it prevents, and it reads the public surface no failed turn can perturb
([[feedback_last_active_tracks_inbound_not_agent_work]]).

Related: [[feedback_debounce_approver_dispatch_deterministic_abstain]] (the debounce rule this
bounds), [[feedback_a_guard_can_be_inert_and_read_as_passing]],
[[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]].
