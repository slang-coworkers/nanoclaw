---
title: "ask_user_question is undeliverable from a task-born session — a timeout is a routing bug, not a decision"
type: learning
topic: agent-ops
source: learnings/1785961647102-ask-user-question-is-undeliverable-from-a-task-bor.md
---

# ask_user_question is undeliverable from a task-born session — a timeout is a routing bug, not a decision

# ⛔ `ask_user_question` from a session with NO messaging group is persisted, marked delivered, and NEVER SHOWN

**Measured 2026-08-05 (Main, `ag-1776713211742-1w6l4e`).** Three asks over 15h on one held filing
decision all "timed out." The operator was never shown any of them.

## The mechanism

`ask_user_question` writes its card using `getSessionRouting()`. A **task-born session**
(`thread_id=system:tasks:<series>`, `messaging_group_id: NULL`) resolves to
`channel_type: null, platform_id: null`. In `src/delivery.ts` the ordering is fatal:

```
:389   createPendingQuestion({...})                                          // persists
:415   if (!msg.channel_type || !msg.platform_id) { log.warn(...); return; } // returns HERE
:426   await deliveryAdapter.deliver(...)                                    // never reached
```

Row marked **delivered**, `pending_questions` well-formed, nothing above `warn` logged, no adapter
called. The agent then polls until timeout and reports *"the operator did not answer."*

## Why `send_message` works and this doesn't

`send_message` / `send_file` take an explicit `to:` that resolves a real `(channel_type, platform_id)`
from `destinations`. **`ask_user_question` has no `to:` parameter at all** — it can only use the
session's own routing. Host-side approval cards are unaffected: `ncl approvals list` shows them
carrying `channel_type=dashboard, platform_id=dashboard-admin` explicitly.

## The control that settles it (same session, same minute)

| row | routing at write | `platform_message_id` | seen |
|---|---|---|---|
| `ask_question` 14:03Z | `null`/`null` | **NULL** | ❌ |
| `ask_question` 17:09Z | `null`/`null` | **NULL** | ❌ |
| `send_message(to:…)` 20:23Z | `dashboard`/`dashboard:main` | `dash-…-atmcmf` | ✅ |
| `send_file(to:…)` 20:23Z | `dashboard`/`dashboard:main` | `dash-…-i5r5d9` | ✅ |

`SELECT message_out_id, platform_message_id FROM delivered` in the session's `inbound.db`.
**`status='delivered'` is not evidence of delivery — `platform_message_id IS NULL` is the tell.**

## ⇒ Rules

- **From a task/cron session, escalate with `send_message` to a named destination. Never
  `ask_user_question`.** Scheduled tasks run in exactly this kind of session, so every cron-fired
  escalation is affected.
- **`timeout: 0` is actively dangerous here.** Documented as the safe choice for "a human decision with
  no acceptable fallback"; from a task session it waits *forever* for a card nobody can see. A finite
  timeout is worse than useless — it returns "Question timed out," which reads as *the operator
  declined*, a false statement about a person's behaviour manufactured by a routing bug.
- ⭐⭐⭐ **A TIMEOUT IS NOT A DECISION, AND IT IS NOT EVEN EVIDENCE OF SILENCE.** Before treating "no
  answer" as an answer — or re-asking — verify the question was *delivered*: check
  `platform_message_id` on the `delivered` row. I re-asked twice through the identical broken path,
  each time reading my own undeliverable card as operator inaction.
- ⭐⭐ **Generalizes past this bug: when an instrument reports the OTHER PARTY did nothing, first prove
  your message reached them.** Sibling of "dispatch ≠ delivery" — here the dispatch side actively
  reported success.

## Fixes to propose upstream

1. Don't mark an `ask_question` row delivered when nothing was delivered — move `createPendingQuestion`
   below the routing guard, or throw at `:415` so it enters the retry / `markDeliveryFailed` path.
2. Fail the tool call immediately and distinguishably ("this session has no chat address — no one can be
   asked") instead of blocking then reporting a timeout.
3. Give `ask_user_question` an optional `to:`, or fall back to the agent group's dashboard messaging
   group as the host's own approval flow already does.

Write-up (4 defects, this one separate from the three `ncl` flag defects):
`/workspace/agent/reports/ncl-sessions-list-flag-defects.md`.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785961647102-ask-user-question-is-undeliverable-from-a-task-bor.md`_
