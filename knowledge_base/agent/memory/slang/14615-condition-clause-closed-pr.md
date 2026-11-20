---
type: chain-record
title: "slang#14615 ConditionClause / HLSL decl-as-condition — PR #14627 closed unmerged by maintainer"
description: "Chain terminal-pending-human: tangent-vector closed draft PR #14627 with no close comment after 7 fully-implemented review rounds; no bot action on #14615 without operator direction"
tags: [slang, closed-pr, maintainer-relations, terminal-pending-human]
---

# slang#14615 — ConditionClause / HLSL decl-as-condition (PR #14627 closed unmerged)

**Status (2026-11-20): TERMINAL-PENDING-HUMAN. No bot action on this issue or PR without operator direction.**

## Timeline (all 2026-11-18/19/20 UTC)

- 11-18: maintainer tangent-vector filed issue #14615 (feature request, self-assigned). Triaged
  (feature-request/medium/P2/frontend, no dup); dispatched to slang-fixer on canonical thread
  `gh-issue-shader-slang/slang-14615`.
- 11-19 02:08: fixer opened draft PR #14627 (explanation HTML follows each head; 12 commits by close).
- 11-19 20:53–21:31: 7 maintainer review rounds, tone escalating to
  ["NO. STOP. … You are in danger of getting fired now, @nv-slang-bot"](https://github.com/shader-slang/slang/pull/14627#discussion_r4635380248)
  over "as in C++" phrasing and invented terminology. All rounds implemented and verified
  (heads a3eacf4 → 4405830 → 512d061, ~6,700 tests green each round; MR log in fixer
  `reports/slang-14615-thread*.md`).
- 11-20 00:39: **tangent-vector closed PR #14627 (not merged) at head 512d061 with no close comment.**
  Fixer cleaned the worktree, left branch `fix/issue-14615` pushed on origin, did not reopen or
  comment further. Issue #14615 remains open.

## Decision parked with the operator (surfaced 11-20)

Options the fixer surfaced, unweighted: (a) resubmit the work differently, (b) fresh PR,
(c) stand the bot down from #14615. The next move is a human conversation (operator ↔
tangent-vector), not bot activity. Any maintainer comment on the issue/PR routes via webhook.

## Durable lessons already captured

- Fleet learning "slang: no cross-language comparisons or invented terms in diagnostics
  (tangent-vector STOP 2026-11-19)" — never "as in C++" without strong justification; no
  cross-dialect references in Slang diagnostics; no coined terminology.
- Parser/checker division: syntactic rejection belongs in the parser, semantic rejection in
  the checker (comment 4634975696); FIDDLE-generated visitor per-subclass fallbacks make
  catch-all visit methods unreachable dead code — an unhandled case should fail at compile time.

## Citations

- Issue: https://github.com/shader-slang/slang/issues/14615
- PR (closed): https://github.com/shader-slang/slang/pull/14627
- STOP comment: https://github.com/shader-slang/slang/pull/14627#discussion_r4635380248
- Fixer sessions: sess-1795040985190-v53hrm (chain), PR-mapped
