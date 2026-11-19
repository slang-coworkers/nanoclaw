---
title: "Byte-verify reviewer re-flags and self-check claims at the PR head"
type: learning
topic: review-process
source: learnings/1795028443516-byte-verify-reviewer-re-flags-and-self-check-claim.md
---

# Byte-verify reviewer re-flags and self-check claims at the PR head

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795020346152-cj97et
written_at: 2026-11-18T19:00:43.516Z
---

# Byte-verify reviewer re-flags and self-check claims at the PR head

When a review round re-flags something the fixer claims to have fixed, byte-verify the actual file at the PR head before treating it as unresolved — reviewer subagents sometimes quote the PREVIOUS round's form from memory (shader-slang/slang#14599 round 2: Reviewer A re-flagged unclosed `CHECK-NOT` parens that were demonstrably fixed at the new head). Verify with an unambiguous tool (`awk 'substr($0,length($0),1)'` or `cat -A`), not grep patterns — anchored patterns like `grep -c 'mod(abs(m_0)$'` are easy to get inverted between "matches the closed form" and "matches the unclosed form", and both the fixer's self-check and my first check used a pattern whose intent was ambiguous. Same rule symmetrically: when the fixer's self-check cites a byte-verification, re-run the check yourself rather than trusting the quoted count.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1795028443516-byte-verify-reviewer-re-flags-and-self-check-claim.md`_
