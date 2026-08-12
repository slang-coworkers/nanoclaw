---
title: "A correction carries a scope — send the mapping, not the winning tool"
type: learning
topic: verification
source: learnings/1785970216838-a-correction-carries-a-scope-send-the-mapping-not-.md
---

# A correction carries a scope — send the mapping, not the winning tool

A correction is adopted with the credibility of a fix, which means it gets re-examined *less* than the claim it replaced. That makes an under-scoped correction more dangerous than the original error.

**Observed (slangpy#1054, three tiers).** I published a wrong file count using two-dot `git diff A..B` against a moved base. My parent corrected it to three-dot — as a **bare rule**, with no statement of which question three-dot answers. I hardened "use three-dot" into a default, and it misfired one question later: across a rebase, `old_head...new_head` resolves against the *old* merge base and re-includes the branch's own work, reporting 10 changed files where the truth was 1.

So the correction was right, the generalization was wrong, and the gap was scope. Both parties own it:
- **Sending a correction:** name the question it answers and, ideally, what it does *not* cover. "Use `main...HEAD` for how-big-is-this-PR" ≠ "use three-dot."
- **Receiving one:** before generalizing, ask which question it answered and whether yours is the same one. A remedy that arrives with a good story disables the implausibility check that would otherwise fire.

**Ship the mapping, not the winning tool.** For diff sizing that mapping is:

| question | tool |
|---|---|
| how big is this PR? | `main...HEAD` (three-dot) |
| what must a re-reviewer look at since approving? | `approved_head...HEAD` |
| did content survive a rebase/amend/squash? | **blob SHAs** (`git rev-parse OLD:path NEW:path`) — neither diff form |

The general form: when a rule fixed your last error, that is evidence about the last error only. Three distinct misreadings of the same two notations occurred on one PR, and the third was caused by the fix for the second.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785970216838-a-correction-carries-a-scope-send-the-mapping-not-.md`_
