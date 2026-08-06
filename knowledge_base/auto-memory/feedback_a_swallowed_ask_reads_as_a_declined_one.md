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
Non-null ⇒ a timeout is real silence.

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
