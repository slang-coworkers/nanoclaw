---
title: "A rule that only exists in prose cannot stop a mechanical counter that demands the opposite"
type: learning
topic: misc
source: learnings/1786321998894-a-rule-that-only-exists-in-prose-cannot-stop-a-mec.md
---

# A rule that only exists in prose cannot stop a mechanical counter that demands the opposite

# Two supervisor defects, one shape: the enforceable half and the advisory half disagreed

**Measured 2026-08-10, supervisor tick 128 (shader-slang/slang + slangpy + slang-rhi, 290 in-flight chains).**

`scan.py` reported `must_nudge: 14`. The skill also carries a fails-loudly
invariant: *"never report a tick as clean while `sent_nudges < must_nudge`"* —
built deliberately so an LLM cannot narrate a nudge away (the #12097 fix).

**Of those 14 rows, 0 were actually warranted.**

## Defect 1 — the nudge ceiling was prose-only

SKILL.md §3 says: *"If a chain has been nudged twice with no response, escalate
instead of nudging a third time."* But `scan.py` **never read `nudgedAt`**. So
`must_nudge` counted a chain's 8th nudge identically to its 1st, and the
fails-loudly invariant then *demanded* the 8th.

Prior-nudge counts on the 14 rows: `4,5,5,5,4,6,6,4,3,0,7,4,5,2`
⇒ **13 of 14 already past the ceiling**, 11 of them already escalated.

A rule-conformant tick would have shipped 13 messages the same document forbids.

⭐⭐⭐ **This is #12097 inverted.** There, prose could not *suppress* a nudge, so
the fix was to make `action` mechanical. Here, prose was the only place the *stop*
condition existed — so the mechanical half won and drove the wrong action.
**A ceiling a counter cannot see is not a ceiling.**

Fix: `NUDGE_CEILING = 2`; a ceiling-hit row returns `action='escalate'` (never a
silent `'none'`), is excluded from `must_nudge`, counted in `must_escalate`, and
retained in `must_nudge_raw` so a ceiling can never hide a dropped row.
Reconcile `sent_nudges == must_nudge` AND `sent_escalations == must_escalate`.
Live effect on this tick's own data: **must_nudge 14 → 1**.

## Defect 2 — the bot discriminator was a closed set (2nd occurrence)

`bot_logins = {"nv-slang-bot[bot]", "nv-slang-bot"}` with no unknown branch, so
every third-party bot was stamped `is_bot=False` ⇒ "a human spoke last" ⇒ false
`awaiting_us`. I **recorded this at tick 127** (135 comments / 8 chains, 2 nudges
retracted after sending) and did not fix the producer — so it reproduced exactly:

- `github-actions[bot]` last on slang#11225
- `coderabbitai[bot]` last on slang-rhi#815 and #817

Plus the sibling class no login list can fix — `type: User` accounts posting
machine notices (`jhelferty-nv` board sync) on #12378 #12382 #12408 #12410 #12429.
One body literally reads *"do not reply to this comment"*.

**8 of 14 rows false in total** (3 bot-typed + 5 automation-bodied).

Fix: `classify_author(login, typename, body) -> (is_bot, is_automation)` keyed on
GraphQL `author.__typename == "Bot"` (needs no list, cannot go stale; login list
demoted to a pre-`__typename` fallback) plus body markers for human-account
automation. 9 unit cases including **negative controls** — `tangent-vector`'s
design proposal and `csyonghe`'s answer must stay `is_bot=False`, so the fix
suppresses noise without blinding the detector. An unlisted bot
(`newbot-nobody-listed[bot]`) is now caught by `__typename` alone.

## Transferable rules

1. ⭐⭐⭐ **When a mechanical gate and a prose rule govern the same decision, the
   gate wins by default.** Encode the prose side or delete it — an unenforceable
   rule beside an enforceable one reads as coverage while doing nothing.
2. ⭐⭐⭐ **Recording a producer defect is not fixing it.** Tick 127 documented the
   closed set precisely and correctly, then tick 128 shipped the same false rows.
   A defect note without a code change is a prediction, not a remedy.
3. ⭐⭐ **A closed-set membership test needs an unknown branch or a
   type-discriminator.** `login in SET` answers "is it one I listed", never "is it
   a bot" — and it fails toward the answer that licenses work (nudging).
4. ⭐⭐ **Every suppression fix needs a negative control in the same commit**,
   proving the detector still fires on the real thing.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786321998894-a-rule-that-only-exists-in-prose-cannot-stop-a-mec.md`_
