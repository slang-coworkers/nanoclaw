---
type: issue
title: "slang#14707 — GLSL unsuffixed integer literals with sign bit set typed uint/int64 (P1 regression)"
description: Human-filed P1 regression (andy-slater, 11-24); GLSL literal typing + constant-folding; fixed via draft PR #14710.
tags: [slang, glsl, integer-literal, regression, parser]
---

# #14707 — GLSL unsuffixed sign-bit integer literals mistyped (→ draft PR #14710)

Human-filed 11-24 16:06Z by andy-slater (external, exceptional report: reproducer, GLSL 4.60 §4.1.3
citation, version bisect). R6 dispatch; 👀 posted 16:07Z.

**⚠️ Routing incident (11-24):** the issue_opened sat 2 h undispatched — I mistook my own Main session
(created at webhook-arrival on the canonical thread) for a sibling owner and went silent; the supervisor
nudge at 18:11Z exposed it. Triager dispatched 18:15Z. Lesson folded into memory/index.md Core Memory
(sibling-check bullet): verify a sessions-list hit's inbound rows before calling it a sibling.

## Triage (triager, 18:22Z)
- bug/regression/P1, frontend literal typing. Not a dup (#14382 adjacent, different surface).
- Root cause: #11357 (commit a49a125, first release v2026.11) replaced literal typing with Slang/C-style
  rules and applies them to GLSL input; GLSL 4.60 §4.1.3 requires unsuffixed 32-bit-representable
  literals to be `int` with the raw bit pattern.
- Reproduced on master v2026.22.1-31 (b9aa9c8d4), all 4 repro statements, GLSL+WGSL.
- Key insight: the constant-folding half (`0xffffffff>>1` → 2147483647, `0x80000000<0` → false) is
  downstream of typing on master — #14509 made fold arms narrow per operand type, so folds self-correct
  once typing is fixed. In released versions the fold bug is real and separate (pre-#14509 raw-int64 arms).
- Labels `reproduced`/`regression`, Issue Type Bug; triage cmt 7140561970; codex DIAGNOSIS_REVIEW
  CONFIRMED/approve (independently reproduced + verified the fold self-correction claim).
- Fixer handoff attempt 1 hit a fixer runtime error 20:13Z; retry clean 20:15Z.

## Fix (fixer, [Fix Report] 01:37Z 11-25; triager [Triage Resolution] 01:39Z)
- **Draft PR #14710**, head `29fcac005`, branch fix/issue-14707, 6 commits, 3 files +119/−5,
  `pr: non-breaking`, rebased clean on master.
- Approach A (triager-recommended): GLSL branch in `_determineIntegerLiteralType`
  (slang-parser.cpp:9210) + store-time `_fixIntegerLiteral` narrowing in `parseIntegerLiteralExpr`
  (:9440, avoids the isValueInRangeOfConstantType debug assert). New
  tests/glsl/integer-literal-sign-bit.slang (GLSL+WGSL filecheck legs, discriminating escape-hatch
  checks). Comment-contract rework incl. one-line slang-ast-expr.h touch-up; trailing clang-format commit.
- Tests: repro 2/2 (issue's expected emission byte-for-byte); tests/glsl 315/315; glsl-intrinsic
  189/189; Slang-mode literal suites 10/10 (#11357 ladder intact, `0xFFFFFFFF : uint` in Slang mode);
  formatting clean. Review APPROVE_WITH_NITS, 0 bugs, all nits applied (2 declines with reasons:
  header lineage line — maintainer forbids issue #s in code/test comments; optional SPIR-V leg —
  WGSL leg already pins i32-typed constants).
- CI run 45517942835 triggered on 102dc1ebc; the trailing style commit's draft checks skipped
  (format job only runs once marked ready; head whole-file clang-format clean).
- Resolution cmt 7147481149 refreshed on the issue.

## State: TERMINAL our side, parked on maintainer
- Next human action: maintainer review/merge of draft PR #14710. **Resume on: PR webhook only.**
- Ready-flip pending — **P1 regression exception**: flagged to the operator on the dashboard
  (msg 43, 11-25 01:38Z) for early attention; also on the weekly undraft list.
- Maintainer decision flagged in PR Risk section: spec-strict >32-bit GLSL unsuffixed-literal
  diagnostic (GLSL says compile-time error; PR keeps the Slang ladder to avoid rejecting existing code).
- Post-merge: issue auto-closes via `Fixes #14707` once ready-for-review; suppression rule takes over.

Owner sessions: fixer on `gh-issue-shader-slang/slang-14707` (pr-mappings → #14710 webhooks route there);
triager sess gtu362.
