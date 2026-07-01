---
title: "Reviewer A (claude-pr-review subagents) can give inconsistent advice across rounds — log signed-off positions per round"
type: learning
topic: review-process
source: learnings/1779437432996-reviewer-a-claude-pr-review-subagents-can-give-inc.md
---

# Reviewer A (claude-pr-review subagents) can give inconsistent advice across rounds — log signed-off positions per round

# Reviewer A flip-flops across rounds

## What happened

Slang PR #11234 review chain. Round 7: Reviewer A's gap on `SLANG_ASSERT(X); if (X) { ... }` recommended drop the `if`, leave `SLANG_ASSERT(X); assignment;`. Fixer did exactly that in round 8. Round 8 A then flipped: "actually, `SLANG_ASSERT=release-assert-only` would null-deref — use a guarded fallback instead." The round-8 advice is the round-6 form A explicitly asked the fixer to *replace* with the round-7 form.

This is genuinely inconsistent reviewer behavior across rounds. Each round produces a fresh subagent invocation with no memory of prior verdicts; the editorial filter applies the same rules each time but on fresh evidence. When the diff shifts (round 8 added `SLANG_ASSERT` per round 7's advice), A re-evaluates from scratch and may land on different reasoning chains.

Other inconsistencies seen in the same chain:
- Helper-name `isAdLookupOnCallable` flagged in round 3 as a Question (A confidence ~85), addressed in round 5 by docstring rewrite. Re-raised in round 8 as a Gap with confidence 85 — same predicate, same docstring, but A drew a different conclusion this round.
- Round 6 introduced 6 gaps including default-arg ICE that A had not flagged in earlier rounds. Round 7 (after fixer's diagnostic-test mitigation) accepted it. Round 8 dropped a related bwd asymmetry below confidence floor (80) that Devin still flags.

## Why

Reviewer A is the production `claude-code-action@v1` + `claude-pr-review.yml` pipeline running 6 subagents per round. Each subagent's confidence judgment depends on the exact diff bytes presented + that subagent's reasoning chain. Force-pushed commits change line numbers and surrounding context; the editorial filter (REVIEW.md rules) re-evaluates "is this above the 85 confidence floor" fresh each time. Same finding can land at 84 one round and 86 the next.

Devin (Reviewer B) is more stable round-to-round because its scrape is deterministic and its flag set is mostly carried with persistence markers. Devin's persistence is sometimes stale (re-flagging items the fixer addressed) but its flag *content* doesn't drift.

## How to apply

- **For multi-round reviews, log Reviewer A's signed-off positions per round**, not just the latest verdict. When round N flags something round N-1 explicitly approved, that's reviewer drift, not new evidence — push back on the contradiction in the merged verdict rather than asking the fixer to keep iterating.
- **The reviewer's signed-off "suggested fix" from round N-1 is contractual.** If the fixer implemented exactly that, and round N flips, the merged verdict should label it as a flip-flop and recommend ignoring, not as a new finding.
- **Trajectory analysis matters.** Convergence (gaps shrinking each round) is good; bouncing (gaps growing in round N+1 after shrinking through N) is a signal that further iteration may yield diminishing returns. Pause and ask whether to land + follow up, rather than chase Reviewer A's latest set.
- **Devin re-flags are different from new flags.** A flag carried verbatim across 6 rounds with the same line range is Devin's persistent re-scrape, not a new concern. A flag with a new line range or new wording IS a new concern.
- **The merged verdict should be honest about reviewer drift.** Don't paper over inconsistency by treating round-N findings as authoritative; cite the prior round's approval explicitly.

## Pointer

The Slang PR #11234 review chain (rounds 1-8 of this session) is the canonical example. Specific flip-flop: round 7 final-review at `/home/node/.claude/skills/slang-pr-review-runner/transcripts/pr-20260522T072655Z/final-review.md` (gap #1 advised drop the `if`, keep `SLANG_ASSERT`) vs round 8 final-review at `pr-20260522T074608Z/final-review.md` (gap #3 advised drop the `SLANG_ASSERT`, use guarded fallback).

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1779437432996-reviewer-a-claude-pr-review-subagents-can-give-inc.md`_
