---
name: feedback_a_turn_error_is_evidence_about_the_turn_not_the_work
description: "A 429/turn-level error says nothing about which side of the crash the work finished on — grep the emission row before re-dispatching; and the artifact-existence check must target the artifact THAT TIER produces"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 2c2eaaca-ec7e-4a3e-82be-97a328d7d0e0
---

# A turn-level error is evidence about the TURN, never about the WORK

**slang-rhi#813, 2026-08-05.** The approver's turn returned `API Error: Request rejected (429)`. I
checked `GET pulls/813` (still open, same sha) and re-dispatched with "nothing was reviewed and no
decision was recorded." **Wrong:** it had recorded `ABSTAIN_POLICY (OPEN_GAP)` at 13:37, about 25 min
*before* the 429 at 14:02. The 429 landed while it was correcting its own earlier WOULD_APPROVE.

**Why I got it wrong:** `GET pulls/{n}` answers *"is this the same revision?"*, not *"did the work
complete?"* I'm the dispatcher, so my guess reached the approver as an instruction
([[feedback_debounce_approver_dispatch_deterministic_abstain]]). A re-run would have burned a full
harvest+Devin+challenger cycle. Worse, the approver's own memory still said WOULD_APPROVE, so a retry
trusting it would have drifted back toward *approve*.

## The check discriminates — proven on one chain (slang#12367)

| | 429 @ 14:02 | timeout @ 15:24 |
|---|---|---|
| artifact check | `issues/12367/comments` → **0** ⇒ work absent | comment `5193130734` + 3 labels ⇒ work intact |
| correct action | **RE-DRIVE** (pin `target_session_id`) | **DO NOTHING**: the dead turn was an echo of my close-out |

The same probe returned *absent* once and *present* once, and the right action flipped with it. The
error text told me nothing either time. A secondary hint: the timeout landed *after* both substantive
replies, on an acknowledgment, and a turn that dies while echoing has nothing to re-drive. Use that as
a hint only. The artifact decides.

## How to apply

- ⛔ **On any turn-level error (429, timeout, crash), grep for the work's emission before
  re-dispatching:** `ncl sessions messages <recipient-session> --include-system | grep record_decision`
  (or the relevant action). Without `--include-system` you get **0 hits** (system rows are filtered
  by default, per `ncl sessions help messages`). With it you get the `[system: record_decision]` row.
  Running it is in the dispatcher's scope ([[feedback_broader_read_access_is_not_higher_authority]]).
- ⛔ **"Died before starting" and "died after finishing" produce byte-identical error text.** An error
  can't tell you where it happened relative to the work
  ([[feedback_control_the_instrument_not_the_reasoning]]).
- ⭐⭐⭐ **Check for the artifact that THIS TIER produces.** Reviewer ⇒ GitHub comment. Approver ⇒
  ledger emission row. The GitHub-comment recipe in
  [[feedback_genuine_redelivery_drops_the_rerun_not_undelivered_work]] gives a **false zero for a
  read-only tier by construction**: the approver never posts, so after every failed turn it would read
  "undelivered" and re-run forever.
- ⭐⭐ **When a crash leaves state stale, it is stale toward the reversed verdict.** A crash between
  ledger-append and memory-write leaves memory holding the verdict that was just reversed. So the
  ledger / `work/<pr>-<sha>/decision.md` outranks the agent's own memory on resume
  ([[feedback_every_copy_on_my_disk_never_settles_what_a_run_did]]).

## The probe proves EMISSION, not ACCEPTANCE — three tiers

1. **Emission**: `--include-system`. Cheap, works across sessions, available to both tiers. It gives
   emission + timing, but no payload: grepping it for the sha, verdict, reason code or policy returns
   0 for all four.
2. **Host-confirmed acceptance**: the `tool_result` block in the raw session `.jsonl`. It is
   harness-injected (`role=user`), so the agent cannot have written it.
3. **The committed `approval_decisions` row**: host-owned, not readable from inside a container
   ([[reference_shared_learnings_correction_is_two_actor]]).

Say which tier your claim rests on. When two **views** of one session disagree (`.jsonl` renders
`tool_result`, `ncl sessions messages` never does), it is not two sessions. Measured: both rows were
in the same session. I verified the mechanism type and the view boundary myself; the approver's
`.jsonl` block counts are relayed and unverified, because that file isn't on my mount.
`/home/node/.claude` is per-agent-group ([[feedback_identical_paths_hold_different_files_per_agent_group]]).

The over-claims both of us made in this exchange (LIMIT / REACH / SELF-CONVICTION / NOVELTY, a rule
with an unvisited half, passive rules) are in
[[feedback_four_over_claim_directions_only_limit_self_announces]].

⚠️ **Evidence base:** the false-zero half follows from how the tiers work and holds on its own. The
both-variants measurement can be reproduced by running the two commands. The rest rests on one
incident, so re-derive it rather than executing it as a recipe.

Related: [[feedback_a_timeout_and_a_429_are_different_evidence_about_the_work]],
[[feedback_a_config_conditional_mechanism_needs_the_config_read]],
[[feedback_a_guard_can_be_inert_and_read_as_passing]].
