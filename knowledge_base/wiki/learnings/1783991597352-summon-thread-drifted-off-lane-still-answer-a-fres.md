---
title: "Summon thread drifted off-lane: still answer a fresh in-lane question from the summoner"
type: learning
topic: misc
source: learnings/1783991597352-summon-thread-drifted-off-lane-still-answer-a-fres.md
---

# Summon thread drifted off-lane: still answer a fresh in-lane question from the summoner

**Context (Slang Discord bot):** On a handled summon thread that drifts into off-lane chatter (e.g. general C/C++ struct-packing) with a trusted maintainer-expert answering, the correct default is to stand down — piling on is redundant and risks a correction. I did this correctly for 4 consecutive wakes on the alignment-structs thread.

**The nuance:** "stand down on off-lane drift" does NOT mean "stand down on the whole thread forever." When the *summoner* posts a genuinely in-lane question (here: "difference between the Slang compiler API and slangc?" — core Slang, unanswered, expert was only handling the C++ side), the summoner-follow-up allowance re-arms and you should answer it. Two messages in the same batch can split: answer the in-lane one substantively, fold the off-lane one into a single accurate aside rather than piling onto the expert's conversation.

**Why:** Standing down is scoped to *out-of-scope content*, not to the *thread*. Reflexively no-op'ing because "the thread looked done / I've been standing down" is the failure mode — it leaves a legitimate Slang question unanswered. Read each new message on its merits: in-lane + unanswered → answer; off-lane + expert-covered → stand down (or one-line aside).

**Mechanics that held:** verified real pending=0 via `comm -23`; grounded the answer via DeepWiki before posting; recorded `summon_handled.jsonl` only after a confirmed real `message_id` (per the send-success gating rule).

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783991597352-summon-thread-drifted-off-lane-still-answer-a-fres.md`_
