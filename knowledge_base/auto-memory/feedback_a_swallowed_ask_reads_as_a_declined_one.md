---
name: feedback_a_swallowed_ask_reads_as_a_declined_one
description: "ask_user_question from a session with messaging_group_id=null is persisted, marked delivered, NEVER shown — so its timeout is indistinguishable from the operator declining. Check the precondition before reading a timeout as a decision."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 1a34bfff-4251-417e-8c21-c9bb5b5c5ab9
---

⭐⭐⭐ **A timed-out `ask_user_question` is not evidence the operator chose anything.** From a session
with `messaging_group_id: null`, the ask is persisted, marked delivered, and **never shown**
(nanoclaw defect 4: `delivery.ts:389` persists, `:415` returns on null routing, `:426` never runs).
The turn just sits for the full timeout and returns "timed out" — **byte-identical to a human who
read it and walked away.**

**Measured 2026-08-06 on slang#12371.** I asked the operator to pick A1-vs-A2 / stack-vs-master with
`timeout: 600`. It timed out. My next thought was "holding is an acceptable fallback" — i.e. I was
one step from recording *operator chose to hold* as the outcome of a question **the operator never
saw**. `ncl sessions get <my-session>` → `messaging_group_id: None`. Precondition confirmed; the
question was swallowed, not declined.

**Why:** `ask_user_question` needs routing to reach a platform id. A webhook-born session
(`thread_id=gh-issue-...`, no messaging group) has none. `send_message(to:'orchestrator-dashboard')`
resolves a real destination and **does** deliver — verified.

⇒ **Before treating any ask's timeout as a decision, check `messaging_group_id` on your own
session.** Null ⇒ the ask was never delivered; re-ask via `send_message` to a named destination.

⛔ **CORRECTION 2026-08-06 — "Non-null ⇒ a timeout is real silence" WAS FALSE and is retracted.**
Non-null is **not sufficient**: the group must be a **human** channel. Measured on `slangpy-fixer`
`sess-1785828882066-1vf3vp` (thread `gh-issue-shader-slang/slangpy-823`, container `running`):
`messaging_group_id = mg-a2a-1781015554102-07ituc`, i.e. **`channel_type=agent`**, `platform_id
agent:ag-…-sqxdef:ag-…-ht5rv2`. Its asks are **delivered — to a peer AGENT** — and arrive as
**contentless inbound messages** (I received one; the a2a formatter has no rendering for a question
card). Session rows show the loop: `out chat-sdk [system: ask_question]` at 08-05 15:28, 08-06 13:07,
16:09, **19:13** — one every few hours, each answerable by nobody.

⇒ ⭐⭐⭐ **The precondition is `channel_type`, not nullness.** `null` ⇒ swallowed silently. `agent` ⇒
delivered to a bot as an empty message. Only a human channel makes a timeout mean silence. **Two
distinct defects with the same symptom**, and my null-only rule declared the second one healthy.
⭐⭐ **An empty inbound from a peer is a SIGNAL, not noise** — here it was the only externally visible
trace of a deadlocked chain (supervisor asks "are you blocked?" → fixer answers with a card → card
reaches an agent edge → nobody answers → repeat).

⇒ **In a webhook/`gh-issue-*` session, don't reach for `ask_user_question` at all** — it is the
common case for null routing. Use `send_message(to:'orchestrator-dashboard')` from the start.

⛔ **The generalization is worse than the tool bug.** This is the failure class where a
**null result is silently reinterpreted as a substantive one**: no error, no exception, no log —
the absence of an answer wearing the costume of an answer. Cf.
[[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]] (an errored command's zero read as a
measured zero) and [[feedback_published_negative_env_claims_need_rederivation]] (a capability
negative that logs nothing because readers comply by not attempting). **Ask what a
never-delivered / never-run / never-attempted case would look like, and confirm it doesn't look
exactly like the answer you're about to record.**

✅ **What I did right, and the rule it generalizes to:** I found this only because I read the
*neighbouring* scheduled task before acting — a `ncl-filing-decision-nudg` task whose prompt opened
with `⛔ ask_user_question is SWALLOWED from sessions with no messaging group (defect 4)`. A sibling
session had already measured it (870 of my sessions without a messaging group vs 61 with; slang-triager
0 without / 421 with) and written the warning into a task prompt where it would be read at the moment
of use. ⇒ **When a gate times out, read what other sessions already recorded about that gate before
interpreting the silence** — and when you discover an instrument defect, park the warning where the
next caller will trip over it, not only in a memory file.

⚠️ **A hold still needs a trigger you control** ([[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]]).
After re-asking I armed `i12371-hold-guard-1424` (`*/30`, script-gated) on **two** external gates —
#12353 merging and any non-bot comment on #12371 — and **tested both wake branches, not just the
silent one** (retargeted the issue axis at an issue with human comments ⇒ `wakeAgent:true`; the PR
axis at a merged PR ⇒ `wakeAgent:true`; bogus PR ⇒ no false wake). A guard verified only in its
"no" state is a guard you have not tested.

## ⛔⭐⭐⭐ 2026-08-08 — I DIAGNOSED THE SWALLOWED CARDS AS "EMPTY MESSAGES FROM A COWORKER", TWICE, AND BLAMED THE SENDER

Two "empty" inbound rows arrived from `slangpy-fixer` (2026-08-07 15:36, 2026-08-08 03:46). I traced the sender's session correctly, found the right session, and **mis-attributed the ROW KIND** — then told the coworker their sends were arriving empty and offered to raise a platform defect on their behalf. **They refuted it with the one field I never checked:**

```
ncl sessions messages sess-1785828882066-1vf3vp
  seq 37  out  chat-sdk  2026-08-07 15:36  [system: ask_question]      <- what I called "an empty send"
  seq 45  out  chat-sdk  2026-08-08 03:46  [system: ask_question]
  15 rows kind=chat-sdk  vs  only 4 real kind=chat outbounds (08-04 07:37, 08-04 12:32, 08-05 00:27, 08-06 22:15)
```

⇒ ⭐⭐⭐ **THE COWORKER SENT NOTHING. A DROPPED `ask_user_question` CARD RENDERS ON THE RECIPIENT SIDE AS AN EMPTY INBOUND MESSAGE** — so a swallowed ask does not merely read as *declined* (this file's original finding); **it reads as a DEFECTIVE SEND BY THE ASKER.** The failure mode inverts the blame: the party whose question was eaten looks like the party emitting garbage.

⇒ ✅ **THE DISCRIMINATOR IS THE `kind` COLUMN, AND IT IS FREE.** `kind=chat` = a real message; `kind=chat-sdk` + body `[system: ask_question]` = a card. I read the `text` column (empty) and the timestamp (matching) and **never read the column that names what the row IS.** ⭐⭐ **A row's TEXT being empty is a fact about its rendering; its KIND is a fact about its identity** — same trap family as reading a status field that lags versus a field written at the outcome.

⭐⭐⭐ **AND THE CADENCE THEY MEASURED IS THE REAL FINDING, WHICH MY WRONG DIAGNOSIS WAS OBSCURING:** the last 9 cards fire on a **fixed ~183-minute interval** (verified by me: 182/182/184/183/183/181/183/183 min across 08-06 22:15 → 08-08 03:46, 15 cards total). **That is a re-arm loop, not a decision being awaited** — and `container_status: running` on that one session while 27 siblings show `stopped` is the corroborating tell. ⇒ **A gate that re-asks on a fixed cadence is not waiting; it is looping, and the fix belongs on the ASKER's side (stop re-arming, act on the decision) not the answerer's.**

⛔ **The part that is squarely mine: the decision it was waiting for had been made on 08-07 and never delivered to the session holding the gate.** I had recorded the A+C resolution in my own memo (`project_slangpy_823_tensorview_interop_buffer_noncuda.md`) — void gate, close-as-WNF and land-the-guard are compatible, propose `jhelferty-nv` as reassignment — and left the owning session to keep asking. ⇒ ⭐⭐⭐ **A DECISION RECORDED IN MY STORE BUT NOT SENT IS INDISTINGUISHABLE, FROM THE WAITER'S SIDE, FROM A DECISION NEVER MADE.** Sibling of *diagnosing a defect in a log is not fixing it*, applied to a decision instead of a defect. Fixed by `send_message` with `target_session_id=sess-1785828882066-1vf3vp` **pinned** (the session has 15 unanswered cards; default routing would have minted a cold one) plus the canonical `thread_id`.

✅ **Their refusal to tier-skip is the right call and worth recording as correct behaviour:** they declined to reach into a sibling session to break the loop, and asked me to re-dispatch on the canonical thread instead. **A coworker declining to fix another session's loop is respecting the edge rules, not being unhelpful.**

⚠️ **Mechanical note they hit: `/workspace/shared/` is `EROFS` to coworkers**, so a published learning cannot be edited — a correction must go up as a **second** `append_learning`. Consistent with what I measured on 08-07 (rw for Main, ro for everyone else) and the reason index amendments route through me.
