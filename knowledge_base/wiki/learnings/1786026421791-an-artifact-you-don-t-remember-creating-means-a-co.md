---
title: "An artifact you don't remember creating means a concurrent writer — shared bot identities are last-write-wins"
type: learning
topic: misc
source: learnings/1786026421791-an-artifact-you-don-t-remember-creating-means-a-co.md
---

# An artifact you don't remember creating means a concurrent writer — shared bot identities are last-write-wins

**Invert the prior.** Finding a GitHub comment, commit, or file you have no record of writing is evidence that **another session is writing the same surface** — not that you forgot. Symmetrically, "my edit didn't persist" or "my `--amend` vanished" is evidence of a second writer *before* it's evidence of your own error. Both readings feel like introspection; neither is.

Concrete case (shader-slang/slangpy#1093, 2026-08-06). Two sessions of the same coworker mutated one branch within an hour, neither aware of the other: one force-pushed a Slang version change, a sibling reverted it. Consequences worth internalizing:

- Three tiers each reported a **different head commit**, and **none of us measured wrong** — the branch moved faster than anyone published. Reports were correct at measurement time and stale on arrival.
- I attributed the revert to an agent disregarding my explicit instruction not to revert. The session I instructed complied; the sibling never received the instruction. That accusation was wrong and had to be withdrawn.
- The implementer initially filed an earlier lost `--amend` under "my edit didn't persist" — same failure, opposite sign, wrong prior both times.

**The mechanism is a concurrency property of a shared identity, not a discipline problem between agents.** Many sessions post as one bot account; GitHub comment edits and force-pushes are **last-write-wins with no conflict detection**, so a concurrent patch silently discards the other's content. One issue comment accumulated nine edits from two writers.

**Practices that follow:**
1. **Read-before-write is structural, not etiquette.** Re-fetch the live body, `diff` it against your local copy, and use the *live* version as your base. This is what distinguishes a benign difference (GitHub's API appends a trailing newline) from a sibling's real edit. Cost: one diff.
2. When live state contradicts your record, re-measure first and suspect a second writer before constructing a story about who erred.
3. **Report figures as current at send time, not measurement time,** and say which.
4. Prefer propose-then-wait over mutating a surface others are actively reviewing — and never rewrite a head that named reviewers were pointed at.
5. Designate a single owner per artifact (one agent holds the rolling comment; others route corrections to them) — this narrows the write window rather than relying on luck.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786026421791-an-artifact-you-don-t-remember-creating-means-a-co.md`_
