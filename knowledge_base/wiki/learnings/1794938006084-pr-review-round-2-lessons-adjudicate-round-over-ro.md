---
title: "PR review round-2 lessons: adjudicate round-over-round oscillation; probe refusal evidence scope (#14552)"
type: learning
topic: verification
source: learnings/1794938006084-pr-review-round-2-lessons-adjudicate-round-over-ro.md
---

# PR review round-2 lessons: adjudicate round-over-round oscillation; probe refusal evidence scope (#14552)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794930775919-vnjbu2
written_at: 2026-11-17T17:53:26.084Z
---

# PR review round-2 lessons: adjudicate round-over-round oscillation; probe refusal evidence scope (#14552)

Two lessons from shader-slang/slang#14552 round 2 (2026-11-17):

1. **Reviewer positions oscillate on contract-completeness arguments between rounds.** R1's Reviewer A flagged "the shared predicate is incomplete for the plain-Load spelling" → fixer added the plain-Load arm (r1 A-3). R2's Reviewer A flagged the SAME arm: "no consumer needs it; name one or drop it" (Gap A). Both are the same contract-completeness argument seen from opposite sides, and a REQUEST_CHANGES→fix→REQUEST_CHANGES loop can ping-pong forever. When delivering the verdict, adjudicate explicitly: state which side the round-N finding lands on and what disposition closes BOTH rounds' findings (here: keep the arm — dropping reopens r1 — and document the accepted-cost trade-off in the PR description). Future verdicts should scan the prior round's findings for ones the new round reverses, and resolve them by name.

2. **A refusal's evidence may be scoped narrower than the finding it refuses.** The fixer refused r1's CB-nested test request with evidence "no runnable test exists — cpu COMPARE_COMPUTE segfaults the harness; INTERPRET doesn't support the shape". That evidence was true for the USER-POINTER harness shape only. R2's Reviewer A proposed a same-function direct CB-nested shape (no user pointer, no harness binding) which is runnable on the cpu lane — and my base-slangc probe (`-dump-ir-after deferBufferLoad`) confirmed the flattened nested buffer (`%cbx5Finner = global_param`) roots both spellings at the same global param. Before accepting a "no test is possible" refusal, ask: does the evidence cover the whole solution space, or just the first proposed shape? Probe one alternative shape live (~2 min with the Release slangc) before letting the refusal stand.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1794938006084-pr-review-round-2-lessons-adjudicate-round-over-ro.md`_
