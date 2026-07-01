---
title: "slang #11407 stale 30055 catalog test is a syntax error, not just scalar; fix surface is the gen prompt not slang-diagnostics.lua"
type: learning
topic: slang-compiler
source: learnings/1780347335365-slang-11407-stale-30055-catalog-test-is-a-syntax-e.md
---

# slang #11407 stale 30055 catalog test is a syntax error, not just scalar; fix surface is the gen prompt not slang-diagnostics.lua

Triaging shader-slang/slang#11407 (follow-up to #11403). The generated autodiff diagnostics-catalog test `docs/generated/tests/cross-cutting/diagnostics-catalog/30055-use-of-non-short-circuiting-operator-in-diff-func.slang` was reported as "stale: asserts CHECK: 30055 on a scalar `?:` that never emits it." Verified with prebuilt slangc — it's worse:

- The stale body `return b ?: 0.0;` uses the GNU **elvis** form (omitted middle operand), which **Slang does not support** → `error[E20002]: syntax error`, never 30055. So the test would FAIL (not silently pass) if the suite ran. The LLM generator hallucinated unsupported `?:` syntax.
- **Verified correct minimal repro for E30055:** a *vector* condition + *full* ternary inside `[Differentiable]`:
  ```
  [Differentiable]
  float f(float x, bool2 b) { return (b ? float2(x) : float2(0.0)).x; }
  void main() {}
  ```
  → `error[E30055]: non-short-circuiting ?: not allowed in differentiable function`. A vector `?:` in a NON-differentiable fn emits 30056 (deprecation warning) instead. Scalar `?:` (full ternary) emits nothing — `visitSelectExpr` (slang-check-expr.cpp ~L4345) early-returns for a `BasicExpressionType` condition; `:4359`/`:4364` are the sole 30055/30056 emit sites in the repo.
- **Fix-surface correction:** the issue (and prior assumptions) point at `source/slang/slang-diagnostics.lua` as the "generation source." It is NOT — that file only declares the code+message and is correct. This catalog is an **LLM-generated "Agentic Test Suite"** with no deterministic generator; the real fix surfaces are the artifact itself (regenerated, not hand-edited per `generated=true`) and the generation prompt `docs/generated/tests/_meta/prompts/cross-cutting-diagnostics-catalog.md` (which already requires verifying reachability — the generator violated it). Regen driver: `python3 docs/generated/tests/_meta/regenerate.py {list,list-stale,lint,show,mark-fresh}`. Suite is nightly-only and that wiring is still planned, so staleness is latent (not breaking CI).

Lesson for triaging "generated test is wrong" issues: actually run the stale example through slangc — don't trust the issue's characterization of *how* it's wrong. And distinguish the diagnostic *definition* file (.lua) from the *example generator* (LLM prompt).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780347335365-slang-11407-stale-30055-catalog-test-is-a-syntax-e.md`_
