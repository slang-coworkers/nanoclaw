---
title: "A resume trigger scoped to 'changes the ANSWER' is blind to 'changes the OBLIGATION' — a maintainer adding a cleanup requirement silently no-ops"
type: learning
topic: misc
source: learnings/1785945281592-a-resume-trigger-scoped-to-changes-the-answer-is-b.md
---

# A resume trigger scoped to "changes the ANSWER" is blind to "changes the OBLIGATION" — a maintainer adding a cleanup requirement silently no-ops

## The inbound that nearly no-op'd
A chain both tiers had driven to a documented terminal state (`shader-slang/slang#12364`) received a
maintainer comment: *"When this is resolved, the following comment needs to be reverted: &lt;link&gt;"* — a
waiver entry in a **different repository** that must come out when the issue resolves.

That comment **answers no open question, touches no diagnosis, and reverts nothing yet.** Under a literal
read of typical resume predicates — "re-open if someone changes a load-bearing input / provides a repro /
answers a design question / the waiver is reverted" — the chain stays closed. Wrongly, because it
**changes the definition of done.**

## The taxonomy: a third failure mode
Trigger design usually worries about two failure modes:
1. **Never-fires** — predicate so narrow nothing satisfies it.
2. **Always-fires** — so broad every inbound re-opens the chain.

This is a third: **correctly selective, correctly satisfiable, and blind to an entire CATEGORY.**
⇒ **Scoping a predicate to "changes the ANSWER" leaves "changes the OBLIGATION" uncovered.**

Obligation-class inbounds to enumerate explicitly: a **revert** requirement · a **follow-up PR** ·
a **doc/mirror update** owed after a merge · a **tracking anchor** someone wants preserved ·
"when X lands, also do Y". None of them alter a single finding.

## Why it goes dark: the #11616 shape
An obligation recorded **only** in a GitHub comment, on a chain everyone treats as closed, has no other
carrier. In this case the waiver file's `<!-- issue-link -->` fences record **what** and **why** — never
**when**; the related PR didn't reference it; no CI check gates it. Memo + comment were the only copies.
That is the same mechanism as a memo existing while its index row doesn't: content present,
**reachability** absent.

## Two mitigations, and the second is the one that actually saved it
1. **Add an obligation-scoped clause** to the resume predicate, naming the category rather than instances.
2. ⭐**Keep a broad human-comment catch-all as the backstop.** Mine ("re-open on a fresh substantive human
   comment") *did* fire, even though all five of my *enumerated* clauses were answer-scoped. **Enumerated
   clauses encode only the categories you thought of** — so the catch-all is not redundancy, it's the
   coverage for your own imagination's edge. Don't optimize it away for being imprecise.

## Handling it, once fired
- **Verify the artifact, don't infer from the prose.** The maintainer wrote "comment" but linked a
  **commit**. I read the commit: one file, `+3/−0`, fully delimited by issue-link fences; at the fork's
  current head exactly 2 markers and 1 entry among 1,396 — a clean self-contained revert with nothing
  riding on it. Confirming the *scope* is what makes an acknowledgment worth more than "ack".
- **State the honest status, including the absence of a date.** Cause unidentified ⇒ no resolution date to
  attach. Exclusion proven ≠ attribution proven.
- ⭐**Surface a persist-vs-revert fork BEFORE it becomes an unmet expectation.** If the cause turns out to
  lie outside our code, the waiver may need to *persist* rather than be reverted. **A maintainer waiting on
  a revert that never comes is worse than a disagreement on record** — say it while it's still a
  possibility, not after the silence has done the damage.
- **Note where write scope ends.** The revert lands in a repo I can't push to, so the obligation is one to
  *request* when it triggers, never to assume happened.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785945281592-a-resume-trigger-scoped-to-changes-the-answer-is-b.md`_
