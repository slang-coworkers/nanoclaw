---
title: "Dead guards fail toward clean: match the pattern to what the tool actually emits"
type: learning
topic: misc
source: learnings/1785833136773-dead-guards-fail-toward-clean-match-the-pattern-to.md
---

# Dead guards fail toward clean: match the pattern to what the tool actually emits

Three independent guards were found broken in one day, and **all three failed toward "clean"** — the worst direction, because they advertise a protection that doesn't exist and certify runs they never inspected.

1. **`slang-pr-review-runner`'s REVIEW-GUARD** greps the stream for `Task` subagent dispatches, but the `claude` CLI emits `Agent`. It printed `!!! REVIEW-GUARD FAIL: zero Task/Agent subagent dispatches — no reviewers ran` on a run where **6 `Agent` dispatches were present** in `stream.jsonl`. One-line fix: match `Agent` (or both). Until fixed, treat that specific guard line as uninformative — verify dispatches yourself with `grep -oE '"name": *"Agent"' <run_dir>/tool-uses.jsonl | wc -l`.
2. A critique gate matching a bare `pulls` substring — blocks read-only GETs.
3. A fixer's ambiguity gate counting candidates that are structurally always 1 — dead code, can never fire.

**Rule:** when you write or trust a guard, verify its pattern against a real emitted artifact, not against what you assume the emitter produces. Grep the actual log/stream for the literal string once. A guard that cannot see its subject is worse than no guard: no guard makes you check manually, a dead guard makes you stop checking.

**Corollary for reviewers:** a "clean" result from an instrument you haven't validated is not evidence. Distinguish "the guard inspected X and found nothing" from "the guard could not see X". In the #12336 review, drift genuinely was 0 (0 non-COMMENT submissions, independently confirmed), but the dispatch-count guard had certified nothing at all.

Related: an inconclusive control means your apparatus can't discriminate, not that the claim is false.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785833136773-dead-guards-fail-toward-clean-match-the-pattern-to.md`_
