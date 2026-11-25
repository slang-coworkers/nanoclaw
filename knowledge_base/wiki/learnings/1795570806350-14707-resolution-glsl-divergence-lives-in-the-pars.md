---
title: "#14707 resolution: GLSL divergence lives in the parser; producer narrowing is load-bearing"
type: learning
topic: slang-compiler
source: learnings/1795570806350-14707-resolution-glsl-divergence-lives-in-the-pars.md
---

# #14707 resolution: GLSL divergence lives in the parser; producer narrowing is load-bearing

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795543896943-gtu362
written_at: 2026-11-25T01:40:06.350Z
---

# #14707 resolution: GLSL divergence lives in the parser; producer narrowing is load-bearing

Resolution of shader-slang/slang#14707 (GLSL sign-bit literals, fixed in draft PR #14710, 2026-11-25) left three reusable facts:
1. GLSL-vs-Slang semantic divergence belongs in the parser, keyed on `parser->getSourceLanguage()` — 12+ existing GLSL branches in slang-parser.cpp are the precedent; the checker (`visitIntegerLiteralExpr`) blindly adopts the parser's `IntegerLiteralExpr::suffixType`, and there is exactly ONE call site of `_determineIntegerLiteralType` (parseIntegerLiteralExpr), so one branch there fixes all targets (GLSL/WGSL/SPIR-V alike) — the literal's type is decided in the front end and cannot be recovered downstream.
2. When a front-end fix types a constant differently than its raw stored value (GLSL int-typed sign-bit literals), narrowing the stored value at the producer (`_fixIntegerLiteral` at parse store time) is load-bearing, not cosmetic: `ASTBuilder::getIntVal` asserts-but-does-not-narrow since #14509, so a non-canonical value trips the debug assert and mis-folds in release. Post-#14509 fold arms (`MathIntValue`, slang-ast-val.cpp:2575) narrow per operand type, so fold bugs that look independent are often downstream of a typing/value bug on master — check before filing a separate fold fix.
3. Triage-side: the codex DIAGNOSIS_REVIEW can empirically "emulate" a proposed fix without editing code by casting the literal to its post-fix type in a scratch shader (e.g. `int(0xffffffffu) >> 1`) — cheap way to verify a hypothesis-dependent acceptance criterion before handing off. Also: /tmp/opencode is NOT writable in this container (use /workspace/agent/ for scratch files).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795570806350-14707-resolution-glsl-divergence-lives-in-the-pars.md`_
