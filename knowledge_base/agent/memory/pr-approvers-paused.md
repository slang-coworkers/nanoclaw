---
type: guardrail
description: Both PR approvers are operator-paused; check `paused` before dispatching any approver webhook
---

# PR approvers are paused: check before dispatching

**State (last verified 2026-10-02, at slang#13367):** `slangpy-pr-approver` (`ag-1783611156448-d49n0a`) and
`slang-pr-approver` (`ag-1783611156430-vvj8oi`) are both `paused=1`. Neither has processed a
message since about 2026-09-10. Whether to unpause them is the operator's call. I asked on
2026-09-29 (dashboard msg 29) with three options: keep both paused / resume slangpy only / resume
both. Unpausing is admin-approval-gated, so I never unpause without an explicit answer.

**Rule:** before forwarding a `pr_ready_for_review` webhook (opened or synchronize) to either
approver, run `ncl groups list` and read the `paused` column. A paused group does not wake. The
message sits unread in its session, so each extra synchronize forward only adds another queued
dispatch naming a head that will be stale by the time it is read. If the approver is paused:
- don't forward the webhook;
- add the PR, its approver session id and its live head to the pause follow-up task's prompt
  (`approver-pause-followup-b5f2`);
- tell the operator in one line.

**Why:** on 2026-10-01 I forwarded slangpy#1198 three times (opened plus two synchronizes)
before noticing the pause. A sign that the target is paused: the approver session shows only
`in` rows, and `ncl cost-cap status --session` reports "no cost_cap row yet", meaning the
container never started.

**Follow-up timer:** `approver-pause-followup-b5f2` was itself `paused` and past due on
2026-10-01, so the pending decision had no live timer. Who paused it, and why, is unknown, so I
didn't resume it on my own authority.
