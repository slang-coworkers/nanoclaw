---
name: PENDING maintainer design call — #11882 primal's own [require] dropped at diff use-site
description: slang#11882 capability-propagation gap; VERIFIED at HEAD but issue's root cause INCOMPLETE (4-cell matrix); held for @expipiplus1, fixer NOT dispatched, adjacent to #11859/#11872 series
type: project
originSessionId: 8bb8f393-beee-4c18-84bd-e263e4eb41ff
---
**shader-slang/slang#11882** — a primal's own `[require]` is dropped at a `fwd_diff`/`bwd_diff` differentiation use-site. Auto-opened by nv-slang-bot, split out from the #11872 review (Copilot flagged on `visitStaticMemberExpr`). The mirror of #11859: #11859/#11872 = derivative's `[require]` OVER-propagating onto the primal (fixed by moving to use-site); #11882 = primal's own `[require]` UNDER-propagating at a diff use-site.

**Triager verdict (VERIFIED at HEAD 7f79b923f, 2026-07-01):** reproduced on CPU/`-target hlsl`; pre-existing, NOT a regression from #11872 (unmerged). Set Type=Bug + `reproduced` label. Verdict posted: https://github.com/shader-slang/slang/issues/11882#issuecomment-4854117127

**Material correction to our own bot's issue** — the issue is confirmed *in part only*:
- Issue's "BOTH fwd_diff and bwd_diff drop it" is INACCURATE at HEAD.
- Issue's single stated root cause (`visitStaticMemberExpr` vs `visitMemberExpr` asymmetry, `slang-check-decl.cpp:1157-1166`) is INCOMPLETE.
- Verified 4-cell matrix: **user-defined-derivative** → fwd_diff PROPAGATES / bwd_diff DROPPED (the repro); **synthesized-derivative** → fwd_diff DROPPED / bwd_diff PROPAGATES; **plain call** PROPAGATES. Both diff directions share the SAME rewrite (`convertHigherOrderExprToLookup`), so the visitor asymmetry alone can't explain why 2 of 4 cells propagate — there's additional path-dependent behavior (StaticMemberExpr vs MemberExpr form / retained `visitHigherOrderInvokeExpr` path).

**Why:** touches broad capability-propagation behavior with zero coverage; triager recommended AGAINST the issue's proposed unconditional `dispatchIfNotNull(expr->baseExpression)` (broad blast radius, untested, #11551 over-propagation-abort history). Sits squarely in @expipiplus1's active `[require]`/autodiff area.

**How to apply:** HELD for maintainer design call — routed to @expipiplus1 on the issue. Fixer NOT dispatched. Questions posed: (1) should a primal's own `[require]` gate a differentiation use-site at all, and differ for user-defined (primal body may not run) vs synthesized derivatives? (2) the 4-cell inconsistency needs ONE rule decided first; (3) sequencing — almost certainly fold into the #11859/#11872 use-site model, not a standalone visitor patch. Do NOT auto-release the fixer; release only on maintainer convergence. Re-open the chain on a substantive human/bot-directed comment. Canonical thread `gh-issue-shader-slang/slang-11882`; triager owns it.
