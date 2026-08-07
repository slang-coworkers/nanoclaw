---
name: feedback_a_timeout_is_not_a_decision_verify_the_ask_was_delivered
description: "⛔ `ask_user_question` IS STRUCTURALLY UNDELIVERABLE from a task/cron-born session (thread_id=system:tasks:*, messaging_group_id NULL): the card is persisted to pending_questions AT :389, the routing guard RETURNS at :415, deliveryAdapter.deliver at :426 is NEVER REACHED — and the row is marked `delivered` anyway. It has NO `to:` parameter, so it can only use the session's own null routing; send_message/send_file take an explicit `to:` and land. ⇒ A REPORTED TIMEOUT IS NOT A DECISION AND NOT EVEN EVIDENCE OF SILENCE. THE TELL: `platform_message_id IS NULL` on the `delivered` row (status='delivered' is worthless). I re-asked TWICE through the identical broken path, reading my own undeliverable card as operator inaction. timeout=0 is WORST here — waits forever for a card nobody can see; a finite timeout returns 'Question timed out', which reads as THE OPERATOR DECLINED — a false claim about a person's behaviour manufactured by a routing bug. From a task session escalate with send_message to a named destination, never ask_user_question."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 238e835c-d627-4ed8-bd6d-cd1c2e4361e5
---

# ⛔ A TIMEOUT IS NOT A DECISION — and it is not even evidence of silence

**Measured 2026-08-05, Main, session `sess-1785907636205-jn3lk8`.** A held filing decision on the three
`ncl` flag defects sat 15 hours across **three** `ask_user_question` calls (05:20Z, 14:03Z, 17:09Z), each
reported as a timeout. **The operator was never shown any of them.** My re-ask task even opened with *"a
timeout is NOT a decision"* — correct, and I then re-ran the same undeliverable path twice.

## Mechanism — the persist happens ABOVE the routing guard

`ask_user_question` writes its card from `getSessionRouting()`. A **task-born session**
(`thread_id=system:tasks:<series>`, `messaging_group_id: NULL`) resolves to
`channel_type: null, platform_id: null`. `src/delivery.ts`:

```
:389   createPendingQuestion({...})                                          // persists
:415   if (!msg.channel_type || !msg.platform_id) { log.warn(...); return; } // RETURNS HERE
:426   await deliveryAdapter.deliver(...)                                    // never reached
```

Row marked **delivered**, `pending_questions` well-formed, nothing above `warn`, no adapter called.
The tool then polls `findQuestionResponse` to its deadline and reports a timeout.

**Root cause of the asymmetry: `ask_user_question` has NO `to:` parameter.** `send_message`/`send_file`
take one and resolve a real `(channel_type, platform_id)` from `destinations`. Host-side approval cards
are unaffected — `ncl approvals list` shows them carrying `channel_type=dashboard,
platform_id=dashboard-admin` **explicitly**.

## The control — same session, same minute, one variable

| row | routing at write | `platform_message_id` | seen |
|---|---|---|---|
| `ask_question` 14:03Z | `null`/`null` | **NULL** | ❌ |
| `ask_question` 17:09Z | `null`/`null` | **NULL** | ❌ |
| `send_message(to:…)` 20:23Z | `dashboard`/`dashboard:main` | `dash-…-atmcmf` | ✅ |
| `send_file(to:…)` 20:23Z | `dashboard`/`dashboard:main` | `dash-…-i5r5d9` | ✅ |

```bash
python3 -c "import sqlite3;print(sqlite3.connect('/workspace/inbound.db').execute(
  \"select message_out_id,platform_message_id,delivered_at from delivered where message_out_id like 'msg-%'\").fetchall())"
```

⭐⭐ **`status='delivered'` IS NOT EVIDENCE OF DELIVERY. `platform_message_id IS NULL` is the tell.** The
success field is written by the code path that returned early; the id can only be written by an adapter
that actually ran. **Prefer the field that only the far side can produce.**

⚠️ **SCOPE THE TELL — it holds for USER-FACING rows only.** Caught 20:27Z while verifying this very
finding: my `append_learning` row (`kind='system'`, all three routing fields null) is also
`delivered` + `platform_message_id NULL`, and that is **correct** — system actions are consumed
host-side, never handed to an adapter. Applying the rule unscoped flags every `system` row as a
failed delivery. ⇒ **Test it on `kind='chat-sdk'` / `kind='chat'` rows; a null id on `kind='system'`
is expected.** A tell derived from one row class silently mis-fires on another — the same
wrong-granularity shape as
[[feedback_zero_test_jobs_is_not_zero_tests_ran]], caught here only because I re-read the row I was
about to cite as a control.

## ⛔⛔⭐⭐⭐ 2026-08-07 — THE SCOPING CLAUSE ABOVE IS ON THE WRONG AXIS. `kind` is not the discriminator; `channel_type` is.

**How it surfaced:** I relayed this tell to `slang-fixer` as *"check `platform_message_id IS NULL` on the
delivered row"*. Two defects in sequence, its find, both mine:
1. ⛔**I named the field without the table.** It is `inbound.db/delivered`
   (`message_out_id, platform_message_id, status, delivered_at`) — **NOT** `outbound.db/messages_out`, which
   has no such column. It looked there and got an unrunnable test. **This file's own query above is correct;
   I dropped the table when relaying it.** ⭐*A citation that omits the table is a wrong citation.*
2. ⛔⛔**Once runnable it was VACUOUS — and that is the dangerous defect.** On its a2a edge: 14 delivered
   rows, **0 non-null**, including four `[Fix Report]`s I had *demonstrably received and replied to*. The
   test returned *"never shown to a human"* for messages that provably arrived. ⭐⭐**A runnable-but-vacuous
   test is worse than an unrunnable one, because it returns an answer** — and here the false positives are
   indistinguishable from true ones, with no arithmetic tell.

✅**MINE-MEASURED, 54,362 delivered rows — this supplies the off-diagonal cell its edge could not see:**
| channel_type | kind | platform_message_id | n |
|---|---|---|---|
| `dashboard` | chat | **SET** | 1,033 |
| `dashboard` | chat-sdk | **SET** | 15 |
| **`agent`** | **chat** | **NULL** | **1,667** |
| `agent` | system | NULL | 3 |
| `None` | system | NULL | 51,476 |
| `github` | chat | NULL | 1 |

⇒ **All 1,048 non-null rows are `channel_type='dashboard'`. Every one of the 1,667 `channel_type='agent'`
rows is NULL.** Mechanism: `platform_message_id` can only be written by a **platform adapter**. a2a delivery
is container→container through session DBs — **there is no adapter**, so NULL is correct and universal there.
⇒ ⛔**`kind='chat'` on an `agent` channel is NULL BY CONSTRUCTION — i.e. the scoping clause above points a
reader at exactly the row that cannot inform them.** The tell is valid **only on platform-channel rows.**

⚠️⭐⭐**Its prescribed fix (population check: if `count(platform_message_id)==0` the test is dead) is
NECESSARY BUT NOT SUFFICIENT — it passes on my edge and is still vacuous.** My global non-null count is
**1,048**, so a global population check says *"live"* — and applying the tell to an `agent` row is then still
meaningless. ⇒ **The population check must be SCOPED TO THE channel_type UNDER TEST:**
```sql
-- run this FIRST, for the channel_type of the row you are about to judge
select count(*), count(platform_message_id) from delivered d
  join messages_out m on m.id = d.message_out_id      -- messages_out is in outbound.db
 where m.channel_type = :ct;                          -- 0 non-null ⇒ the tell is dead for :ct
```
⇒ ⭐⭐⭐**A mixed-traffic edge defeats a global instrument-liveness check.** Two of us wrote a guard for this
class in the same exchange and both put it at the wrong granularity — its version too coarse (global), mine
too coarse in a different direction (`kind` not `channel_type`). **Asserting the column EXISTS would not have
caught either; asserting it is populated GLOBALLY would not have caught mine.** Same wrong-granularity family
as [[feedback_zero_test_jobs_is_not_zero_tests_ran]], now committed twice in one thread.

✅**Its own case, settled on its edge and NOT by this tell:** a2a-born (`thread_id=gh-issue-…-9636`, populated
`source_session_id`), `session_routing` populated (`channel_type='agent'`), card present as `kind='chat-sdk'`
with non-null `platform_id` ⇒ the `:415` guard **cannot** have fired; the 600 s expiry was a deliverable card
simply unanswered at 01:10 UTC. ⇒ ⭐⭐**SCOPE THIS WHOLE FILE'S BUG: task/cron-born sessions ONLY. a2a-born
sessions are structurally exempt** — tighter than originally written.
⭐**Why it came out right: I gave it the discriminator, not the verdict.** Had I asserted "your timeout was
the routing bug", it would have inherited my error. ⭐**And it refused a test I authored, on measurement,
against the author** — the correct move, and the reason both defects are on this page.
⛔**DO NOT ship this tell into a skill without the per-`channel_type` population check as line one.**

## ⇒ Rules

- **From a task/cron session, escalate with `send_message` to a named destination. NEVER
  `ask_user_question`.** Every scheduled task runs in exactly this kind of session, so **every cron-fired
  operator escalation across the fleet is affected**.
- **`timeout: 0` is actively dangerous here**, despite being documented as the safe choice for "a human
  decision with no acceptable fallback": from a task session it waits *forever* for a card nobody can see.
  A finite timeout is worse than useless — "Question timed out" reads as *the operator declined*, **a
  false statement about a person's behaviour, manufactured by a routing bug.**
- ⭐⭐⭐ **Before treating "no answer" as an answer — or re-asking — prove the question was DELIVERED.**
  Re-asking through an unverified channel is not diligence; it manufactures more silence and burns the
  operator's apparent credibility for a fault that is mine.
- ⭐⭐ **Generalizes past this bug: when an instrument reports THE OTHER PARTY did nothing, first prove
  your message reached them.** Sibling of [[feedback_a_thread_id_on_a_message_tag_loses_to_your_own_session_thread]]
  (dispatch ≠ delivery) — but sharper, because here the dispatch side actively **reported success**.
  Same family as [[feedback_a_null_from_an_instrument_with_no_field_is_an_unasked_question]]: an unasked
  question rendering as an absence.
- ⭐ **The `ask_question` row's own `thread_id` was correct** (`system:tasks:…`) — so a thread check would
  have passed. Only the `(channel_type, platform_id)` pair was empty. **A partially-correct routing record
  passes a partial audit.**

## Fixes to propose upstream (recorded in the write-up)

1. Don't mark an `ask_question` row delivered when nothing was — move `createPendingQuestion` below the
   guard, or throw at `:415` so it enters the retry / `markDeliveryFailed` path.
2. Fail the tool call immediately and **distinguishably** ("this session has no chat address — no one can
   be asked") rather than blocking then reporting a timeout. The two states must never render identically.
3. Give `ask_user_question` an optional `to:`, or fall back to the agent group's dashboard messaging group
   as the host's own approval flow already does.

Write-up: `/workspace/agent/reports/ncl-sessions-list-flag-defects.md` (defect 4, filed separately from
the three `ncl` flag defects in [[feedback_ncl_sessions_list_agent_group_flag_not_filtering]]).
Shared-learning copy in `/workspace/shared/learnings/`.
