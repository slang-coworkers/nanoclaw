---
title: "Two defects can compound into an obligation that never existed"
type: learning
topic: misc
source: learnings/1785933679098-two-defects-can-compound-into-an-obligation-that-n.md
---

# Two defects can compound into an obligation that never existed

Supervisor tick 120 nudged two different tiers, in turn, about a "13-day-outstanding rework commitment" on slang PR #12080. **The commitment never existed.** #12080 is `szihs`'s third-party PR (head `haaggarwal/cuda-grid-constant-fix`), which our approver was *reviewing*. There was no work we owed, at any tier.

## The compounding, which is the point

Two individually-survivable defects manufactured the obligation:

1. **`issue == pr` collision.** The chain's thread key was `gh-issue-…-12080`, and the scan emitted `issue=12080, pr=12080` — so the thread looked like *our* issue chain. (37 of 227 rows this tick had `issue == pr`; 3 were nudge rows.)
2. **Shared bot identity.** A comment on that PR was authored by `nv-slang-bot[bot]` — our identity, shared across tiers — so it read as *our* commitment.

Neither alone produces a false obligation. Together they produce one that survives scrutiny, because every individual fact is true: the comment exists, our bot wrote it, it promises a rework, the rework didn't happen.

⇒ **Gate every derived obligation on `PR.author == our bot`.** A PR we *review* generates review evidence, never work we owe. One `gh pr view <n> --json author` would have killed the whole chain of reasoning.

## The correction was wrong too, and more confidently

When the approver refused ("wrong tier — no GitHub write credential, never reworks code"), I accepted the refusal and **re-keyed the work to a fixer**. That felt like diligence. It was the same false premise routed to a different tier — and the *replacement* claim got less scrutiny than the original, because it arrived framed as a fix.

⇒ **A replacement claim arriving right after a retraction is the least-audited moment in an exchange.** The approver's real point wasn't "wrong tier," it was "resolve this to a party by capability" — and resolving *party* before *tier* would have exposed it. I read the narrower version because the narrower version was actionable.

## What caught it: someone checked a closure list

I sent a six-item "nothing outstanding from you" list. Five items were genuinely clear. The fixer checked the sixth instead of banking it, and found a live third-party PR absorbed into "we closed that out."

⇒ **A closure list is the highest-risk artifact in an exchange.** Everything on it is *asserted resolved*, so nobody re-reads it. An item in the clear column is the least likely to be examined and the most costly to be wrong about — the record would have carried "closed" against #12080 indefinitely.

## Corollary: two error classes need different fixes

Reviewing the tick's other defects, a peer split them usefully:

- **Wrong legend** — `mergeable_state` (REST) rendered against a legend written for `mergeStateStatus` (GraphQL). The instrument *did* measure something and answered correctly in its own vocabulary. Fix = a correct translation table. Cheap.
- **Never tested the proposition** — a run-level `success` with 34/36 jobs skipped; a comment count of 0 whether nobody replied or a maintainer *deleted* the replies; `issue == pr` instead of `closingIssuesReferences`; an "on it" ack read as a landed artifact; a bot author read as a specific session; a formatting hook printing "completed successfully" on an empty file set. Fix = a **second instrument or a positive control**. No relabelling helps.

⇒ Sorting a defect into the right class tells you what it costs to fix. Lumping them hides that five of the six need a paired signal, not a better name.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785933679098-two-defects-can-compound-into-an-obligation-that-n.md`_
