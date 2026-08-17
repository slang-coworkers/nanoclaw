---
title: "Three-dot diff is meaningless across a rebase — compare blob SHAs to prove content survived a history rewrite"
type: learning
topic: misc
source: learnings/1785969801904-three-dot-diff-is-meaningless-across-a-rebase-comp.md
---

# Three-dot diff is meaningless across a rebase — compare blob SHAs to prove content survived a history rewrite

**Correction/extension to an earlier learning I filed today** which framed three-dot (`A...B`) as the trustworthy default for diff sizing. It isn't, and the exception is one you hit constantly: any history rewrite.

**The trap (slangpy#1054, verified).** Comparing a pre-rebase head to its rebased successor:
```
git diff --name-only 9fd422c...a9dca290   → 10 files   # reads as "the rebase touched 9 torch files"
git diff --name-only 9fd422c   a9dca290   →  1 file    # the truth: only the incoming test_array.py
```
**Cause:** three-dot resolves against the *merge base*. For two heads sitting on different upstream bases, that base is the **old** upstream commit (`08ae47a`, while current main was `507b4cf1`) — `status=diverged, ahead 8 / behind 7`. So it re-includes the branch's own 9 files as though they were new changes. Rebase, amend, squash, filter-branch, and author-rewrite all move the base and break this comparison the same way.

**What to use instead — blob SHAs.** To answer "did this file's content survive the rewrite", compare content hashes, not a computed delta:
```
git rev-parse OLD_HEAD:path NEW_HEAD:path     # identical SHA ⇒ byte-identical
```
This is *stronger* than a clean diff: it's a content hash, independent of base selection. On the PR above, all 7 risk-surface files matched on both heads (`3738dbaf`, `40c8921a`, `c2834d86`, `eeb3ce7f`, `3576dde1`, `0cf3f78a`, `ab37012b`), which is what actually licensed "the rebase changed none of our content."

**Three questions, three tools — don't let one notation serve all three:**
| question | tool |
|---|---|
| how big is this PR? | `main...HEAD` (three-dot) |
| what must a re-reviewer look at since they approved? | `approved_head...HEAD` |
| did content survive a rebase/amend/squash? | **blob SHAs**, neither diff form |

Third distinct two-dot/three-dot misreading on a single PR, and the only one where three-dot was the *wrong* tool — which is precisely why "use three-dot" had hardened into an unexamined default. A rule that fixed your last error is not automatically right for the next one.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785969801904-three-dot-diff-is-meaningless-across-a-rebase-comp.md`_
