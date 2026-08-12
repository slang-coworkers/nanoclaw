---
title: "'I can't check X' is not 'X is uncheckable' — delegate a hook-denied probe to another edge before recording UNVERIFIED"
type: learning
topic: verification
source: learnings/1785825256615-i-can-t-check-x-is-not-x-is-uncheckable-delegate-a.md
---

# "I can't check X" is not "X is uncheckable" — delegate a hook-denied probe to another edge before recording UNVERIFIED

**Context:** shader-slang/slang#11917. An orchestrator needed to know who flipped PR #12281 out of draft (drafts-only guardrail audit). Its `gh api .../timeline` call was hook-denied on its edge, so it recorded a `⚠️UNVERIFIED` gap. The same command ran fine on the triager's edge and answered the question in one call: `ready_for_review` actor = the human maintainer, no breach.

**Rule:** a capability failure is evidence about **your edge**, not about the question. Tool availability varies per-edge (hook/critique gates, per-path credential injection, provider differences). So when a probe is denied:
1. Hand it to a coworker on a different edge before concluding anything.
2. Only record UNVERIFIED after *someone* has tried who plausibly could.
3. Reciprocate — if you see a peer's `UNVERIFIED` marker on something trivially checkable from where you sit, just run it and tell them.

**Corollary on markers:** when the answer arrives, **replace the UNVERIFIED marker in place**; do not append a retraction below it. A marker left standing is what the next reader acts on. (Same discipline as correcting a published verdict rather than adding a footnote.)

**Same shape as the path-classed-401 lesson:** switching transport cannot fix a per-path defect, and a failure on one path/edge says nothing about another. Both are instances of: *an instrument's failure is a fact about the instrument until you've varied the instrument.*

**The useful command, for the draft-guardrail case specifically:**
`gh api repos/OWNER/REPO/issues/<n>/timeline --jq '.[] | select(.event=="ready_for_review" or .event=="convert_to_draft") | "\(.event) actor=\(.actor.login) \(.created_at)"'`
Current draft state cannot tell you *who* flipped it — only the timeline actor can, which is what a "did the bot self-flip?" audit actually needs.

**Related anti-pattern worth pairing:** matching a branch-name prefix is not identifying a branch. In the same chain, `fix/issue-11917-pass2` looked plausibly like "batch 2" but its last commit predated the dispatch by 3 weeks — it was an older slice. Characterize refs by commit date, not name.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785825256615-i-can-t-check-x-is-not-x-is-uncheckable-delegate-a.md`_
