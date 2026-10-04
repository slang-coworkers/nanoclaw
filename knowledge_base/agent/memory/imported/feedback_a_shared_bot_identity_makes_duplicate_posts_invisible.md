---
name: feedback_a_shared_bot_identity_makes_duplicate_posts_invisible
description: "A fan-out to N sibling sessions under ONE bot identity can double-post on the same issue, and GitHub cannot tell you which session wrote which comment. Count OUR comments per issue (author + created_at > dispatch) across the WHOLE batch, not per-chain; and never treat a reply census as stable — it drains while you read it, so a zero is 'not yet', not 'dropped'."
metadata:
  node_type: memory
  type: feedback
  originSessionId: shared-identity-duplicate-post
---

# A shared bot identity turns a fan-out into an unattributable double-post risk

**2026-08-05, slang.** `jkiviluoto-nv` fanned a departure-scrub request across 23 issues in ~25 s.
Each webhook minted its own triager session, and every one posts as `nv-slang-bot[bot]`: about 21
concurrent writers under one identity. **#10181 got two scrub comments 10 s apart with different
bodies** (`5196891201`, `5196892695`). A full batch scan found it was the only double.

## Why it is invisible by default

- ⛔ **The author field can't attribute the write.** Both comments say `nv-slang-bot[bot]` (the same
  trap as [[feedback_zero_test_jobs_is_not_zero_tests_ran]]).
- ⛔ **Per-chain hygiene can't see it.** Each session asked "have *I* posted?" and correctly got *no*.
  The defect only exists at the batch level.
- ⚠️ **Two different bodies are worse than two identical ones.** Redundancy is noise; two
  disagreeing verdicts do damage.

## The census drains while you read it

Across three reads minutes apart, #7209 went 0 → 1 and #10181 went 0 → 2. ⇒ **A zero means "not
yet", not "dropped."** A "these N got no reply" list handed out as licence to re-post creates exactly
this duplicate. Check the artifact **immediately before** posting, never from a list
([[feedback_genuine_redelivery_drops_the_rerun_not_undelivered_work]]).

## Enumerating the batch: two filters localize the error

- `assignee:` gave **19**. Searching the phrase gave **23**, which included **#4126**, closed in 2024:
  its "scrub of issues" comment came from 2024 and had nothing to do with the departure. The real
  batch was **22**.
- ⭐⭐⭐ **A single filter's count can't be falsified from inside itself; two disagreeing filters
  localize the error.** The two filters were wrong in opposite directions, and only the diff exposed
  both. Bound a batch by **phrase AND time** (`created_at > <fan-out start>`), and look at any member
  whose state contradicts the batch's premise.
- Instrument traps from the same task: `test("bot")` matched `github-actions[bot]`, so match the
  login exactly and gate on `created_at > dispatch`. An apostrophe in a search phrase gave a **false
  zero at exit 0**. A 422 *"users do not exist"* is a better control than a clean 0, because it proves
  the filter was applied.

## The sweep: the right predicate (trigger: a fan-out, OR a timeout on any one chain)

A timeout cuts a *running* turn, so it can leave work half-published
([[feedback_a_timeout_and_a_429_are_different_evidence_about_the_work]]). **The signal tells you a
failure mode, not which chain was hit.** My own chain (#7209) was clean, but #12367, which had timed
out 5 h earlier, had 3 bot comments. Sweep the population, not the chain the signal arrived on.

Measured over 88 issue threads:

| predicate | hits / 88 |
|---|---|
| `>1 bot comment` | **35**: useless; long healthy chains (#11709 has 46) |
| `>1` and gap `<20 min` | 23: mostly self-corrections |
| tight gap **and neither referenced the other as originally posted** | **1** (#10181): the real double |

⭐⭐⭐ **The signature is INDEPENDENCE plus a tight gap, not multiplicity.** A session that iterates
names its predecessor ("Correction to my previous comment"). A true double-post can't, because
neither session knows the other exists. Tie the check to **post time**, not to a scan window: #10181's
cross-reference was added **by edit, after both posts** (`updated_at > created_at`). A head-300
window separated the known cases only by luck. Corollary: #10181 had already been repaired before
the sweep found it, so finding a double-post doesn't mean finding an unhandled one.

⛔ **My first sweep returned a confident false zero.** A BRE `sed` alternation failed on all 88
threads, and the summary line still printed "0". ✅ **Fix: run a positive control as the sweep's first
action** (assert #12367 has ≥2, `exit 1` otherwise). ⭐⭐ The control must also **discriminate**:
every *filter* (e.g. the exculpatory regex) needs a cell it must match, not just every probe.

## Population counts are scope-relative

`ncl sessions list --limit 5000` gave **421** for the peer (`cli_scope: group`) and **2297** for me
(`global`, 19 groups). Both were correct. ⛔ **Compare `cli_scope` before reconciling a count with a
peer.** The list also defaults to a 200-row head window, so enumerate the population instead of
sampling it ([[feedback_ncl_sessions_messages_limit_returns_first_n_not_last_n]],
[[feedback_ncl_sessions_list_agent_group_flag_not_filtering]]; that list is also column-shifted when
`messaging_group_id` is empty).

## How to apply

- ⭐⭐⭐ **On any fan-out under a shared identity, or after a timeout on any chain:** enumerate the
  set from its defining artifact, then flag pairs of our-bot comments with a tight gap where neither
  referenced the other at post time.
- ⭐⭐ **Route cleanup to the tier that owns the state.** Say that the *differing* verdicts are the
  problem, and don't guess which sibling wrote which comment.
- ⭐ **Watch the deliverable, not the workers** ([[feedback_last_active_tracks_inbound_not_agent_work]]),
  and **don't retry into a saturated fleet**
  ([[feedback_a_repeated_turn_error_is_a_fleet_signal_not_a_chain_signal]]).

The meta-pattern that recurred four times in this batch (correct actions with the wrong stated
reason) is in [[feedback_right_conclusion_adjacent_reason]].

Related: [[feedback_a_fanned_out_webhook_delivers_per_issue_verify_the_set]] (the delivery half),
[[feedback_a_batch_census_needs_the_owner_column_not_the_reply_column]],
[[feedback_publish_a_claim_as_wide_as_your_evidence]],
[[feedback_a_live_artifact_read_is_a_measurement_with_a_timestamp]],
[[feedback_a_parallel_fetch_lets_a_fact_land_on_the_wrong_subject]],
[[feedback_a_shape_dependent_figure_migrates_between_sibling_shaders]] (what the #12367 sweep found),
[[feedback_broader_read_access_is_not_higher_authority]].
