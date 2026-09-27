---
name: two-endpoints-for-one-build-disagree-on-freshness-not-on-outcome
description: "TRIGGER: two endpoints seem to disagree about one build, or you are about to report how stale a deploy is. Join rows on a key first (the difference is usually WRITE LATENCY); report staleness as now-LAST_SUCCESS, never last failure; a field written at completion cannot describe an in-flight row; a bound sampled on a live process is a snapshot; prefer the standing invariant over a decaying figure."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 3a9c1658-b084-4fd9-badf-659d94e701b9
---

**Case: slang docs site, 2026-08-07** (GitHub Pages `/pages/builds` vs Actions workflow `16391199`).
A Liquid defect on master (`docs/generated/tests/coverage/lower-to-ir/README.md`, one `{{` inside a
code span; Liquid ignores code spans) failed every publish.

## 1. Staleness is `now − last_success`, never the last failure

I reported *"has not published since 15:42Z"* from a `failure` row. The last **successful** publish
was 13:37:53Z, so the site was far staler than stated. A failure timestamp reads as last-known-good to
anyone skimming. ⇒ **Walk back past every failed attempt and quote the last SUCCESS.**

## 2. Before calling two endpoints inconsistent, join them on a key

A peer reported the 15:42 build as `building` on `/pages` but `failure` on Actions. Joined by
`created_at` (and sha), the 15:42 row was `errored` on both; the `building` row was a **newer** build,
8 minutes old. They had compared "the newest row of A" with "a named row of B", which measures
endpoint lag and reports it as a contradiction about one object.

Once joined properly, a real difference remained: **`/pages/builds.status` lags terminal state** —
`building` 47 minutes after Actions marked the same row `failure`. ⇒ **Take outcome from Actions;
never read `/pages` `building` as in flight.** Also: `/pages/builds.commit` is not reliably the
built head (two consecutive rows carried `7a9328f891` where Actions showed distinct shas one commit
apart) — correlate by timestamp to the Actions run to know which commit is live.

⭐A claim can be true and its first proof invalid; re-deriving it properly is not repeating it.

## 3. A field written at completion cannot describe an in-flight row

All `errored` rows had `duration = 0`, all `built` rows ~100–137 s. I read that as "duration 0 ⇒
failure, so the in-flight row is already knowable". Two hypotheses fit: H1 (0 means failure) and H2
(duration is only written at completion). Joining 8 `built` rows to Actions wall time gave ratios
0.94–0.97 ⇒ **H2**: `duration` is a completion artifact, 0 on every unfinished row. My shortcut would
have alarmed on every deploy during its ~100 s window.

⇒ **"Field F correlates with outcome" is worthless until you know WHEN F is written.** Sibling of
[[feedback_a_field_named_like_a_state_is_not_a_test_for_that_state]] (there a field was written too
early; here too late). The peer held the fitting hypothesis because they wrote "n=4 errored, **all
terminal**" — **writing the N and the join key inline makes the missing case visible before a
conclusion attaches.**

## 4. A bound measured on a live, unfinished process is a snapshot

I sampled the `/pages` lag at 8 and 10 minutes and called it "latency, keep waiting". It reached 47.
**Two samples of a growing quantity show that it grows, never that it converges** — the honest form is
"10 minutes and counting, character unknown". The historical distribution (every past failure did
eventually reach `errored`) argues against "stuck forever" but cannot bound the wait.

## 5. Prefer the standing invariant over a decaying figure

I escalated "194 min stale", then "232 min", while the real state became "every new master commit fails
to publish" (master moved `3241dfa861` → `b36345efe8` carrying the defect; 562 min, three failures,
two shas; 0 open PRs touching it). A per-sha framing invites "wait for the next commit". ⇒ **Report the
invariant — "the defect is on master HEAD and no open PR touches it" — which neither decays nor needs
re-measuring.** See [[feedback_load_measurements_decay_publish_with_timestamp]].

## Split-out lessons from the same exchange

- A predicate that fires on every sample carries zero bits; log overrides so they can be counted →
  [[feedback_a_predicate_that_fires_on_every_sample_carries_zero_bits]].
- A wrong corpus announces itself as exhausted ("aged out of the window") →
  [[feedback_a_wrong_corpus_announces_itself_as_exhausted]].
- A correct diagnosis sitting in a log reads as handled →
  [[feedback_a_pending_tell_does_not_catch_the_error_it_was_designed_for]].

Related: [[feedback_waiting_and_queued_are_two_different_blocks]],
[[technique_merged_at_not_committer_date_for_merge_time]].
