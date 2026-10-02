---
name: feedback_last_active_tracks_inbound_not_agent_work
description: "`ncl sessions get` last_active moves on HOST INBOUND delivery, not on agent work, so your own nudge refreshes it and a 20-min build looks dead. Any probe over a channel you also write to (last_active, max seq, a fixed tail window) moves with your own actions. Watch the deliverable (the bot's GitHub comments) with one batched call, a positive control and a shape assert. A 429 row means one attempt failed, not the work."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 28c13999-0f66-44db-958c-f36d72509bee
---

# `last_active` is not a liveness signal: it tracks inbound delivery

Measured 2026-08-05, first on slang#6542 and then across jkiviluoto-nv's 22-issue scrub fan-out
([[project_slang_scrub_fanout_22_issues]]). Distilled 2026-10-01. One law, seen from five angles:
**a channel you write to cannot measure what happens at its other end.**

## 1. `last_active` moves on inbound delivery

```
19:11  container writes seq 5 (out): "API Error … 429"
19:12  last_active 18:42      ← the outbound did NOT move it
19:13  I send a nudge → seq 4 (in)
19:22  last_active 19:13      ← MY message moved it
```

`last_active` answers *"when did the host last deliver INTO this session"*, never *"when did the agent
last do anything"*. Two consequences:

- **Checking it is circular.** Nudging a session refreshes the very field you would read to judge it.
- **Long tool calls are invisible.** An agent 12 minutes into a 20-minute `slangc` build writes no
  rows, so it looks exactly like a dead container. `container_status: running` is necessary but not
  sufficient: it also read `running` at the moment of the 429. Same shape as
  [[feedback_watchdog_ncl_tasks_list_empty_not_a_freeze]].

## 2. The obvious replacements are circular too

- **`seq > max_at_arm`** fired after 1 minute, on Main's **own** inbound message, because `seq` counts
  both directions. The alert said "NEW ROW **from triager**" about a `direction=in` row: the alert text
  claimed a source the predicate had never checked. Filter to rows the other party could have written
  (`out`), or watch something outside the channel altogether.
- **An error-grep over the last N rows stays on forever.** `--limit 3 | grep -ci 429` kept reporting
  a 429 that had already been handled until three new rows pushed it out. **A tail window is not a
  time window.** Gate on `seq` newer than what you already saw, *and* on direction. (`--limit` is
  also a HEAD window: [[feedback_ncl_sessions_messages_limit_returns_first_n_not_last_n]].)

⭐⭐ **Ask of every health probe: "can my own action move this number?" If it can, the probe can't
measure the other party.** "No new messages" tells you only that no report arrived, nothing about the
agent ([[feedback_in_session_monitors_dont_survive_teardown]]).

## 3. Session-level traffic is not progress

During the scrub, 17 of 25 sampled triager sessions carried a 429. Main read the fleet as stalled
twice: once from a second 429, once from session-mint counts per 10 minutes. Mint counts measure
**webhook arrivals**, not completions. The deliverable told the real story: posted `nv-slang-bot[bot]`
comments rose steadily from 9 to 12 to 16 of 22, about 6 minutes per reply, with no idle gap. A 429'd
turn is retried, and the error row stays in the session while the work moves on. ⭐⭐⭐ **A 429 row
records that one ATTEMPT failed, never that the WORK failed.**

**⇒ Watch the deliverable, not the worker.** Use the GitHub comment record, which no probe or nudge of
yours can move. Set the deadline from observed throughput, and alert on **both** outcomes (complete,
*and* still incomplete at the deadline).

## 4. The deliverable probe can be the problem: budget it

About 130 per-issue `gh api` calls plus a 7-minute polling Monitor **used up the installation's REST
quota**, and the census flipped from 16/22 to **0/22** in one sweep. Main repeated this the same
day with this rule already read (~40 calls, and the peer's loop printed `covered: 0 / 18` against a
15/18 truth). Rules, all four together:

1. **One batched call, not N.** `gh api "repos/<o>/<r>/issues/comments?since=<ts>&per_page=100"`
   covers the whole batch; `issue_url` gives each issue number. Per-issue loops are for ≤3 issues.
   (Pagination caveats: [[feedback_gh_paginate_401s_on_page2_use_explicit_pages]].)
2. **A positive control on a member you know is answered** in every sweep (#6434 caught it here).
3. **Validate the VALUE you consume, not `$?`.** Under `--jq`, `gh` writes the error JSON to
   **stdout**, so `b=$(gh api … --jq length)` captures `{"message":…}`. Require `^[0-9]+$` (or
   `jq -e 'type=="array"'`) and treat anything else as **VOID**: abort the sweep, never score it as 0.
   ⛔ Main's broadcast "gh exits 0 on a 403" was **wrong**. `gh` exits 1. The 0 came from `| head`
   ([[feedback_never_read_an_exit_status_through_a_pipe]]). And `2>/dev/null` hid a jq exit 5.
   It did not "yield null", so a null-guard would have caught nothing.
4. **A watcher that shares a quota with the work can starve the work.** Stop it when the quota is low.

⭐⭐⭐ **Here the luck was in how absurd the number was.** 0/22 is physically impossible, so it got
caught. A plausible wrong number such as 12/22 would have shipped as the stall signal. A control is
the only defence against *plausible* failures; you notice absurdity, not error. ⭐⭐ When a rule has
several parts, check them by listing each one: satisfying the memorable parts (controls, shape checks)
creates the feeling of compliance, and the dull part (the call budget) is the one that bites.

## 5. Other gotchas in the same incident

- **Two limits, independent of each other:** the model-API 429 wave (cleared 20:08) and the GitHub
  App REST quota (still live 20:36). Main declared "cleared" by checking the one that had recovered.
  **Name the resource a queued action will consume, and probe that one** (`gh api -i … | grep -i
  x-ratelimit`, a single call). `gh api rate_limit` itself returned 401 here; that is not the
  credential outage ([[project_github_actions_graphql_401_outage]]).
- **A 403'd write leaves the work done but undelivered.** That third state is invisible from both the
  owner column and the reply column ([[feedback_a_batch_census_needs_the_owner_column_not_the_reply_column]]).
- **A search hit tells you about indexed metadata, not content.** `search/issues commenter:` returned
  25 issues, and only 22 carried the scrub comment. Deduplicate on the body (`test("scrub this issue")`).
- **A 429 is throttling, not a credential fault: never escalate it as an outage.** Escalate only when
  the deliverable stops advancing. Main caused part of the saturation (35 of 61 sessions minted in one
  window), so check your own fan-out first:
  [[feedback_a_repeated_turn_error_is_a_fleet_signal_not_a_chain_signal]],
  [[feedback_pace_the_fanout_the_retry_and_the_saturation_share_a_cause]],
  [[feedback_a_fanned_out_webhook_delivers_per_issue_verify_the_set]].
- **Monitor hygiene:** send arming and progress diagnostics to stderr, because stdout is the event
  stream. Print the matched row in the alert body, and say "matched 0 rows" instead of sending a
  headline with nothing under it. A slow-work floor comes from the work's own duration: a 6-minute
  quiet threshold can't tell a 20-minute build from a dead container.
