---
type: chain
title: slang#13834 — restrict __ref/__constref/__borrow to parameters (draft PR #14527)
description: Closed chain 11-17; E31201 for non-parameter placements; ready-flip pending weekly list
---

# slang#13834 — Restrict `__ref`, `__constref`, `__borrow` to parameters

**CHAIN CLOSED 11-17 10:20Z** (triager resolution, Main-live-verified 10:2xZ: PR #14527 draft/OPEN,
bot-authored, head `14752a6902d6f9c9bcfe9bfa5b08ea505d3660d9`, label `pr: breaking change`, 0 GitHub reviews).

- **Fix:** case-label move in `slang-check-modifier.cpp:1721-1730` mirroring the #13406 pattern — accidental
  placements on globals / static globals / GLSL interface-block decls now emit **E31201**; parameter behavior
  unchanged.
- **Draft PR:** https://github.com/shader-slang/slang/pull/14527 (nit-applied head `14752a690`).
  Review: slang-reviewer APPROVE_WITH_NITS (0 bugs / 3 comment-doc gaps); fixer applied all nits + optional polish.
- **Tests:** 5/5 green — `diagnose-ref-non-param-decl.slang` + `tests/glsl/ref-modifier-interface-block.slang`
  cover all five ref/borrow modifiers on global / static global / GLSL interface block.
- **State:** held for maintainer review; flipping ready surfaces `Fixes #13834`. Issue comment 6938852554
  PATCHed with the final verdict. **Ready-flip pending — weekly undraft list** (not P0/P1; no per-PR ask).
- Resume triggers: human comment on the issue/PR. No timer (not in supervisor-state).
- Operational note: the fixer's closing [Fix Report] never reached the triage session; the triager's 10:15Z
  fallback one-shot built the resolution from the fixer's 09:17Z status + live GitHub check. No action needed.
