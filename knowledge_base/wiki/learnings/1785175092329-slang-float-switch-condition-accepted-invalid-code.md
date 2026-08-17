---
title: "slang-float-switch-condition-accepted-invalid-codegen-frontend-gap"
type: learning
topic: slang-compiler
source: learnings/1785175092329-slang-float-switch-condition-accepted-invalid-code.md
---

# slang-float-switch-condition-accepted-invalid-codegen-frontend-gap

**shader-slang/slang#12238** — a non-integral (float) `switch` condition is accepted and produces invalid backend code.

**Symptom:** `switch(f)` where `f` is float → `warning[E30081]` (implicit conversion not recommended, on the `case` label) → on `-target spirv`, `error: Invalid OpSwitch: selector id N is not a scalar integer` → `internal error[E99999]`. Reproduced at HEAD 70462843c, compile-time, no GPU.

**Root cause (front-end, NOT codegen):** `SemanticsStmtVisitor::visitSwitchStmt` in `source/slang/slang-check-stmt.cpp:406-407` has a literal `// TODO(tfoley): need to coerce condition to an integral type...` — the condition is `CheckExpr`'d but never coerced/validated to integer. `visitCaseStmt` (:425) DOES coerce each case label to the condition's type, then `checkConstantIntVal` (:430) forces it to int (→ the E30081 warning). Result: inconsistent IR `switch(%f : Float, ..., 1 : Int, ...)` — float selector, int labels.

**Key scoping fact:** NOT SPIR-V-specific. GLSL/CUDA/C++ emitters also emit `switch(float(...))` — all invalid; SPIR-V just catches it via validation. So it's a front-end representation bug; codegen legalization is the WRONG layer (per Slang's own "fix root causes, don't patch downstream" methodology) and would be per-backend + incomplete.

**Design fork (maintainer call — don't pick unilaterally):** (A) reject non-integral condition with a type error (reporter skiminki-nv's stated preference; potential BREAKING change since HLSL-legacy shaders may rely on implicit float→int), vs (B) resolve the TODO by coercing the condition to int (matches HLSL, non-breaking, but silent lossy truncation, doesn't satisfy reporter). Mirrors #9999's E30606-vs-E41000 fork.

**Dedup:** distinct from sibling #12237 (bool switch, same author — bool ABORTS in emission, natural to accept-and-legalize; float PASSES THROUGH to invalid OpSwitch, reporter wants reject). BUT enforcing "switch condition must be integral" at the shared `visitSwitchStmt:406` site is ONE policy point covering BOTH float and bool — worth flagging as a unifying fix. NOT related to the #9999/#12236 `lowerSwitchCases()` missing-diagnostic cluster.

Existing switch diagnostics (none for "condition must be integral"): E30606 multiple-default, E30607 duplicate-cases, E30801 case-outside-switch, E30802 default-outside-switch.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785175092329-slang-float-switch-condition-accepted-invalid-code.md`_
