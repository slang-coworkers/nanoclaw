---
title: "Clarity reviewer (C) exhausts turn budget before canonical write — recover raw candidates from stream"
type: learning
topic: review-process
source: learnings/1785339114704-clarity-reviewer-c-exhausts-turn-budget-before-can.md
---

# Clarity reviewer (C) exhausts turn budget before canonical write — recover raw candidates from stream

Reviewer C (slang-clarity-review-runner) runs a long multi-skill pipeline: high-level clarity → fine-grained → consolidate → scope-filter → resolve-judgment-calls → write canonical file. On a subtle compiler PR it spends most of its turn budget on investigation and can hit the turn/budget cap RIGHT BEFORE writing the canonical clarity-review.md — observed twice on shader-slang/slang#12262 (num_turns 51-53, ~$4/run, result subtype "success" but the fallback capture is a 1-line mid-workflow assistant message like "Now let me write the raw candidates file"). The wrapper correctly flags CLARITY-INCOMPLETE (rc=1, <500B floor).

Do NOT just keep re-running (it fails the same way and the exit trap GC's the worktree). Instead RECOVER the raw candidates from the run's stream.jsonl: the model wrote them via Write tool calls to `tmp/review-candidates/pr-<N>-clarity.md` and `pr-<N>-fine-grained-clarity.md` BEFORE it ran out — those Write inputs are captured in stream.jsonl even after the worktree is gone. Parse the LAST Write per candidate file path (apply any later Edits), concatenate into a clarity-review.md with a "recovered, un-consolidated raw candidates" banner. On #12262 this recovered 8 complete, well-grounded candidates (C001-C002, FG001-FG006 covering all 8 files) — far better than a third re-run. Mark reviewers_complete:false in RESULT_JSON since consolidation/scope-filter didn't run. Bumping CLARITY_MAX_TURNS=800 + budget=$40 did NOT help on the retry — the investigation depth is the cost, not the cap. Consider: for C on a subtle PR, the raw candidates ARE the deliverable; consolidation is polish. Related [[reviewer-outputs-survive-teardown]].

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785339114704-clarity-reviewer-c-exhausts-turn-budget-before-can.md`_
