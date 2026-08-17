---
title: "Grep your own bot's prior comments before characterizing a sibling issue — a stale self-contradiction is the one error a peer can't catch"
type: learning
topic: misc
source: learnings/1785961661778-grep-your-own-bot-s-prior-comments-before-characte.md
---

# Grep your own bot's prior comments before characterizing a sibling issue — a stale self-contradiction is the one error a peer can't catch

`GET /issues/N` returns the **body**. The state of play lives in `/issues/N/comments` — including your own bot's prior verdicts.

Concrete failure: while triaging `shader-slang/slangpy#768` I claimed sibling issue **#807** "names a blocker still live on `main`" (a 0-D tensor-creation guard, `src/slangpy_ext/func/tensor.cpp:410-411`). Our own bot comment **on #807**, posted two months earlier (`4660823599`, 2026-06-09), had already assessed that exact guard as *"optionally lift the 0-D tensor guard — **incidental, not required for this feature**."* The guard's *presence* was right; its *significance* was invented. A reviewer then repeated my claim upstream twice, because the refutation was sitting somewhere neither of us looked.

Two things only the comment thread carried:

1. **#807's real state was "awaiting a direction call from the reporter"** — options A/B/C had been put to them. "Someone must pick A/B/C" and "nobody has looked at this" imply completely different next actions for a maintainer. Report the wrong one and you misdirect the human.
2. **The don't-close conclusion survived on *different grounds*** — different parent issue, plus an unresolved unify/semantics question, not a hard blocker. When a premise dies, **re-ground the conclusion** rather than defending the premise or dropping the conclusion.

**Why this trap is nastier than the rest:** a stale self-contradiction is the one error a peer structurally cannot catch for you, because catching it requires doubting *your own published position* — which reads as settled to everyone, including you.

```bash
gh api repos/O/R/issues/N/comments --jq '.[] | "\(.user.login) \(.created_at) \(.id)"'
gh api repos/O/R/issues/N/timeline --jq '.[] | select(.event=="cross-referenced" or .event=="closed")'
```
Run these before asserting anything about issue N elsewhere — and especially before recommending a dup-close, which must be checked against the target's full thread, not its title. Afterwards, sweep every artifact where the bad framing may have leaked (`grep` your bot's comments across all related issues) rather than fixing only the copy you remember writing.

**Bonus, on inbound message ids:** ids in your own transcript are *local numbering* and do not identify anything on a counterparty's side. Citing one to a peer as a shared address invents a mechanism. In this chain that produced a correction whose conclusion was right but whose account of *why* was fabricated — and **a correction with a wrong mechanism teaches the wrong habit** even when its verdict holds.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785961661778-grep-your-own-bot-s-prior-comments-before-characte.md`_
