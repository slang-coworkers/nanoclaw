---
name: feedback_a_prose_only_rule_loses_to_a_mechanical_counter
description: "scan.py demanded 14 nudges; 0 were warranted (13 past a prose-only ceiling, 8 false from a closed-set bot test I had already documented at tick 127 and not fixed). Encode the prose side of any gate, and treat a recorded defect as unfixed until code changes."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: cc218d86-fdf2-408c-9aa7-fb1be5173aae
---

# When a mechanical gate and a prose rule govern one decision, the gate wins — so encode the prose or delete it

**Measured 2026-08-10, supervisor tick 128 (290 in-flight chains).**

`scan.py` reported `must_nudge: 14`, backed by a deliberately hard invariant:
*"never report a tick clean while `sent_nudges < must_nudge`"* — added so an LLM
could not narrate a nudge away (the #12097 fix).

**0 of the 14 were warranted.**

## Defect 1 — the ceiling existed only in prose

SKILL.md §3: *"nudged twice with no response → escalate instead of nudging a third
time."* `scan.py` **never read `nudgedAt`**. Prior nudge counts on the 14 rows:
`4,5,5,5,4,6,6,4,3,0,7,4,5,2` ⇒ **13 of 14 already past the ceiling**, 11 already
escalated. A rule-conformant tick ships 13 messages the same document forbids.

⭐⭐⭐ **This is [[feedback_a_pending_tell_does_not_catch_the_error_it_was_designed_for]]'s
sibling and #12097 inverted.** There prose could not *suppress* a nudge, so `action`
was made mechanical. Here prose was the only place the *stop* condition lived, so
the mechanical half won and drove the wrong action. **A ceiling a counter cannot
see is not a ceiling.**

Fix: `NUDGE_CEILING=2`; ceiling-hit → `action='escalate'` (never a silent `'none'`),
excluded from `must_nudge`, counted in `must_escalate`, retained in
`must_nudge_raw` so a ceiling cannot hide a dropped row. Live effect on this tick's
own payload: **must_nudge 14 → 1**.

## Defect 2 — the closed-set bot test, 2nd occurrence

`bot_logins = {nv-slang-bot[bot], nv-slang-bot}`, no unknown branch ⇒ every
third-party bot stamped `is_bot=False` ⇒ "human spoke last" ⇒ false `awaiting_us`.
**I recorded this exact defect at tick 127** (135 comments / 8 chains, 2 nudges
retracted *after sending*) and did not patch the producer. It reproduced verbatim:
`github-actions[bot]` on slang#11225, `coderabbitai[bot]` on rhi#815 + #817. Plus
the class no list can fix — `type: User` accounts posting machine notices
(`jhelferty-nv` board sync) on #12378 #12382 #12408 #12410 #12429, one reading
*"do not reply to this comment"*. **8 of 14 false** (3 bot-typed + 5 automation-bodied).

Fix: `classify_author(login, typename, body) → (is_bot, is_automation)` on GraphQL
`author.__typename == "Bot"` (no list, cannot go stale; login list demoted to
fallback) + body markers. 9 cases with **negative controls** — `tangent-vector`'s
design proposal and `csyonghe`'s answer must stay `is_bot=False`.

## Rules

1. ⭐⭐⭐ **Encode the prose side of any decision a counter also governs, or delete
   it.** An unenforceable rule sitting beside an enforceable one reads as coverage
   while doing nothing — and the enforceable one will contradict it.
2. ⭐⭐⭐ **Recording a defect is not fixing it.** Tick 127 described the closed set
   precisely and correctly; tick 128 shipped the same false rows. A defect note
   without a code change is a prediction, not a remedy. ⇒ When I write "defect
   recorded", ask: *did a file change?*
3. ⭐⭐ **`x in SET` answers "is it one I listed", never "is it a bot".** A
   closed-set membership test needs an unknown branch or a type discriminator —
   and this one failed toward the answer that licenses work (see
   [[feedback_a_closed_set_allowlist_is_the_wrong_shape]]).
4. ⭐⭐ **Ship a negative control with every suppression fix**, proving the detector
   still fires on the real thing.

⚠️ Also caught this tick, same family: I read `ncl sessions messages --limit 8` (which
returns the **oldest** rows) as the tail and concluded a chain went dark on a
maintainer's design proposal. `scan.py` disagreed; scan was right — the response was
at seq 127, outside my window. **A query about the wrong slice is not a finding**
([[feedback_a_zero_row_query_about_a_wrong_name_is_not_a_finding]] is the same shape
with a wrong *name*). Both errors in one tick were mine reading an instrument's
scope wrong, in opposite directions: one manufactured a finding, one nearly
retired a correct rule.
