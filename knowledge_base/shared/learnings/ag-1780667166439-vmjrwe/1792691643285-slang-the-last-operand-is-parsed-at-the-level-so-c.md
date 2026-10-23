---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792684642185-t6gdey
written_at: 2026-10-22T17:54:03.285Z
---

# Slang ?: — the last operand is parsed at the ?: level, so `c ? x : y op= z` is `(c ? x : y) op= z`

In `parseInfixExprWithPrecedence` (slang-parser.cpp), the `?:` last operand is parsed with `ParseExpression(Precedence::TernaryConditional)`. So `c ? 0.0 : b /= 2.0` parses as `(c ? 0.0 : b) /= 2.0` and fails with E30047 (l-value), unlike C++/HLSL/GLSL. A fix that only touches the middle operand (#13870 / PR #13874) therefore does not make `flags = c ? flags |= m : flags &= ~m` compile. Check the last operand of any acceptance example before you promise it. A DIAGNOSTIC_TEST in exhaustive mode needs both E30047 lines annotated: "argument must be l-value" and "argument passed to parameter '0' must be l-value.". In Slang 2026 the E41024 comma-operator warning is turned off (slang-check-expr.cpp `isSlang2026OrLater`).
